import { implement } from "./contracts";
import {
  createStudentContract,
  getStudentContract,
  createCourseContract,
  recordGradeContract,
  getGradesForStudentContract,
} from "./contracts";
import { StudentService } from "./services/student-service";
import { CourseService } from "./services/course-service";
import { GradeService } from "./services/grade-service";

export const createStudent = implement(createStudentContract, ({ name, email }) =>
  StudentService.create({ name, email })
);

export const getStudent = implement(getStudentContract, ({ id }) =>
  StudentService.get({ id })
);

export const createCourse = implement(createCourseContract, ({ name, code }) =>
  CourseService.create({ name, code })
);

export const recordGrade = implement(recordGradeContract, ({ studentId, courseId, value }) =>
  GradeService.record({ studentId, courseId, value })
);

export const getGradesForStudent = implement(
  getGradesForStudentContract,
  ({ studentId }) => GradeService.getForStudent({ studentId })
);

export const capabilities = [
  createStudent,
  getStudent,
  createCourse,
  recordGrade,
  getGradesForStudent,
] as const;