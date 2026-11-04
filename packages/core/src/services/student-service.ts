import { Context, Effect, Layer } from "effect";
import {
  DuplicateStudent,
  PersistenceError,
  Student,
  StudentNotFound,
  StudentId,
} from "../contracts.js";
import { StudentRepository } from "./repositories.js";

export class StudentService extends Context.Service<StudentService, {
  create: (input: { name: string; email: string }) => Effect.Effect<Student, DuplicateStudent | PersistenceError>;
  list: () => Effect.Effect<readonly Student[], PersistenceError>;
  get: (input: { id: StudentId }) => Effect.Effect<Student, StudentNotFound | PersistenceError>;
}>()("StudentService") {}

export const StudentServiceLayer = Layer.effect(
  StudentService,
  Effect.gen(function* () {
    const repository = yield* StudentRepository;
    return {
      create: (input: { name: string; email: string }) =>
        repository.create({
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
        }),
      list: () => repository.list(),
      get: (input: { id: StudentId }) =>
        Effect.gen(function* () {
          const student = yield* repository.findById(input.id);
          if (!student) {
            return yield* Effect.fail(new StudentNotFound({ id: input.id }));
          }
          return student;
        }),
    };
  })
);