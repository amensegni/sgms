import { Context, Effect, Layer } from "effect";
import {
  CourseId,
  CourseNotFound,
  Grade,
  InvalidGrade,
  PersistenceError,
  StudentId,
  StudentNotFound,
} from "../contracts.js";
import {
  CourseRepository,
  GradeRepository,
  StudentRepository,
} from "./repositories.js";

export class GradeService extends Context.Service<
  GradeService,
  {
    record: (input: {
      studentId: StudentId;
      courseId: CourseId;
      value: number;
    }) => Effect.Effect<Grade, CourseNotFound | StudentNotFound | InvalidGrade | PersistenceError>;
    getForStudent: (input: {
      studentId: StudentId;
    }) => Effect.Effect<readonly Grade[], StudentNotFound | PersistenceError>;
  }
>()("GradeService") {}

export const GradeServiceLayer = Layer.effect(
  GradeService,
  Effect.gen(function* () {
    const grades = yield* GradeRepository;
    const students = yield* StudentRepository;
    const courses = yield* CourseRepository;

    return {
      record: (input: { studentId: StudentId; courseId: CourseId; value: number }) =>
        Effect.gen(function* () {
          const student = yield* students.findById(input.studentId);
          if (!student) {
            return yield* Effect.fail(new StudentNotFound({ id: input.studentId }));
          }

          const course = yield* courses.findById(input.courseId);
          if (!course) {
            return yield* Effect.fail(new CourseNotFound({ id: input.courseId }));
          }

          if (!Number.isInteger(input.value) || input.value < 0 || input.value > 100) {
            return yield* Effect.fail(
              new InvalidGrade({
                value: input.value,
                reason: "grade must be an integer between 0 and 100",
              })
            );
          }

          return yield* grades.create({
            studentId: input.studentId,
            courseId: input.courseId,
            value: input.value,
            letter:
              input.value >= 90 ? "A" :
              input.value >= 80 ? "B" :
              input.value >= 70 ? "C" :
              input.value >= 60 ? "D" : "F",
          });
        }),
      getForStudent: (input: { studentId: StudentId }) =>
        Effect.gen(function* () {
          const student = yield* students.findById(input.studentId);
          if (!student) {
            return yield* Effect.fail(new StudentNotFound({ id: input.studentId }));
          }

          return yield* grades.findForStudent(input.studentId);
        }),
    };
  })
);
