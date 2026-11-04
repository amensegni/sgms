import { describe, expect } from "vitest";
import { Effect } from "effect";
import { it as itEffect } from "@effect/vitest";
import { CourseService } from "../src/services/course-service";
import { GradeService } from "../src/services/grade-service";
import { StudentService } from "../src/services/student-service";
import {
  CourseNotFound,
  InvalidGrade,
  StudentNotFound,
} from "../src/contracts";
import { asCourseId, asStudentId, testLayer } from "./test-layers";

describe("GradeService", () => {
  itEffect("records grades against existing students and courses", () =>
    Effect.gen(function* () {
      const studentService = yield* StudentService;
      const courseService = yield* CourseService;
      const gradeService = yield* GradeService;
      const student = yield* studentService.create({
        name: "Alice",
        email: "alice@example.com",
      });
      const math = yield* courseService.create({ name: "Math", code: "MATH101" });
      const science = yield* courseService.create({ name: "Science", code: "SCI101" });

      const first = yield* gradeService.record({
        studentId: student.id,
        courseId: math.id,
        value: 95,
      });
      yield* gradeService.record({
        studentId: student.id,
        courseId: science.id,
        value: 72,
      });

      expect(first.letter).toBe("A");
      expect((yield* gradeService.getForStudent({ studentId: student.id })).map(
        (grade) => grade.letter
      )).toEqual(["A", "C"]);
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("rejects grades outside the integer range", () =>
    Effect.gen(function* () {
      const studentService = yield* StudentService;
      const courseService = yield* CourseService;
      const gradeService = yield* GradeService;
      const student = yield* studentService.create({
        name: "Bob",
        email: "bob@example.com",
      });
      const course = yield* courseService.create({ name: "History", code: "HIST101" });
      for (const value of [-1, 100.5, 101]) {
        const result = yield* gradeService.record({
          studentId: student.id,
          courseId: course.id,
          value,
        }).pipe(Effect.flip);
        expect(result).toBeInstanceOf(InvalidGrade);
      }
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("requires an existing student and course", () =>
    Effect.gen(function* () {
      const studentService = yield* StudentService;
      const courseService = yield* CourseService;
      const gradeService = yield* GradeService;
      const student = yield* studentService.create({
        name: "Charlie",
        email: "charlie@example.com",
      });
      const course = yield* courseService.create({ name: "Physics", code: "PHYS101" });

      const missingStudent = yield* gradeService.record({
        studentId: asStudentId("missing"),
        courseId: course.id,
        value: 80,
      }).pipe(Effect.flip);
      const missingCourse = yield* gradeService.record({
        studentId: student.id,
        courseId: asCourseId("missing"),
        value: 80,
      }).pipe(Effect.flip);

      expect(missingStudent).toBeInstanceOf(StudentNotFound);
      expect(missingCourse).toBeInstanceOf(CourseNotFound);
    }).pipe(Effect.provide(testLayer))
  );

  itEffect("fails grade lookup when the student does not exist", () =>
    Effect.gen(function* () {
      const gradeService = yield* GradeService;
      const result = yield* gradeService.getForStudent({
        studentId: asStudentId("missing"),
      }).pipe(Effect.flip);
      expect(result).toBeInstanceOf(StudentNotFound);
    }).pipe(Effect.provide(testLayer))
  );
});
