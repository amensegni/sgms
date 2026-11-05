import { Effect, Schema } from "effect";
import {
  AssessmentSchema,
  AssessmentResultSchema,
  TeacherDashboardSchema,
} from "@sgms/core";
import { Command, Runtime, Update } from "foldkit";
import * as Dom from "foldkit/dom";
import { defineMessageUnion } from "foldkit/message";
import type { HtmlBuilder } from "foldkit/html";

type Dashboard = typeof TeacherDashboardSchema.Type;
type CourseGradebook = Dashboard["courses"][number];
type Assessment = typeof AssessmentSchema.Type;
type AssessmentResult = typeof AssessmentResultSchema.Type;

const PageSchema = Schema.Literals(["gradebook", "assessments"]);
const DialogKindSchema = Schema.Literals(["none", "score", "activity"]);
const OperationStatusSchema = Schema.Literals(["idle", "loading", "saving"]);

export const AppModelSchema = Schema.Struct({
  dashboard: Schema.NullOr(TeacherDashboardSchema),
  selectedSectionId: Schema.NullOr(Schema.String),
  studentQuery: Schema.String,
  page: PageSchema,
  dialog: DialogKindSchema,
  dialogStudentId: Schema.String,
  dialogAssessmentId: Schema.String,
  activityTitle: Schema.String,
  activityMaxScore: Schema.String,
  activityDate: Schema.String,
  scoreValue: Schema.String,
  status: OperationStatusSchema,
  error: Schema.NullOr(Schema.String),
  notice: Schema.NullOr(Schema.String),
});
type AppModel = typeof AppModelSchema.Type;

const today = new Date().toISOString().slice(0, 10);

export const initialModel: AppModel = {
  dashboard: null,
  selectedSectionId: null,
  studentQuery: "",
  page: "gradebook",
  dialog: "none",
  dialogStudentId: "",
  dialogAssessmentId: "",
  activityTitle: "",
  activityMaxScore: "10",
  activityDate: today,
  scoreValue: "",
  status: "loading",
  error: null,
  notice: null,
};

export const Message = defineMessageUnion({
  DashboardLoaded: { dashboard: TeacherDashboardSchema },
  PageSelected: { page: PageSchema },
  SectionSelected: { sectionId: Schema.String },
  StudentSearchChanged: { value: Schema.String },
  OpenScoreDialog: { studentId: Schema.String, assessmentId: Schema.String },
  OpenActivityDialog: {},
  DialogClosed: {},
  DialogEffectCompleted: {},
  DialogEffectFailed: { message: Schema.String },
  AssessmentSelected: { assessmentId: Schema.String },
  ScoreValueChanged: { value: Schema.String },
  ActivityTitleChanged: { value: Schema.String },
  ActivityMaxScoreChanged: { value: Schema.String },
  ActivityDateChanged: { value: Schema.String },
  RetryClicked: {},
  ScoreSubmitted: {},
  ActivitySubmitted: {},
  ScoreSaved: { result: AssessmentResultSchema },
  ActivityCreated: { courseId: Schema.String, assessment: AssessmentSchema },
  OperationFailed: { message: Schema.String },
});
type AppMessage = typeof Message.Type;

const requestJson = <S extends Schema.ConstraintDecoder<unknown>>(
  path: string,
  schema: S,
  init?: RequestInit
) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(path, {
        ...init,
        headers: { "content-type": "application/json", ...init?.headers },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as
          | { error?: string; message?: string }
          | undefined;
        throw new Error(
          body?.message ?? body?.error ?? `Request failed (${response.status})`
        );
      }
      return Schema.decodeUnknownSync(schema)(await response.json());
    },
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
  });

const commandResult = <A, M extends AppMessage>(
  effect: Effect.Effect<A, Error>,
  succeed: (value: A) => M
): Effect.Effect<M | ReturnType<typeof Message.OperationFailed>> =>
  Effect.match(effect, {
    onFailure: (error) => Message.OperationFailed({ message: error.message }),
    onSuccess: succeed,
  });

export const LoadDashboard = Command.define("LoadDashboard", {
  messages: [Message.DashboardLoaded, Message.OperationFailed],
  execute: commandResult(
    requestJson(
      "/api/teachers/bits-demo-teacher/dashboard",
      TeacherDashboardSchema
    ),
    (dashboard) => Message.DashboardLoaded({ dashboard })
  ),
});

