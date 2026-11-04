import { describe, it, expect } from "vitest";
import { Effect, Layer } from "effect";
import { it as itEffect } from "@effect/vitest";
import { GradeService, GradeStoreLayer } from "../src/services/grade-service";
import { InvalidGrade } from "../src/contracts";

const testLayer = Layer.provide(GradeStoreLayer);

describe("GradeService", () => {
  itEffect("records a grade and assigns a letter", () =>
    Effect.gen(function* () {
      const grade = yield* GradeService.record({
        studentId: "student-1",
        courseId: "course-1",
        value: 95,
      });
      expect(grade.value).toBe(95);
      expect(grade.letter).toBe("A");
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("rejects grade out of range", () =>
    Effect.gen(function* () {
      const result = yield* GradeService.record({
        studentId: "student-1",
        courseId: "course-1",
        value: 101,
      }).pipe(Effect.flip);
      expect(result._tag).toBe("InvalidGrade");
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("retrieves grades for a student", () =>
    Effect.gen(function* () {
      yield* GradeService.record({ studentId: "student-1", courseId: "course-1", value: 85 });
      yield* GradeService.record({ studentId: "student-1", courseId: "course-2", value: 72 });
      const grades = yield* GradeService.getForStudent({ studentId: "student-1" });
      expect(grades.length).toBe(2);
    }).pipe(Effect.provide(testLayer))
  );
});