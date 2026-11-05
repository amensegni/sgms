import { Context, Effect, Layer, Schema } from "effect";
import {
  defineContract,
  implement,
  PersistenceError,
} from "./contracts.js";

export const AssessmentCategorySchema = Schema.Literals([
  "MID_EXAM",
  "FINAL_EXAM",
  "CLASS_ACTIVITY",
]);
export type AssessmentCategory = typeof AssessmentCategorySchema.Type;

export const TeacherSummarySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});

export const SectionSummarySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

export const StudentEnrollmentSchema = Schema.Struct({
  id: Schema.String,
  studentId: Schema.String,
  name: Schema.String,
  email: Schema.String,
  sectionId: Schema.String,
  sectionName: Schema.String,
});

export const AssessmentSchema = Schema.Struct({
  id: Schema.String,
  courseId: Schema.String,
  category: AssessmentCategorySchema,
  title: Schema.String,
  maxScore: Schema.Int,
  occurredAt: Schema.String,
});
export type Assessment = typeof AssessmentSchema.Type;

export const AssessmentResultSchema = Schema.Struct({
  id: Schema.String,
  assessmentId: Schema.String,
  enrollmentId: Schema.String,
  score: Schema.Int,
});
export type AssessmentResult = typeof AssessmentResultSchema.Type;

export const CourseGradebookSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  code: Schema.String,
  sections: Schema.Array(SectionSummarySchema),
  students: Schema.Array(StudentEnrollmentSchema),
  assessments: Schema.Array(AssessmentSchema),
  results: Schema.Array(AssessmentResultSchema),
});

export const TeacherDashboardSchema = Schema.Struct({
  teacher: TeacherSummarySchema,
  courses: Schema.Array(CourseGradebookSchema),
});
export type TeacherDashboard = typeof TeacherDashboardSchema.Type;

export class TeacherNotFound extends Schema.TaggedError<TeacherNotFound>()(
  "TeacherNotFound",
  { teacherId: Schema.String }
) {}

export class GradebookCourseNotFound extends Schema.TaggedError<GradebookCourseNotFound>()(
  "GradebookCourseNotFound",
  { courseId: Schema.String }
) {}

export class AssessmentNotFound extends Schema.TaggedError<AssessmentNotFound>()(
  "AssessmentNotFound",
  { assessmentId: Schema.String }
) {}

export class StudentNotEnrolled extends Schema.TaggedError<StudentNotEnrolled>()(
  "StudentNotEnrolled",
  { studentId: Schema.String, courseId: Schema.String }
) {}

export class InvalidAssessment extends Schema.TaggedError<InvalidAssessment>()(
  "InvalidAssessment",
  { reason: Schema.String }
) {}

export class DuplicateExam extends Schema.TaggedError<DuplicateExam>()(
  "DuplicateExam",
  { courseId: Schema.String, category: AssessmentCategorySchema }
) {}

export class InvalidAssessmentScore extends Schema.TaggedError<InvalidAssessmentScore>()(
  "InvalidAssessmentScore",
  { reason: Schema.String }
) {}

export interface NewAssessment {
  readonly courseId: string;
  readonly category: AssessmentCategory;
  readonly title: string;
  readonly maxScore: number;
  readonly occurredAt: string;
}

export interface AssessmentScoringContext {
  readonly assessment: Assessment;
  readonly courseId: string;
}

export interface CourseGradebookRepositoryApi {
  readonly loadForTeacher: (
    teacherId: string
  ) => Effect.Effect<TeacherDashboard | undefined, PersistenceError>;
  readonly courseIsTaughtBy: (
    teacherId: string,
    courseId: string
  ) => Effect.Effect<boolean, PersistenceError>;
  readonly hasExam: (
    courseId: string,
    category: "MID_EXAM" | "FINAL_EXAM"
  ) => Effect.Effect<boolean, PersistenceError>;
  readonly createAssessment: (
    input: NewAssessment
  ) => Effect.Effect<Assessment, PersistenceError>;
  readonly findAssessment: (
    assessmentId: string
  ) => Effect.Effect<AssessmentScoringContext | undefined, PersistenceError>;
  readonly isEnrolledInCourse: (
    studentId: string,
    courseId: string
  ) => Effect.Effect<boolean, PersistenceError>;
  readonly saveResult: (
    input: {
      readonly assessmentId: string;
      readonly studentId: string;
      readonly score: number;
    }
  ) => Effect.Effect<AssessmentResult, PersistenceError>;
}

export class CourseGradebookRepository extends Context.Service<
  CourseGradebookRepository,
  CourseGradebookRepositoryApi
>()("CourseGradebookRepository") {}

export interface CourseGradebookServiceApi {
  readonly loadForTeacher: (
    teacherId: string
  ) => Effect.Effect<TeacherDashboard, TeacherNotFound | PersistenceError>;
  readonly createAssessment: (
    input: NewAssessment & { readonly teacherId: string }
  ) => Effect.Effect<
    Assessment,
    GradebookCourseNotFound | DuplicateExam | InvalidAssessment | PersistenceError
  >;
  readonly recordResult: (input: {
    readonly teacherId: string;
    readonly assessmentId: string;
    readonly studentId: string;
    readonly score: number;
  }) => Effect.Effect<
    AssessmentResult,
    AssessmentNotFound | GradebookCourseNotFound | StudentNotEnrolled | InvalidAssessmentScore | PersistenceError
  >;
}

