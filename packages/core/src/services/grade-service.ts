import { Context, Effect, Layer } from "effect";
import {
  recordGradeContract,
  getGradesForStudentContract,
  InvalidGrade,
  StudentNotFound,
  Grade,
  GradeId,
  StudentId,
  CourseId,
} from "../contracts";

class GradeService extends Context.Service("GradeService")() {
  record = (input: { studentId: StudentId; courseId: CourseId; value: number }) =>
    Effect.gen(function* () {
      if (input.value < 0 || input.value > 100) {
        yield* Effect.fail(new InvalidGrade({ value: input.value, reason: "grade must be between 0 and 100" }));
      }
      const grades = yield* GradeStore;
      const id: GradeId = crypto.randomUUID();
      const grade: Grade = {
        id,
        studentId: input.studentId,
        courseId: input.courseId,
        value: input.value,
        letter: input.value >= 90 ? "A" : input.value >= 80 ? "B" : input.value >= 70 ? "C" : input.value >= 60 ? "D" : "F",
      };
      yield* Effect.promise(() => grades.push(grade));
      return grade;
    });

  getForStudent = (input: { studentId: StudentId }) =>
    Effect.gen(function* () {
      const grades = yield* GradeStore;
      const studentGrades = yield* Effect.promise(() =>
        grades.filter((g) => g.studentId === input.studentId)
      );
      return studentGrades;
    });
}

class GradeStore extends Context.Tag("GradeStore")<
  GradeStore,
  { items: Grade[]; push: (g: Grade) => Promise<void>; filter: (pred: (g: Grade) => unknown) => Promise<Grade[]> }
>() {}

export const GradeServiceLayer = Layer.effect(
  GradeService,
  Effect.gen(function* () {
    const store = yield* GradeStore;
    return new GradeService({ store });
  })
);

export const GradeStoreLayer = Layer.succeed(
  GradeStore,
  {
    items: [],
    push: (g) => Promise.resolve(),
    filter: (pred) => Promise.resolve(([] as Grade[]).filter(pred)),
  }
);