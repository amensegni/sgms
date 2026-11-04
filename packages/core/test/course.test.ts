import { describe, it, expect } from "vitest";
import { Effect, Layer } from "effect";
import { it as itEffect } from "@effect/vitest";
import { CourseService, CourseStoreLayer } from "../src/services/course-service";

const testLayer = Layer.provide(CourseStoreLayer);

describe("CourseService", () => {
  itEffect("creates a course", () =>
    Effect.gen(function* () {
      const course = yield* CourseService.create({ name: "Math 101", code: "MATH101" });
      expect(course.name).toBe("Math 101");
      expect(course.code).toBe("MATH101");
      expect(typeof course.id).toBe("string");
    }).pipe(Effect.provide(testLayer))
  );
});