export class CourseGradebookService extends Context.Service<
  CourseGradebookService,
  CourseGradebookServiceApi
>()("CourseGradebookService") {}

export const CourseGradebookServiceLayer = Layer.effect(
  CourseGradebookService,
  Effect.gen(function* () {
    const repository = yield* CourseGradebookRepository;
    return {
      loadForTeacher: (teacherId) =>
        Effect.gen(function* () {
          const dashboard = yield* repository.loadForTeacher(teacherId);
          if (!dashboard) {
            return yield* new TeacherNotFound({ teacherId });
          }
          return dashboard;
        }),
      createAssessment: (input) =>
        Effect.gen(function* () {
          const title = input.title.trim();
          if (
            !title ||
            !Number.isInteger(input.maxScore) ||
            input.maxScore <= 0 ||
            Number.isNaN(Date.parse(input.occurredAt))
          ) {
            return yield* new InvalidAssessment({
              reason: "Enter a title, a positive whole-number maximum score, and a valid date.",
            });
          }
          if (!(yield* repository.courseIsTaughtBy(input.teacherId, input.courseId))) {
            return yield* new GradebookCourseNotFound({ courseId: input.courseId });
          }
          if (
            input.category !== "CLASS_ACTIVITY" &&
            (yield* repository.hasExam(input.courseId, input.category))
          ) {
            return yield* new DuplicateExam({
              courseId: input.courseId,
              category: input.category,
            });
          }
          return yield* repository.createAssessment({
            courseId: input.courseId,
            category: input.category,
            title,
            maxScore: input.maxScore,
            occurredAt: new Date(input.occurredAt).toISOString(),
          });
        }),
      recordResult: (input) =>
        Effect.gen(function* () {
          if (!Number.isInteger(input.score) || input.score < 0) {
            return yield* new InvalidAssessmentScore({
              reason: "Score must be a non-negative whole number.",
            });
          }
          const context = yield* repository.findAssessment(input.assessmentId);
          if (!context) {
            return yield* new AssessmentNotFound({ assessmentId: input.assessmentId });
          }
          if (
            !(yield* repository.courseIsTaughtBy(
              input.teacherId,
              context.courseId
            ))
          ) {
            return yield* new GradebookCourseNotFound({
              courseId: context.courseId,
            });
          }
          if (
            !(yield* repository.isEnrolledInCourse(
              input.studentId,
              context.courseId
            ))
          ) {
            return yield* new StudentNotEnrolled({
              studentId: input.studentId,
              courseId: context.courseId,
            });
          }
          if (input.score > context.assessment.maxScore) {
            return yield* new InvalidAssessmentScore({
              reason: `Score cannot exceed ${context.assessment.maxScore}.`,
            });
          }
          return yield* repository.saveResult({
            assessmentId: input.assessmentId,
            studentId: input.studentId,
            score: input.score,
          });
        }),
    } satisfies CourseGradebookServiceApi;
  })
);

export const getTeacherDashboardContract = defineContract(
  "getTeacherDashboard",
  {
    annotations: { readOnly: true },
    description: "Load a teacher's course gradebooks and enrolled students",
    failure: Schema.Union([TeacherNotFound, PersistenceError]),
    input: Schema.Struct({ teacherId: Schema.String }),
    output: TeacherDashboardSchema,
  }
);

export const createAssessmentContract = defineContract("createAssessment", {
  annotations: { idempotent: false },
  description: "Create an exam or class activity in a teacher's course",
  failure: Schema.Union([
    GradebookCourseNotFound,
    DuplicateExam,
    InvalidAssessment,
    PersistenceError,
  ]),
  input: Schema.Struct({
    teacherId: Schema.String,
    courseId: Schema.String,
    category: AssessmentCategorySchema,
    title: Schema.String,
    maxScore: Schema.Int,
    occurredAt: Schema.String,
  }),
  output: AssessmentSchema,
});

export const recordAssessmentResultContract = defineContract(
  "recordAssessmentResult",
  {
    annotations: { idempotent: true },
    description: "Record or update an enrolled student's score for an assessment",
    failure: Schema.Union([
      AssessmentNotFound,
      GradebookCourseNotFound,
      StudentNotEnrolled,
      InvalidAssessmentScore,
      PersistenceError,
    ]),
    input: Schema.Struct({
      teacherId: Schema.String,
      assessmentId: Schema.String,
      studentId: Schema.String,
      score: Schema.Int,
    }),
    output: AssessmentResultSchema,
  }
);

export const getTeacherDashboard = implement(
  getTeacherDashboardContract,
  ({ teacherId }) =>
    Effect.gen(function* () {
      const service = yield* CourseGradebookService;
      return yield* service.loadForTeacher(teacherId);
    })
);

export const createAssessment = implement(
  createAssessmentContract,
  (input) =>
    Effect.gen(function* () {
      const service = yield* CourseGradebookService;
      return yield* service.createAssessment(input);
    })
);

export const recordAssessmentResult = implement(
  recordAssessmentResultContract,
  (input) =>
    Effect.gen(function* () {
      const service = yield* CourseGradebookService;
      return yield* service.recordResult(input);
    })
);

export const gradebookCapabilities = [
  getTeacherDashboard,
  createAssessment,
  recordAssessmentResult,
] as const;
