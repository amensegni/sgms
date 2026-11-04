import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Prisma } from "@prisma/client";
import { Effect, Layer, Schema } from "effect";
import {
  CourseRepository,
  CourseSchema,
  DuplicateCourse,
  DuplicateStudent,
  GradeRepository,
  GradeSchema,
  PersistenceError,
  StudentRepository,
  StudentSchema,
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

  return {
    layer: Layer.mergeAll(students, courses, grades),
    close: () => prisma.$disconnect(),
  };
};
