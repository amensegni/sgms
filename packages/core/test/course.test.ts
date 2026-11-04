import { describe, expect } from "vitest";
import { Effect } from "effect";
import { it as itEffect } from "@effect/vitest";
import { CourseService } from "../src/services/course-service";
import { DuplicateCourse } from "../src/contracts";
import { testLayer } from "./test-layers";

describe("CourseService", () => {
  itEffect("creates a course and lists it", () =>
    Effect.gen(function* () {
      const service = yield* CourseService;
      const course = yield* service.create({
        name: "Math 101",
        code: "math101",
      });
      expect(course.name).toBe("Math 101");
      expect(course.code).toBe("MATH101");
      expect(yield* service.list()).toEqual([course]);
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("rejects duplicate course codes regardless of case", () =>
    Effect.gen(function* () {
      const service = yield* CourseService;
      yield* service.create({ name: "History 101", code: "HIST101" });
      const result = yield* service.create({
        name: "History 102",
        code: "hist101",
      }).pipe(Effect.flip);
      expect(result).toBeInstanceOf(DuplicateCourse);
    }).pipe(Effect.provide(testLayer))
  );
});