const ShowActionDialog = Command.define("ShowActionDialog", {
  messages: [Message.DialogEffectCompleted, Message.DialogEffectFailed],
  execute: Effect.match(Dom.showDialog("#action-dialog", { isModal: true }), {
    onFailure: (cause) =>
      Message.DialogEffectFailed({ message: String(cause) }),
    onSuccess: () => Message.DialogEffectCompleted({}),
  }),
});

const CloseActionDialog = Command.define("CloseActionDialog", {
  messages: [Message.DialogEffectCompleted, Message.DialogEffectFailed],
  execute: Effect.match(Dom.closeDialog("#action-dialog"), {
    onFailure: (cause) =>
      Message.DialogEffectFailed({ message: String(cause) }),
    onSuccess: () => Message.DialogEffectCompleted({}),
  }),
});

export const SaveAssessmentResult = Command.define("SaveAssessmentResult", {
  args: {
    assessmentId: Schema.String,
    studentId: Schema.String,
    score: Schema.Number,
  },
  messages: [Message.ScoreSaved, Message.OperationFailed],
  execute: ({ assessmentId, studentId, score }) =>
    commandResult(
      requestJson(
        `/api/assessments/${encodeURIComponent(assessmentId)}/results/${encodeURIComponent(studentId)}`,
        AssessmentResultSchema,
        {
          method: "PUT",
          body: JSON.stringify({ score }),
        }
      ),
      (result) => Message.ScoreSaved({ result })
    ),
});

export const CreateClassActivity = Command.define("CreateClassActivity", {
  args: {
    courseId: Schema.String,
    title: Schema.String,
    maxScore: Schema.Number,
    occurredAt: Schema.String,
  },
  messages: [Message.ActivityCreated, Message.OperationFailed],
  execute: ({ courseId, title, maxScore, occurredAt }) =>
    commandResult(
      requestJson(
        `/api/courses/${encodeURIComponent(courseId)}/assessments`,
        AssessmentSchema,
        {
          method: "POST",
          body: JSON.stringify({
            category: "CLASS_ACTIVITY",
            title,
            maxScore,
            occurredAt,
          }),
        }
      ),
      (assessment) => Message.ActivityCreated({ courseId, assessment })
    ),
});

export const init: Runtime.ApplicationInit<AppModel, AppMessage> = () => ({
  model: initialModel,
  commands: [LoadDashboard()],
});

const currentCourse = (model: AppModel): CourseGradebook | undefined =>
  model.dashboard?.courses[0];

