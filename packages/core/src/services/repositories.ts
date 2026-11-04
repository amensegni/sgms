import { Context, Effect } from "effect";
import {
  Course,
  CourseId,
  DuplicateCourse,
  DuplicateStudent,
  Grade,
  PersistenceError,
  Student,
  StudentId,
} from "../contracts.js";

export class StudentRepository extends Context.Service<
  StudentRepository,
  {
    list: () => Effect.Effect<readonly Student[], PersistenceError>;
    findById: (id: StudentId) => Effect.Effect<Student | undefined, PersistenceError>;
    create: (input: {
      name: string;
      email: string;
    }) => Effect.Effect<Student, DuplicateStudent | PersistenceError>;
  }
>()("StudentRepository") {}

export class CourseRepository extends Context.Service<
  CourseRepository,
  {
    list: () => Effect.Effect<readonly Course[], PersistenceError>;
    findById: (id: CourseId) => Effect.Effect<Course | undefined, PersistenceError>;
    create: (input: {
      name: string;
      code: string;
    }) => Effect.Effect<Course, DuplicateCourse | PersistenceError>;
  }
>()("CourseRepository") {}

export class GradeRepository extends Context.Service<
  GradeRepository,
  {
    findForStudent: (studentId: StudentId) => Effect.Effect<readonly Grade[], PersistenceError>;
    create: (grade: Omit<Grade, "id">) => Effect.Effect<Grade, PersistenceError>;
  }
>()("GradeRepository") {}
