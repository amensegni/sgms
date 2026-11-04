import { Effect } from "effect";
import { implement } from "./contracts.js";
import {
  createStudentContract,
  listStudentsContract,
  getStudentContract,
  createCourseContract,
  listCoursesContract,
  recordGradeContract,
  getGradesForStudentContract,
} from "./contracts.js";
import { StudentService } from "./services/student-service.js";
import { CourseService } from "./services/course-service.js";
import { GradeService } from "./services/grade-service.js";

export const createStudent = implement(createStudentContract, (input) =>
  Effect.gen(function* () {
    const svc = yield* StudentService;
    return yield* svc.create(input);
  })
);

export const listStudents = implement(listStudentsContract, () =>
  Effect.gen(function* () {
    const svc = yield* StudentService;
    return yield* svc.list();
  })
);

export const getStudent = implement(getStudentContract, (input) =>
  Effect.gen(function* () {
    const svc = yield* StudentService;
    return yield* svc.get(input);
  })
);

export const createCourse = implement(createCourseContract, (input) =>
  Effect.gen(function* () {
    const svc = yield* CourseService;
    return yield* svc.create(input);
  })
);

export const listCourses = implement(listCoursesContract, () =>
  Effect.gen(function* () {
    const svc = yield* CourseService;
    return yield* svc.list();
  })
);

export const recordGrade = implement(recordGradeContract, (input) =>
  Effect.gen(function* () {
    const svc = yield* GradeService;
    return yield* svc.record(input);
  })
);

export const getGradesForStudent = implement(
  getGradesForStudentContract,
  (input) =>
    Effect.gen(function* () {
      const svc = yield* GradeService;
      return yield* svc.getForStudent(input);
    })
);

export const capabilities = [
  createStudent,
  listStudents,
  getStudent,
  createCourse,
  listCourses,
  recordGrade,
  getGradesForStudent,
] as const;