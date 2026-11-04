import { describe, it, expect } from "vitest";
import { Effect, Layer } from "effect";
import { it as itEffect } from "@effect/vitest";
import { StudentService, StudentStoreLayer } from "../src/services/student-service";
import { DuplicateStudent, StudentNotFound } from "../src/contracts";

const testLayer = Layer.provide(StudentStoreLayer);

describe("StudentService", () => {
  itEffect("creates and retrieves a student", () =>
    Effect.gen(function* () {
      const student = yield* StudentService.create({ name: "Alice", email: "alice@example.com" });
      expect(student.name).toBe("Alice");
      expect(student.email).toBe("alice@example.com");
      expect(typeof student.id).toBe("string");

      const found = yield* StudentService.get({ id: student.id });
      expect(found.name).toBe("Alice");
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("rejects duplicate email", () =>
    Effect.gen(function* () {
      yield* StudentService.create({ name: "Bob", email: "bob@example.com" });
      const result = yield* StudentService.create({ name: "Bob2", email: "bob@example.com" }).pipe(
        Effect.flip
      );
      expect(result._tag).toBe("DuplicateStudent");
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("fails when student not found", () =>
    Effect.gen(function* () {
      const result = yield* StudentService.get({ id: "nonexistent" }).pipe(
        Effect.flip
      );
      expect(result._tag).toBe("StudentNotFound");
    }).pipe(Effect.provide(testLayer))
  );
});