export const update = (
  model: AppModel,
  message: AppMessage
): Update.Return<AppModel, AppMessage> => {
  switch (message._tag) {
    case "DashboardLoaded":
      return {
        model: {
          ...model,
          dashboard: message.dashboard,
          status: "idle",
          error: null,
        },
      };
    case "PageSelected":
      return { model: { ...model, page: message.page, error: null, notice: null } };
    case "SectionSelected":
      return {
        model: {
          ...model,
          selectedSectionId: message.sectionId || null,
          error: null,
        },
      };
    case "StudentSearchChanged":
      return {
        model: { ...model, studentQuery: message.value },
      };
    case "OpenScoreDialog":
      return {
        model: {
          ...model,
          dialog: "score",
          dialogStudentId: message.studentId,
          dialogAssessmentId: message.assessmentId,
          scoreValue: "",
          error: null,
          notice: null,
        },
        commands: [ShowActionDialog()],
      };
    case "OpenActivityDialog":
      return {
        model: {
          ...model,
          dialog: "activity",
          activityTitle: "",
          activityMaxScore: "10",
          activityDate: today,
          error: null,
          notice: null,
        },
        commands: [ShowActionDialog()],
      };
    case "DialogClosed":
      return {
        model: { ...model, dialog: "none", error: null },
        commands: [CloseActionDialog()],
      };
    case "DialogEffectCompleted":
      return { model };
    case "DialogEffectFailed":
      return {
        model: {
          ...model,
          dialog: "none",
          status: "idle",
          error: message.message,
          notice: null,
        },
      };
    case "RetryClicked":
      return {
        model: { ...model, status: "loading", error: null, notice: null },
        commands: [LoadDashboard()],
      };
    case "AssessmentSelected":
      return { model: { ...model, dialogAssessmentId: message.assessmentId } };
    case "ScoreValueChanged":
      return { model: { ...model, scoreValue: message.value, error: null } };
    case "ActivityTitleChanged":
      return { model: { ...model, activityTitle: message.value, error: null } };
    case "ActivityMaxScoreChanged":
      return { model: { ...model, activityMaxScore: message.value, error: null } };
    case "ActivityDateChanged":
      return { model: { ...model, activityDate: message.value, error: null } };
    case "ScoreSubmitted": {
      const course = currentCourse(model);
      const student = course?.students.find(
        (item) => item.studentId === model.dialogStudentId
      );
      const assessment = course?.assessments.find(
        (item) => item.id === model.dialogAssessmentId
      );
      const score = Number(model.scoreValue);
      if (!student || !assessment || !Number.isInteger(score) || score < 0) {
        return { model: { ...model, error: "Choose an assessment and enter a whole-number score." } };
      }
      if (score > assessment.maxScore) {
        return {
          model: {
            ...model,
            error: `Score cannot exceed ${assessment.maxScore}.`,
          },
        };
      }
      return {
        model: { ...model, status: "saving", error: null },
        commands: [
          SaveAssessmentResult({
            assessmentId: assessment.id,
            studentId: student.studentId,
            score,
          }),
        ],
      };
    }
    case "ActivitySubmitted": {
      const course = currentCourse(model);
      const maxScore = Number(model.activityMaxScore);
      if (
        !course ||
        !model.activityTitle.trim() ||
        !Number.isInteger(maxScore) ||
        maxScore <= 0 ||
        !model.activityDate
      ) {
        return {
          model: {
            ...model,
            error: "Enter an activity name, a positive maximum score, and a date.",
          },
        };
      }
      return {
        model: { ...model, status: "saving", error: null },
        commands: [
          CreateClassActivity({
            courseId: course.id,
            title: model.activityTitle.trim(),
            maxScore,
            occurredAt: new Date(`${model.activityDate}T09:00:00`).toISOString(),
          }),
        ],
      };
    }
    case "ScoreSaved": {
      const dashboard = model.dashboard;
      const course = currentCourse(model);
      if (!dashboard || !course) {
        return {
          model: { ...model, status: "idle", error: "The gradebook is not loaded." },
        };
      }
      const results = course.results.filter(
        (result) =>
          result.assessmentId !== message.result.assessmentId ||
          result.enrollmentId !== message.result.enrollmentId
      );
      return {
        model: {
          ...model,
          dashboard: {
            ...dashboard,
            courses: dashboard.courses.map((item) =>
              item.id === course.id
                ? { ...item, results: [...results, message.result] }
                : item
            ),
          },
          dialog: "none",
          status: "idle",
          error: null,
          notice: "Score saved.",
        },
        commands: [CloseActionDialog()],
      };
    }
    case "ActivityCreated": {
      const dashboard = model.dashboard;
      if (!dashboard) {
        return {
          model: { ...model, status: "idle", error: "The gradebook is not loaded." },
        };
      }
      return {
        model: {
          ...model,
          dashboard: {
            ...dashboard,
            courses: dashboard.courses.map((course) =>
              course.id === message.courseId
                ? {
                    ...course,
                    assessments: [...course.assessments, message.assessment].sort(
                      (left, right) =>
                        left.occurredAt.localeCompare(right.occurredAt)
                    ),
                  }
                : course
            ),
          },
          dialog: "none",
          page: "assessments",
          status: "idle",
          error: null,
          notice: "Class activity added.",
        },
        commands: [CloseActionDialog()],
      };
    }
    case "OperationFailed":
      return {
        model: { ...model, status: "idle", error: message.message, notice: null },
      };
  }
};

const assessmentLabel = (category: Assessment["category"]) => {
  switch (category) {
    case "MID_EXAM":
      return "Mid exam";
    case "FINAL_EXAM":
      return "Final exam";
    case "CLASS_ACTIVITY":
      return "Class activity";
  }
};

const getResult = (
  course: CourseGradebook,
  assessmentId: string,
  enrollmentId: string
): AssessmentResult | undefined =>
  course.results.find(
    (result) =>
      result.assessmentId === assessmentId &&
      result.enrollmentId === enrollmentId
  );

