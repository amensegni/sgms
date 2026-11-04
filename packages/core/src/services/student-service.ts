import { Context, Effect, Layer, Schedule } from "effect";
import { Schema } from "effect";
import {
  createStudentContract,
  getStudentContract,
  DuplicateStudent,
  StudentNotFound,
  Student,
  StudentId,
} from "../contracts";

// --- Service interface ---

class StudentService extends Context.Service("StudentService")() {
  create = (input: { name: string; email: string }) =>
    Effect.gen(function* () {
      const students = yield* StudentStore;
      const existing = yield* Effect.promise(() =>
        students.find((s) => s.email === input.email)
      );
      if (existing) {
        yield* Effect.fail(new DuplicateStudent({ email: input.email }));
      }
      const id: StudentId = crypto.randomUUID();
      const student: Student = { id, name: input.name, email: input.email };
      yield* Effect.promise(() => students.push(student));
      return student;
    });

  get = (input: { id: StudentId }) =>
    Effect.gen(function* () {
      const students = yield* StudentStore;
      const student = yield* Effect.promise(() =>
        students.find((s) => s.id === input.id)
      );
      if (!student) {
        yield* Effect.fail(new StudentNotFound({ id: input.id }));
      }
      return student;
    });
}

// --- In-memory store (port boundary; adapter replaces this) ---

class StudentStore extends Context.Tag("StudentStore")<
  StudentStore,
  { items: Student[]; find: (pred: (s: Student) => unknown) => Promise<Student | undefined>; push: (s: Student) => Promise<void> }
>() {}

// --- Layer ---

export const StudentServiceLayer = Layer.effect(
  StudentService,
  Effect.gen(function* () {
    const store = yield* StudentStore;
    return new StudentService({ store });
  })
);

export const StudentStoreLayer = Layer.succeed(
  StudentStore,
  {
    items: [],
    find: (pred) => Promise.resolve(([] as Student[]).find(pred)),
    push: (s) => Promise.resolve(),
  }
);