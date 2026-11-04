import { Effect, Layer, Schema } from "effect";
import {
  Course,
  CourseId,
  CourseSchema,
  DuplicateCourse,
  DuplicateStudent,
  Grade,
  GradeSchema,
  Student,
  StudentId,
  StudentSchema,
} from "../src/contracts";
import {
  CourseRepository,
  GradeRepository,
  StudentRepository,
} from "../src/services/repositories";
import { CourseServiceLayer } from "../src/services/course-service";
import { GradeServiceLayer } from "../src/services/grade-service";
import { StudentServiceLayer } from "../src/services/student-service";

export const testLayer = Layer.mergeAll(
  StudentServiceLayer,
  CourseServiceLayer,
  GradeServiceLayer
).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      Layer.effect(
        StudentRepository,
        Effect.sync(() => {
          const students: Student[] = [];
          let nextId = 0;
          return {
            list: () => Effect.succeed([...students]),
            findById: (id) => Effect.succeed(students.find((student) => student.id === id)),
            create: (input) => {
              const email = input.email.trim().toLowerCase();
              if (students.some((student) => student.email === email)) {
                return Effect.fail(new DuplicateStudent({ email }));
              }
              const student = Schema.decodeUnknownSync(StudentSchema)({
                id: `test-student-${++nextId}`,
                ...input,
                email,
              });
              students.push(student);
              return Effect.succeed(student);
            },
          };
        })
      ),
      Layer.effect(
        CourseRepository,
        Effect.sync(() => {
          const courses: Course[] = [];
          let nextId = 0;
          return {
            list: () => Effect.succeed([...courses]),
            findById: (id) => Effect.succeed(courses.find((course) => course.id === id)),
            create: (input) => {
              const code = input.code.trim().toUpperCase();
              if (courses.some((course) => course.code === code)) {
                return Effect.fail(new DuplicateCourse({ code }));
              }
              const course = Schema.decodeUnknownSync(CourseSchema)({
                id: `test-course-${++nextId}`,
                ...input,
                code,
              });
              courses.push(course);
              return Effect.succeed(course);
            },
          };
        })
      ),
      Layer.effect(
        GradeRepository,
        Effect.sync(() => {
          const grades: Grade[] = [];
          let nextId = 0;
          return {
            findForStudent: (studentId) =>
              Effect.succeed(grades.filter((grade) => grade.studentId === studentId)),
            create: (input) => {
              const grade = Schema.decodeUnknownSync(GradeSchema)({
                id: `test-grade-${++nextId}`,
                ...input,
              });
              grades.push(grade);
              return Effect.succeed(grade);
            },
          };
        })
      )
    )
  )
);

export const asStudentId = (id: string): StudentId =>
  Schema.decodeUnknownSync(StudentId)(id);

export const asCourseId = (id: string): CourseId =>
  Schema.decodeUnknownSync(CourseId)(id);