const scoreCell = (
  h: HtmlBuilder<AppMessage>,
  course: CourseGradebook,
  student: CourseGradebook["students"][number],
  category: "MID_EXAM" | "FINAL_EXAM"
) => {
  const assessment = course.assessments.find((item) => item.category === category);
  if (!assessment) {
    return h.td([h.Class("score-cell score-cell-empty")], [
      h.span([], ["Not set"]),
    ]);
  }
  const result = getResult(course, assessment.id, student.id);
  return h.td([h.Class("score-cell")], [
    h.button(
      [
        h.Class(result ? "score-value" : "score-value score-value-missing"),
        h.OnClick(
          Message.OpenScoreDialog({
            studentId: student.studentId,
            assessmentId: assessment.id,
          })
        ),
      ],
      [result ? `${result.score} / ${assessment.maxScore}` : "Add score"]
    ),
  ]);
};

const studentScoreCard = (
  h: HtmlBuilder<AppMessage>,
  course: CourseGradebook,
  student: CourseGradebook["students"][number],
  category: "MID_EXAM" | "FINAL_EXAM"
) => {
  const assessment = course.assessments.find((item) => item.category === category);
  const result = assessment
    ? getResult(course, assessment.id, student.id)
    : undefined;
  return h.div([h.Class("mobile-score")], [
    h.span([], [category === "MID_EXAM" ? "Mid exam" : "Final exam"]),
    assessment
      ? h.button(
          [
            h.Class(result ? "score-value" : "score-value score-value-missing"),
            h.OnClick(
              Message.OpenScoreDialog({
                studentId: student.studentId,
                assessmentId: assessment.id,
              })
            ),
          ],
          [result ? `${result.score} / ${assessment.maxScore}` : "Add score"]
        )
      : h.span([h.Class("score-cell-empty")], ["Not set"]),
  ]);
};

