import { describe, expect } from "vitest";
import { Effect } from "effect";
import { it as itEffect } from "@effect/vitest";
import { StudentService } from "../src/services/student-service";
import { DuplicateStudent, StudentNotFound } from "../src/contracts";
import { asStudentId, testLayer } from "./test-layers";

describe("StudentService", () => {
  itEffect("creates and retrieves persisted repository data", () =>
    Effect.gen(function* () {
      const service = yield* StudentService;
      const student = yield* service.create({
        name: "Alice",
        email: "Alice@Example.com",
      });
      expect(student.email).toBe("alice@example.com");

      const found = yield* service.get({ id: student.id });
      expect(found.name).toBe("Alice");
      expect(yield* service.list()).toEqual([student]);
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("rejects duplicate email regardless of case", () =>
    Effect.gen(function* () {
      const service = yield* StudentService;
      yield* service.create({ name: "Bob", email: "bob@example.com" });
      const result = yield* service.create({
        name: "Bob 2",
        email: "BOB@example.com",
      }).pipe(Effect.flip);
      expect(result).toBeInstanceOf(DuplicateStudent);
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("fails when a student is not found", () =>
    Effect.gen(function* () {
      const service = yield* StudentService;
      const result = yield* service.get({ id: asStudentId("missing") }).pipe(
        Effect.flip
      );
      expect(result).toBeInstanceOf(StudentNotFound);
    }).pipe(Effect.provide(testLayer))
  );
});
