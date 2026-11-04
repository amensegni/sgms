import { Effect, Schema } from "effect";

// --- Local defineContract (rat-stack pattern, no external dep) ---

export interface Contract<
  Name extends string,
  Input extends Schema.Schema<unknown>,
  Output extends Schema.Schema<unknown>,
  Failure extends Schema.Schema<unknown>,
> {
  readonly name: Name;
  readonly input: Input;
  readonly output: Output;
  readonly failure: Failure;
  readonly annotations: {
    readonly idempotent: boolean;
    readonly readOnly: boolean;
    readonly destructive: boolean;
  };
  readonly description: string;
}

export function defineContract<
  Name extends string,
  Input extends Schema.Schema<unknown>,
  Output extends Schema.Schema<unknown>,
  Failure extends Schema.Schema<unknown>,
>(
  name: Name,
  opts: {
    annotations: {
      readonly idempotent?: boolean;
      readonly readOnly?: boolean;
      readonly destructive?: boolean;
    };
    description: string;
    failure: Failure;
    input: Input;
    output: Output;
  },
): Contract<Name, Input, Output, Failure> {
  return {
    name,
    input: opts.input,
    output: opts.output,
    failure: opts.failure,
    annotations: {
      idempotent: opts.annotations.idempotent ?? false,
      readOnly: opts.annotations.readOnly ?? false,
      destructive: opts.annotations.destructive ?? false,
    },
    description: opts.description,
  };
}

export function implement<
  Name extends string,
  Input extends Schema.Schema<unknown>,
  Output extends Schema.Schema<unknown>,
  Failure extends Schema.Schema<unknown>,
  R = never,
>(
  contract: Contract<Name, Input, Output, Failure>,
  handler: (input: Schema.Schema.Type<Input>) => Effect.Effect<
    Schema.Schema.Type<Output>,
    Schema.Schema.Type<Failure>,
    R
  >,
): {
  readonly contract: Contract<Name, Input, Output, Failure>;
  readonly handler: (input: Schema.Schema.Type<Input>) => Effect.Effect<
    Schema.Schema.Type<Output>,
    Schema.Schema.Type<Failure>,
    R
  >;
} {
  return { contract, handler };
}

// --- Errors ---

export class StudentNotFound extends Schema.TaggedError<StudentNotFound>()(
  "StudentNotFound",
  { id: Schema.String }
) {}

export class GradeNotFound extends Schema.TaggedError<GradeNotFound>()(
  "GradeNotFound",
  { id: Schema.String }
) {}

export class CourseNotFound extends Schema.TaggedError<CourseNotFound>()(
  "CourseNotFound",
  { id: Schema.String }
) {}

export class DuplicateStudent extends Schema.TaggedError<DuplicateStudent>()(
  "DuplicateStudent",
  { email: Schema.String }
) {}

export class DuplicateCourse extends Schema.TaggedError<DuplicateCourse>()(
  "DuplicateCourse",
  { code: Schema.String }
) {}

export class InvalidGrade extends Schema.TaggedError<InvalidGrade>()(
  "InvalidGrade",
  { value: Schema.Number, reason: Schema.String }
) {}

export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  { operation: Schema.String, message: Schema.String }
) {}

// --- Schemas ---

export const StudentId = Schema.brand("StudentId")(Schema.String);
export type StudentId = typeof StudentId.Type;

export const CourseId = Schema.brand("CourseId")(Schema.String);
export type CourseId = typeof CourseId.Type;

export const GradeId = Schema.brand("GradeId")(Schema.String);
export type GradeId = typeof GradeId.Type;

export const StudentSchema = Schema.Struct({
  id: StudentId,
  name: Schema.String,
  email: Schema.String,
});
export type Student = typeof StudentSchema.Type;

export const CourseSchema = Schema.Struct({
  id: CourseId,
  name: Schema.String,
  code: Schema.String,
});
export type Course = typeof CourseSchema.Type;

export const GradeSchema = Schema.Struct({
  id: GradeId,
  studentId: StudentId,
  courseId: CourseId,
  value: Schema.Number,
  letter: Schema.optional(Schema.String),
});
export type Grade = typeof GradeSchema.Type;

// --- Contracts ---

export const createStudentContract = defineContract("createStudent", {
  annotations: {
    idempotent: false,
    readOnly: false,
    destructive: false,
  },
  description: "Register a new student",
  failure: Schema.Union([DuplicateStudent, PersistenceError]),
  input: Schema.Struct({
    name: Schema.String,
    email: Schema.String,
  }),
  output: StudentSchema,
});

export const listStudentsContract = defineContract("listStudents", {
  annotations: {
    idempotent: true,
    readOnly: true,
    destructive: false,
  },
  description: "List registered students",
  failure: PersistenceError,
  input: Schema.Struct({}),
  output: Schema.Array(StudentSchema),
});

export const getStudentContract = defineContract("getStudent", {
  annotations: {
    idempotent: true,
    readOnly: true,
    destructive: false,
  },
  description: "Look up a student by id",
  failure: Schema.Union([StudentNotFound, PersistenceError]),
  input: Schema.Struct({
    id: StudentId,
  }),
  output: StudentSchema,
});

export const createCourseContract = defineContract("createCourse", {
  annotations: {
    idempotent: false,
    readOnly: false,
    destructive: false,
  },
  description: "Create a new course",
  failure: Schema.Union([DuplicateCourse, PersistenceError]),
  input: Schema.Struct({
    name: Schema.String,
    code: Schema.String,
  }),
  output: CourseSchema,
});

export const listCoursesContract = defineContract("listCourses", {
  annotations: {
    idempotent: true,
    readOnly: true,
    destructive: false,
  },
  description: "List available courses",
  failure: PersistenceError,
  input: Schema.Struct({}),
  output: Schema.Array(CourseSchema),
});

export const recordGradeContract = defineContract("recordGrade", {
  annotations: {
    idempotent: false,
    readOnly: false,
    destructive: false,
  },
  description: "Record a grade for a student in a course",
  failure: Schema.Union([
    StudentNotFound,
    CourseNotFound,
    InvalidGrade,
    PersistenceError,
  ]),
  input: Schema.Struct({
    studentId: StudentId,
    courseId: CourseId,
    value: Schema.Number,
  }),
  output: GradeSchema,
});

export const getGradesForStudentContract = defineContract(
  "getGradesForStudent",
  {
    annotations: {
      idempotent: true,
      readOnly: true,
      destructive: false,
    },
    description: "List all grades for a student",
    failure: Schema.Union([StudentNotFound, PersistenceError]),
    input: Schema.Struct({
      studentId: StudentId,
    }),
    output: Schema.Array(GradeSchema),
  }
);