const renderGradebook = (
  model: AppModel,
  h: HtmlBuilder<AppMessage>,
  course: CourseGradebook
) => {
  const students = course.students.filter(
    (student) => {
      const matchesSection =
        model.selectedSectionId === null ||
        student.sectionId === model.selectedSectionId;
      const query = model.studentQuery.trim().toLocaleLowerCase();
      const matchesQuery =
        !query ||
        [student.name, student.studentId, student.email, student.sectionName]
          .some((value) => value.toLocaleLowerCase().includes(query));
      return matchesSection && matchesQuery;
    }
  );
  const activityAssessments = course.assessments.filter(
    (assessment) => assessment.category === "CLASS_ACTIVITY"
  );
  const midExam = course.assessments.find(
    (assessment) => assessment.category === "MID_EXAM"
  );
  const finalExam = course.assessments.find(
    (assessment) => assessment.category === "FINAL_EXAM"
  );
  const completionCount = course.results.length;
  const possibleCount = course.students.length * course.assessments.length;

  return h.div([h.Class("page-stack")], [
    h.section([h.Class("summary-grid"), h.AriaLabel("Gradebook summary")], [
      h.div([h.Class("summary-card summary-card-primary")], [
        h.span([h.Class("summary-label")], ["Enrolled students"]),
        h.strong([h.Class("summary-value")], [String(course.students.length)]),
        h.span([h.Class("summary-note")], [
          `${course.sections.length} sections`,
        ]),
      ]),
      h.div([h.Class("summary-card")], [
        h.span([h.Class("summary-label")], ["Assessments"]),
        h.strong([h.Class("summary-value")], [
          String(course.assessments.length),
        ]),
        h.span([h.Class("summary-note")], [
          `${activityAssessments.length} class activities`,
        ]),
      ]),
      h.div([h.Class("summary-card")], [
        h.span([h.Class("summary-label")], ["Scores recorded"]),
        h.strong([h.Class("summary-value")], [
          possibleCount === 0
            ? "0%"
            : `${Math.round((completionCount / possibleCount) * 100)}%`,
        ]),
        h.span([h.Class("summary-note")], [
          `${completionCount} of ${possibleCount}`,
        ]),
      ]),
    ]),
    h.section([h.Class("table-panel"), h.AriaLabel("Student gradebook")], [
      h.div([h.Class("table-toolbar")], [
        h.div([], [
          h.h2([], ["Student grades"]),
          h.p([], ["Mid and final exams, plus ongoing class activity."]),
        ]),
        h.div([h.Class("toolbar-actions")], [
          h.label([h.Class("student-search")], [
            h.span([], ["Search students"]),
            h.input([
              h.Type("search"),
              h.Value(model.studentQuery),
              h.Placeholder("Name or student ID"),
              h.OnInput((value) =>
                Message.StudentSearchChanged({ value })
              ),
            ]),
          ]),
          h.label([h.Class("filter-control")], [
            h.span([], ["Section"]),
            h.select(
              [
                h.Value(model.selectedSectionId ?? ""),
                h.OnChange((sectionId) =>
                  Message.SectionSelected({ sectionId })
                ),
              ],
              [
                h.option([h.Value("")], ["All sections"]),
                ...course.sections.map((section) =>
                  h.option([h.Value(section.id)], [section.name])
                ),
              ]
            ),
          ]),
          h.button(
            [
              h.Class("button button-primary"),
              h.Disabled(model.status === "saving"),
              h.OnClick(Message.OpenActivityDialog()),
            ],
            ["Add class activity"]
          ),
        ]),
      ]),
      h.div([h.Class("mobile-roster")], students.length
        ? students.map((student) => {
            const activityResults = activityAssessments.flatMap(
              (assessment) => {
                const result = getResult(course, assessment.id, student.id);
                return result ? [{ result, assessment }] : [];
              }
            );
            const earned = activityResults.reduce(
              (sum, item) => sum + item.result.score,
              0
            );
            const possible = activityResults.reduce(
              (sum, item) => sum + item.assessment.maxScore,
              0
            );
            const activityAverage =
              possible === 0 ? null : Math.round((earned / possible) * 100);
            const defaultAssessmentId =
              activityAssessments[0]?.id ?? midExam?.id ?? finalExam?.id ?? "";
            return h.article([h.Class("mobile-student-card")], [
              h.div([h.Class("mobile-student-heading")], [
                h.strong([], [student.name]),
                h.span([h.Class("section-pill")], [student.sectionName]),
              ]),
              h.div([h.Class("mobile-score-grid")], [
                studentScoreCard(h, course, student, "MID_EXAM"),
                studentScoreCard(h, course, student, "FINAL_EXAM"),
              ]),
              h.div([h.Class("mobile-activity")], [
                h.span([], ["Class activity"]),
                h.strong([], [
                  activityAverage === null
                    ? "No scores"
                    : `${activityAverage}%`,
                ]),
                h.small([], [
                  `${activityResults.length} of ${activityAssessments.length} recorded`,
                ]),
              ]),
              h.button(
                [
                  h.Class("button button-quiet mobile-record-score"),
                  h.Disabled(defaultAssessmentId === ""),
                  h.OnClick(
                    Message.OpenScoreDialog({
                      studentId: student.studentId,
                      assessmentId: defaultAssessmentId,
                    })
                  ),
                ],
                ["Record another score"]
              ),
            ]);
          })
        : [
            h.div([h.Class("mobile-empty-table")], [
              model.studentQuery.trim()
                ? `No students match “${model.studentQuery.trim()}”.`
                : model.selectedSectionId
                  ? "No students are enrolled in this section yet."
                  : "No students are enrolled in this course yet.",
              model.studentQuery.trim()
                ? h.button(
                    [
                      h.Class("button button-quiet"),
                      h.OnClick(Message.StudentSearchChanged({ value: "" })),
                    ],
                    ["Clear search"]
                  )
                : null,
            ]),
          ]),
      h.div([h.Class("table-scroll")], [
        h.table([h.Class("grade-table")], [
          h.thead([], [
            h.tr([], [
              h.th([h.Scope("col")], ["Student"]),
              h.th([h.Scope("col")], ["Section"]),
              h.th([h.Scope("col")], ["Mid exam"]),
              h.th([h.Scope("col")], ["Final exam"]),
              h.th([h.Scope("col")], ["Class activity"]),
              h.th([h.Scope("col")], ["Actions"]),
            ]),
          ]),
          h.tbody([], students.length
            ? students.map((student) => {
                const activityResults = activityAssessments.flatMap(
                  (assessment) => {
                    const result = getResult(course, assessment.id, student.id);
                    return result ? [{ result, assessment }] : [];
                  }
                );
                const earned = activityResults.reduce(
                  (sum, item) => sum + item.result.score,
                  0
                );
                const possible = activityResults.reduce(
                  (sum, item) => sum + item.assessment.maxScore,
                  0
                );
                const activityAverage =
                  possible === 0 ? null : Math.round((earned / possible) * 100);
                const firstActivity = activityAssessments[0];

                return h.tr([], [
                  h.td([], [
                    h.div([h.Class("student-cell")], [
                      h.strong([], [student.name]),
                    ]),
                  ]),
                  h.td([], [
                    h.span([h.Class("section-pill")], [student.sectionName]),
                  ]),
                  scoreCell(h, course, student, "MID_EXAM"),
                  scoreCell(h, course, student, "FINAL_EXAM"),
                  h.td([h.Class("activity-cell")], [
                    h.div([], [
                      h.strong([], [
                        activityAverage === null
                          ? "No scores"
                          : `${activityAverage}%`,
                      ]),
                      h.span([], [
                        `${activityResults.length} of ${activityAssessments.length} recorded`,
                      ]),
                    ]),
                  ]),
                  h.td([h.Class("row-actions")], [
                    h.button(
                      [
                        h.Class("button button-quiet"),
                        h.Disabled(
                          !firstActivity && !midExam && !finalExam
                        ),
                        h.OnClick(
                          Message.OpenScoreDialog({
                            studentId: student.studentId,
                            assessmentId:
                              firstActivity?.id ?? midExam?.id ?? finalExam?.id ?? "",
                          })
                        ),
                      ],
                      ["Record score"]
                    ),
                  ]),
                ]);
              })
            : [
                h.tr([], [
                  h.td([h.Class("empty-table"), h.Colspan(6)], [
                    model.studentQuery.trim()
                      ? `No students match “${model.studentQuery.trim()}”.`
                      : model.selectedSectionId
                        ? "No students are enrolled in this section yet."
                        : "No students are enrolled in this course yet.",
                    model.studentQuery.trim()
                      ? h.button(
                          [
                            h.Class("button button-quiet"),
                            h.OnClick(
                              Message.StudentSearchChanged({ value: "" })
                            ),
                          ],
                          ["Clear search"]
                        )
                      : null,
                  ]),
                ]),
              ]),
        ]),
      ]),
      h.div([h.Class("table-footnote")], [
        "Class activity is shown as a points-weighted average of recorded activities. No overall course grade is calculated.",
      ]),
    ]),
  ]);
};

