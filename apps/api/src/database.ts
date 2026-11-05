import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Prisma } from "@prisma/client";
import { Effect, Layer, Schema } from "effect";
import {
  AssessmentSchema,
  CourseRepository,
  CourseSchema,
  DuplicateCourse,
  DuplicateStudent,
  CourseGradebookRepository,
  GradeRepository,
  GradeSchema,
  PersistenceError,
  StudentEnrollmentSchema,
  StudentRepository,
  StudentSchema,
  TeacherDashboardSchema,
} from "@sgms/core";

const persistenceFailure = (operation: string, cause: unknown) =>
  new PersistenceError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
  });

const isUniqueConstraintFailure = (
  cause: unknown
): cause is Prisma.PrismaClientKnownRequestError =>
  cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002";

export const makePrismaRepositoryLayer = (url: string) => {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
    log: ["error"],
  });

  const students = Layer.succeed(StudentRepository, {
    list: () =>
      Effect.tryPromise({
        try: async () =>
          (await prisma.student.findMany({ orderBy: { name: "asc" } })).map((student) =>
            Schema.decodeUnknownSync(StudentSchema)(student)
          ),
        catch: (cause) => persistenceFailure("listStudents", cause),
      }),
    findById: (id) =>
      Effect.tryPromise({
        try: async () => {
          const student = await prisma.student.findUnique({ where: { id } });
          return student ? Schema.decodeUnknownSync(StudentSchema)(student) : undefined;
        },
        catch: (cause) => persistenceFailure("findStudent", cause),
      }),
    create: (input) =>
      Effect.tryPromise({
        try: async () => {
          const student = await prisma.student.create({ data: input });
          return Schema.decodeUnknownSync(StudentSchema)(student);
        },
        catch: (cause) =>
          isUniqueConstraintFailure(cause)
            ? new DuplicateStudent({ email: input.email })
            : persistenceFailure("createStudent", cause),
      }),
  });

  const courses = Layer.succeed(CourseRepository, {
    list: () =>
      Effect.tryPromise({
        try: async () =>
          (await prisma.course.findMany({ orderBy: { code: "asc" } })).map((course) =>
            Schema.decodeUnknownSync(CourseSchema)(course)
          ),
        catch: (cause) => persistenceFailure("listCourses", cause),
      }),
    findById: (id) =>
      Effect.tryPromise({
        try: async () => {
          const course = await prisma.course.findUnique({ where: { id } });
          return course ? Schema.decodeUnknownSync(CourseSchema)(course) : undefined;
        },
        catch: (cause) => persistenceFailure("findCourse", cause),
      }),
    create: (input) =>
      Effect.tryPromise({
        try: async () => {
          const course = await prisma.course.create({ data: input });
          return Schema.decodeUnknownSync(CourseSchema)(course);
        },
        catch: (cause) =>
          isUniqueConstraintFailure(cause)
            ? new DuplicateCourse({ code: input.code })
            : persistenceFailure("createCourse", cause),
      }),
  });

  const grades = Layer.succeed(GradeRepository, {
    findForStudent: (studentId) =>
      Effect.tryPromise({
        try: async () =>
          (await prisma.grade.findMany({
            where: { studentId },
            orderBy: { id: "asc" },
          })).map((grade) => Schema.decodeUnknownSync(GradeSchema)({
            ...grade,
            letter: grade.letter ?? undefined,
          })),
        catch: (cause) => persistenceFailure("listStudentGrades", cause),
      }),
    create: (grade) =>
      Effect.tryPromise({
        try: async () => {
          const created = await prisma.grade.create({
            data: {
              studentId: grade.studentId,
              courseId: grade.courseId,
              value: grade.value,
              letter: grade.letter,
            },
          });
          return Schema.decodeUnknownSync(GradeSchema)({
            ...created,
            letter: created.letter ?? undefined,
          });
        },
        catch: (cause) => persistenceFailure("recordGrade", cause),
      }),
  });

  const gradebook = Layer.succeed(CourseGradebookRepository, {
    loadForTeacher: (teacherId) =>
      Effect.tryPromise({
        try: async () => {
          const teacher = await prisma.teacher.findUnique({
            where: { id: teacherId },
            include: {
              courses: {
                orderBy: { name: "asc" },
                include: {
                  sections: {
                    orderBy: { name: "asc" },
                    include: {
                      enrollments: {
                        orderBy: { student: { name: "asc" } },
                        include: { student: true },
                      },
                    },
                  },
                  assessments: {
                    orderBy: [{ occurredAt: "asc" }, { title: "asc" }],
                    include: { results: true },
                  },
                },
              },
            },
          });
          if (!teacher) {
            return undefined;
          }
          return Schema.decodeUnknownSync(TeacherDashboardSchema)({
            teacher: {
              id: teacher.id,
              name: teacher.name,
              email: teacher.email,
            },
            courses: teacher.courses.map((course) => ({
              id: course.id,
              name: course.name,
              code: course.code,
              sections: course.sections.map((section) => ({
                id: section.id,
                name: section.name,
              })),
              students: course.sections.flatMap((section) =>
                section.enrollments.map((enrollment) =>
                  Schema.decodeUnknownSync(StudentEnrollmentSchema)({
                    id: enrollment.id,
                    studentId: enrollment.student.id,
                    name: enrollment.student.name,
                    email: enrollment.student.email,
                    sectionId: section.id,
                    sectionName: section.name,
                  })
                )
              ),
              assessments: course.assessments.map((assessment) =>
                Schema.decodeUnknownSync(AssessmentSchema)({
                  ...assessment,
                  occurredAt: assessment.occurredAt.toISOString(),
                })
              ),
              results: course.assessments.flatMap((assessment) =>
                assessment.results.map((result) => ({
                  id: result.id,
                  assessmentId: result.assessmentId,
                  enrollmentId: result.enrollmentId,
                  score: result.score,
                }))
              ),
            })),
          });
        },
        catch: (cause) => persistenceFailure("loadTeacherDashboard", cause),
      }),
    courseIsTaughtBy: (teacherId, courseId) =>
      Effect.tryPromise({
        try: async () =>
          (await prisma.course.findFirst({
            where: { id: courseId, teacherId },
            select: { id: true },
          })) !== null,
        catch: (cause) => persistenceFailure("findTaughtCourse", cause),
      }),
    hasExam: (courseId, category) =>
      Effect.tryPromise({
        try: async () =>
          (await prisma.assessment.findFirst({
            where: { courseId, category },
            select: { id: true },
          })) !== null,
        catch: (cause) => persistenceFailure("findExamAssessment", cause),
      }),
    createAssessment: (input) =>
      Effect.tryPromise({
        try: async () => {
          const assessment = await prisma.assessment.create({
            data: {
              courseId: input.courseId,
              category: input.category,
              title: input.title,
              maxScore: input.maxScore,
              occurredAt: new Date(input.occurredAt),
            },
          });
          return Schema.decodeUnknownSync(AssessmentSchema)({
            ...assessment,
            occurredAt: assessment.occurredAt.toISOString(),
          });
        },
        catch: (cause) => persistenceFailure("createAssessment", cause),
      }),
    findAssessment: (assessmentId) =>
      Effect.tryPromise({
        try: async () => {
          const assessment = await prisma.assessment.findUnique({
            where: { id: assessmentId },
            select: { id: true, courseId: true, category: true, title: true, maxScore: true, occurredAt: true },
          });
          if (!assessment) {
            return undefined;
          }
          return {
            assessment: Schema.decodeUnknownSync(AssessmentSchema)({
              ...assessment,
              occurredAt: assessment.occurredAt.toISOString(),
            }),
            courseId: assessment.courseId,
          };
        },
        catch: (cause) => persistenceFailure("findAssessment", cause),
      }),
    isEnrolledInCourse: (studentId, courseId) =>
      Effect.tryPromise({
        try: async () =>
          (await prisma.enrollment.findFirst({
            where: { studentId, courseId },
            select: { id: true },
          })) !== null,
        catch: (cause) => persistenceFailure("checkCourseEnrollment", cause),
      }),
    saveResult: (input) =>
      Effect.tryPromise({
        try: async () => {
          const assessment = await prisma.assessment.findUniqueOrThrow({
            where: { id: input.assessmentId },
            select: { courseId: true },
          });
          const enrollment = await prisma.enrollment.findFirstOrThrow({
            where: { studentId: input.studentId, courseId: assessment.courseId },
            select: { id: true },
          });
          const result = await prisma.assessmentResult.upsert({
            where: {
              assessmentId_enrollmentId: {
                assessmentId: input.assessmentId,
                enrollmentId: enrollment.id,
              },
            },
            create: {
              courseId: assessment.courseId,
              assessmentId: input.assessmentId,
              enrollmentId: enrollment.id,
              score: input.score,
            },
            update: { score: input.score },
          });
          return {
            id: result.id,
            assessmentId: result.assessmentId,
            enrollmentId: result.enrollmentId,
            score: result.score,
          };
        },
        catch: (cause) => persistenceFailure("saveAssessmentResult", cause),
      }),
  });

  return {
    layer: Layer.mergeAll(students, courses, grades, gradebook),
    close: () => prisma.$disconnect(),
  };
};