const renderAssessments = (
  model: AppModel,
  h: HtmlBuilder<AppMessage>,
  course: CourseGradebook
) =>
  h.section([h.Class("table-panel"), h.AriaLabel("Course assessments")], [
    h.div([h.Class("table-toolbar")], [
      h.div([], [
        h.h2([], ["Assessments"]),
        h.p([], ["Manage exams and the activities between them."]),
      ]),
      h.button(
        [
          h.Class("button button-primary"),
          h.Disabled(model.status === "saving"),
          h.OnClick(Message.OpenActivityDialog()),
        ],
        ["Add class activity"]
      ),
    ]),
    h.div([h.Class("assessment-list")], course.assessments.map((assessment) => {
      const recorded = course.results.filter(
        (result) => result.assessmentId === assessment.id
      ).length;
      return h.article([h.Class("assessment-row")], [
        h.div([
          h.Class(
            assessment.category === "CLASS_ACTIVITY"
              ? "assessment-icon assessment-icon-activity"
              : "assessment-icon"
          ),
          h.AriaHidden(true),
        ], [
          assessment.category === "CLASS_ACTIVITY" ? "A" : "E",
        ]),
        h.div([h.Class("assessment-copy")], [
          h.span([h.Class("assessment-kind")], [
            assessmentLabel(assessment.category),
          ]),
          h.strong([], [assessment.title]),
          h.span([], [
            new Date(assessment.occurredAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          ]),
        ]),
        h.div([h.Class("assessment-meta")], [
          h.strong([], [`${assessment.maxScore} pts`]),
          h.span([], [`${recorded} scores entered`]),
        ]),
      ]);
    })),
  ]);

const renderDialog = (model: AppModel, h: HtmlBuilder<AppMessage>) => {
  const course = currentCourse(model);
  if (model.dialog === "none" || !course) {
    return h.dialog(
      [
        h.Id("action-dialog"),
        h.Class("action-dialog"),
        h.AriaLabel("Gradebook action"),
        h.AriaModal(true),
        h.OnCancel(Message.DialogClosed()),
      ],
      []
    );
  }

  if (model.dialog === "activity") {
    return h.dialog(
      [
        h.Id("action-dialog"),
        h.Class("action-dialog"),
        h.AriaLabel("Add class activity"),
        h.AriaModal(true),
        h.OnCancel(Message.DialogClosed()),
      ],
      [
        h.div([h.Class("dialog-header")], [
          h.div([], [
            h.span([h.Class("eyebrow")], ["CLASS ACTIVITY"]),
            h.h2([], ["Add an activity"]),
            h.p([], ["Track the work between the two exams."]),
          ]),
          h.button(
            [
              h.Type("button"),
              h.Class("icon-button"),
              h.AriaLabel("Close dialog"),
              h.OnClick(Message.DialogClosed()),
            ],
            ["×"]
          ),
        ]),
        h.form([h.OnSubmit(Message.ActivitySubmitted())], [
          h.label([], [
            h.span([], ["Activity name"]),
            h.input([
              h.Type("text"),
              h.Value(model.activityTitle),
              h.Placeholder("e.g. Programming lab"),
              h.OnInput((value) =>
                Message.ActivityTitleChanged({ value })
              ),
            ]),
          ]),
          h.div([h.Class("form-row")], [
            h.label([], [
              h.span([], ["Maximum points"]),
              h.input([
                h.Type("number"),
                h.Value(model.activityMaxScore),
                h.OnInput((value) =>
                  Message.ActivityMaxScoreChanged({ value })
                ),
              ]),
            ]),
            h.label([], [
              h.span([], ["Date"]),
              h.input([
                h.Type("date"),
                h.Value(model.activityDate),
                h.OnInput((value) =>
                  Message.ActivityDateChanged({ value })
                ),
              ]),
            ]),
          ]),
          model.error
            ? h.p([h.Class("form-error"), h.Role("alert")], [model.error])
            : null,
          h.div([h.Class("dialog-actions")], [
            h.button(
              [
                h.Type("button"),
                h.Class("button button-quiet"),
                h.OnClick(Message.DialogClosed()),
              ],
              ["Cancel"]
            ),
            h.button(
              [
                h.Type("submit"),
                h.Class("button button-primary"),
                h.Disabled(model.status === "saving"),
              ],
              [model.status === "saving" ? "Adding…" : "Add activity"]
            ),
          ]),
        ]),
      ]
    );
  }

  const student = course.students.find(
    (item) => item.studentId === model.dialogStudentId
  );
  const eligibleAssessments = course.assessments;
  const selectedAssessment = eligibleAssessments.find(
    (item) => item.id === model.dialogAssessmentId
  );

  return h.dialog(
    [
      h.Id("action-dialog"),
      h.Class("action-dialog"),
      h.AriaLabel("Record assessment score"),
      h.AriaModal(true),
      h.OnCancel(Message.DialogClosed()),
    ],
    [
      h.div([h.Class("dialog-header")], [
        h.div([], [
          h.span([h.Class("eyebrow")], ["Gradebook"]),
          h.h2([], ["Record a score"]),
          h.p([], [student ? `${student.name} · ${student.sectionName}` : "Choose an assessment score."]),
        ]),
        h.button(
          [
            h.Type("button"),
            h.Class("icon-button"),
            h.AriaLabel("Close dialog"),
            h.OnClick(Message.DialogClosed()),
          ],
          ["×"]
        ),
      ]),
      h.form([h.OnSubmit(Message.ScoreSubmitted())], [
        h.label([], [
          h.span([], ["Assessment"]),
          h.select(
            [
              h.Value(model.dialogAssessmentId),
              h.OnChange((assessmentId) =>
                Message.AssessmentSelected({ assessmentId })
              ),
            ],
            eligibleAssessments.map((assessment) =>
              h.option(
                [h.Value(assessment.id)],
                [`${assessmentLabel(assessment.category)} · ${assessment.title}`]
              )
            )
          ),
        ]),
        h.label([], [
          h.span([], ["Score"]),
          h.input([
            h.Type("number"),
            h.Value(model.scoreValue),
            h.OnInput((value) => Message.ScoreValueChanged({ value })),
          ]),
          selectedAssessment
            ? h.small([], [`Whole number from 0 to ${selectedAssessment.maxScore}`])
            : null,
        ]),
        model.error
          ? h.p([h.Class("form-error"), h.Role("alert")], [model.error])
          : null,
        h.div([h.Class("dialog-actions")], [
          h.button(
            [
              h.Type("button"),
              h.Class("button button-quiet"),
              h.OnClick(Message.DialogClosed()),
            ],
            ["Cancel"]
          ),
          h.button(
            [
              h.Type("submit"),
              h.Class("button button-primary"),
              h.Disabled(model.status === "saving"),
            ],
            [model.status === "saving" ? "Saving…" : "Save score"]
          ),
        ]),
      ]),
    ]
  );
};

export const view = (model: AppModel, h: HtmlBuilder<AppMessage>) => {
  const dashboard = model.dashboard;
  const course = currentCourse(model);
  const pageTitle = model.page === "gradebook" ? "Gradebook" : "Assessments";

  return {
    title: "BITS College · Gradebook",
    body: h.div([h.Class("app-shell")], [
      h.a([h.Class("skip-link"), h.Href("#main-content")], [
        "Skip to gradebook",
      ]),
      h.aside([h.Class("sidebar")], [
        h.a([h.Class("college-brand"), h.Href("#main-content")], [
          h.span([], [
            h.strong([], ["BITS College"]),
            h.small([], ["Faculty portal"]),
          ]),
        ]),
        h.nav([h.Class("sidebar-nav"), h.AriaLabel("Main navigation")], [
          h.button(
            [
              h.Class(
                model.page === "gradebook"
                  ? "nav-link nav-link-active"
                  : "nav-link"
              ),
              h.AriaCurrent(model.page === "gradebook" ? "page" : "false"),
              h.OnClick(Message.PageSelected({ page: "gradebook" })),
            ],
            [
              h.span([h.Class("nav-glyph"), h.AriaHidden(true)], ["▦"]),
              "Gradebook",
            ]
          ),
          h.button(
            [
              h.Class(
                model.page === "assessments"
                  ? "nav-link nav-link-active"
                  : "nav-link"
              ),
              h.AriaCurrent(model.page === "assessments" ? "page" : "false"),
              h.OnClick(Message.PageSelected({ page: "assessments" })),
            ],
            [
              h.span([h.Class("nav-glyph"), h.AriaHidden(true)], ["◷"]),
              "Assessments",
            ]
          ),
        ]),
        h.div([h.Class("sidebar-footer")], [
          dashboard
            ? h.details([h.Class("account-menu")], [
                h.summary(
                  [
                    h.Class("account-trigger"),
                    h.AriaLabel(`Account: ${dashboard.teacher.name}`),
                  ],
                  [
                    h.span([h.Class("avatar"), h.AriaHidden(true)], [
                      dashboard.teacher.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join(""),
                    ]),
                    h.span([h.Class("account-copy")], [
                      h.strong([], [dashboard.teacher.name]),
                      h.small([], ["Teacher · Demo account"]),
                    ]),
                    h.span([
                      h.Class("account-chevron"),
                      h.AriaHidden(true),
                    ]),
                  ]
                ),
                h.div([h.Class("account-popover")], [
                  h.span([h.Class("account-popover-label")], [
                    "Faculty account",
                  ]),
                  h.strong([], [dashboard.teacher.name]),
                  h.span([h.Class("account-email")], [
                    dashboard.teacher.email,
                  ]),
                  h.p([], ["Demo account. Sign-in is not enabled."]),
                ]),
              ])
            : h.p([], ["Loading account…"]),
        ]),
      ]),
      h.main([h.Class("main-content"), h.Id("main-content")], [
        h.header([h.Class("page-header")], [
          h.div([], [
            h.span([h.Class("eyebrow")], ["BITS College · Faculty"]),
            h.h1([], [pageTitle]),
            h.p([], [
              course
                ? `${course.name} · ${course.code}`
                : "Loading your course gradebook…",
            ]),
          ]),
        ]),
        model.error && model.dialog === "none"
          ? h.div(
              [h.Class("notice notice-error"), h.Role("alert")],
              [model.error]
            )
          : null,
        model.notice
          ? h.div(
              [h.Class("notice notice-success"), h.Role("status")],
              [model.notice]
            )
          : null,
        model.status === "loading"
          ? h.div([h.Class("loading-state"), h.Role("status")], [
              "Loading gradebook…",
            ])
          : null,
        !dashboard && model.status !== "loading"
          ? h.section([h.Class("empty-state")], [
              h.span([h.Class("empty-mark"), h.AriaHidden(true)], ["!"]),
              h.h2([], ["Gradebook unavailable"]),
              h.p([], [
                model.error ??
                  "The seeded teacher course could not be loaded from SQLite.",
              ]),
              h.button(
                [
                  h.Class("button button-primary"),
                  h.OnClick(Message.RetryClicked()),
                ],
                ["Try again"]
              ),
            ])
          : null,
        dashboard && course
          ? model.page === "gradebook"
            ? renderGradebook(model, h, course)
            : renderAssessments(model, h, course)
          : null,
      ]),
      renderDialog(model, h),
    ]),
  };
};
