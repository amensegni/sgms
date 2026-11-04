import { Effect, Schema } from "effect";
import { Command, Runtime, Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { HtmlBuilder } from "foldkit/html";

const StudentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});
type Student = typeof StudentSchema.Type;

const CourseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  code: Schema.String,
});
type Course = typeof CourseSchema.Type;

const GradeSchema = Schema.Struct({
  id: Schema.String,
  studentId: Schema.String,
  courseId: Schema.String,
  value: Schema.Number,
  letter: Schema.optional(Schema.String),
});
type Grade = typeof GradeSchema.Type;

export const AppModelSchema = Schema.Struct({
  students: Schema.Array(StudentSchema),
  courses: Schema.Array(CourseSchema),
  grades: Schema.Array(GradeSchema),
  selectedStudentId: Schema.NullOr(Schema.String),
  studentName: Schema.String,
  studentEmail: Schema.String,
  courseName: Schema.String,
  courseCode: Schema.String,
  gradeValue: Schema.String,
  gradeCourseId: Schema.String,
  status: Schema.Literals(["idle", "loading"]),
  error: Schema.NullOr(Schema.String),
});
type AppModel = typeof AppModelSchema.Type;

export const initialModel: AppModel = {
  students: [],
  courses: [],
  grades: [],
  selectedStudentId: null,
  studentName: "",
  studentEmail: "",
  courseName: "",
  courseCode: "",
  gradeValue: "",
  gradeCourseId: "",
  status: "loading",
  error: null,
};

export const Message = defineMessageUnion({
  StudentNameChanged: { value: Schema.String },
  StudentEmailChanged: { value: Schema.String },
  CourseNameChanged: { value: Schema.String },
  CourseCodeChanged: { value: Schema.String },
  GradeValueChanged: { value: Schema.String },
  GradeCourseChanged: { value: Schema.String },
  StudentSelected: { id: Schema.String },
  AddStudentClicked: {},
  AddCourseClicked: {},
  RecordGradeClicked: {},
  DataLoaded: {
    students: Schema.Array(StudentSchema),
    courses: Schema.Array(CourseSchema),
  },
  GradesLoaded: { grades: Schema.Array(GradeSchema) },
  StudentCreated: { student: StudentSchema },
  CourseCreated: { course: CourseSchema },
  GradeCreated: { grade: GradeSchema },
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
        const body = await response.json().catch(() => undefined) as { error?: string; message?: string } | undefined;
        throw new Error(body?.message ?? body?.error ?? `Request failed (${response.status})`);
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

export const LoadData = Command.define("LoadData", {
  messages: [Message.DataLoaded, Message.OperationFailed],
  execute: commandResult(
    Effect.all([
      requestJson("/api/students", Schema.Array(StudentSchema)),
      requestJson("/api/courses", Schema.Array(CourseSchema)),
    ]),
    ([students, courses]) => Message.DataLoaded({ students, courses })
  ),
});

export const LoadGrades = Command.define("LoadGrades", {
  args: { studentId: Schema.String },
  messages: [Message.GradesLoaded, Message.OperationFailed],
  execute: ({ studentId }) =>
    commandResult(
      requestJson(
        `/api/students/${encodeURIComponent(studentId)}/grades`,
        Schema.Array(GradeSchema)
      ),
      (grades) => Message.GradesLoaded({ grades })
    ),
});

export const CreateStudent = Command.define("CreateStudent", {
  args: { name: Schema.String, email: Schema.String },
  messages: [Message.StudentCreated, Message.OperationFailed],
  execute: ({ name, email }) =>
    commandResult(
      requestJson("/api/students", StudentSchema, {
        method: "POST",
        body: JSON.stringify({ name, email }),
      }),
      (student) => Message.StudentCreated({ student })
    ),
});

export const CreateCourse = Command.define("CreateCourse", {
  args: { name: Schema.String, code: Schema.String },
  messages: [Message.CourseCreated, Message.OperationFailed],
  execute: ({ name, code }) =>
    commandResult(
      requestJson("/api/courses", CourseSchema, {
        method: "POST",
        body: JSON.stringify({ name, code }),
      }),
      (course) => Message.CourseCreated({ course })
    ),
});

export const RecordGrade = Command.define("RecordGrade", {
  args: { studentId: Schema.String, courseId: Schema.String, value: Schema.Number },
  messages: [Message.GradeCreated, Message.OperationFailed],
  execute: ({ studentId, courseId, value }) =>
    commandResult(
      requestJson("/api/grades", GradeSchema, {
        method: "POST",
        body: JSON.stringify({ studentId, courseId, value }),
      }),
      (grade) => Message.GradeCreated({ grade })
    ),
});

export const init: Runtime.ApplicationInit<AppModel, AppMessage> = () => ({
  model: initialModel,
  commands: [LoadData()],
});

export const update = (
  model: AppModel,
  message: AppMessage
): Update.Return<AppModel, AppMessage> => {
  switch (message._tag) {
    case "StudentNameChanged":
      return { model: { ...model, studentName: message.value, error: null } };
    case "StudentEmailChanged":
      return { model: { ...model, studentEmail: message.value, error: null } };
    case "CourseNameChanged":
      return { model: { ...model, courseName: message.value, error: null } };
    case "CourseCodeChanged":
      return { model: { ...model, courseCode: message.value, error: null } };
    case "GradeValueChanged":
      return { model: { ...model, gradeValue: message.value, error: null } };
    case "GradeCourseChanged":
      return { model: { ...model, gradeCourseId: message.value, error: null } };
    case "StudentSelected":
      return {
        model: { ...model, selectedStudentId: message.id, grades: [], error: null },
        commands: [LoadGrades({ studentId: message.id })],
      };
    case "AddStudentClicked":
      return {
        model: { ...model, status: "loading", error: null },
        commands: [CreateStudent({ name: model.studentName, email: model.studentEmail })],
      };
    case "AddCourseClicked":
      return {
        model: { ...model, status: "loading", error: null },
        commands: [CreateCourse({ name: model.courseName, code: model.courseCode })],
      };
    case "RecordGradeClicked": {
      const studentId = model.selectedStudentId;
      const value = Number(model.gradeValue);
      if (!studentId || !model.gradeCourseId || !Number.isInteger(value)) {
        return { model: { ...model, error: "Select a course and enter a whole-number grade." } };
      }
      return {
        model: { ...model, status: "loading", error: null },
        commands: [RecordGrade({ studentId, courseId: model.gradeCourseId, value })],
      };
    }
    case "DataLoaded":
      return {
        model: {
          ...model,
          students: message.students,
          courses: message.courses,
          status: "idle",
          error: null,
        },
      };
    case "GradesLoaded":
      return { model: { ...model, grades: message.grades, status: "idle", error: null } };
    case "StudentCreated":
      return {
        model: {
          ...model,
          students: [...model.students, message.student],
          selectedStudentId: message.student.id,
          grades: [],
          studentName: "",
          studentEmail: "",
          status: "idle",
          error: null,
        },
        commands: [LoadGrades({ studentId: message.student.id })],
      };
    case "CourseCreated":
      return {
        model: {
          ...model,
          courses: [...model.courses, message.course],
          courseName: "",
          courseCode: "",
          gradeCourseId: message.course.id,
          status: "idle",
          error: null,
        },
      };
    case "GradeCreated":
      return {
        model: {
          ...model,
          grades: [...model.grades, message.grade],
          gradeValue: "",
          status: "idle",
          error: null,
        },
      };
    case "OperationFailed":
      return { model: { ...model, status: "idle", error: message.message } };
  }
};

export const view = (model: AppModel, h: HtmlBuilder<AppMessage>) => ({
  title: "Student Grade Management System",
  body: h.div([h.Class("app")], [
    h.h1([], ["Student Grade Management System"]),
    h.p([], ["Students, courses, and grades are stored in SQLite."]),
    h.section([], [
      h.h2([], ["Add student"]),
      h.input([
        h.Type("text"),
        h.Placeholder("Name"),
        h.Value(model.studentName),
        h.OnInput((value) => Message.StudentNameChanged({ value })),
      ]),
      h.input([
        h.Type("email"),
        h.Placeholder("Email"),
        h.Value(model.studentEmail),
        h.OnInput((value) => Message.StudentEmailChanged({ value })),
      ]),
      h.button([
        h.OnClick(Message.AddStudentClicked()),
        h.Disabled(!model.studentName.trim() || !model.studentEmail.trim()),
      ], ["Add student"]),
    ]),
    h.section([], [
      h.h2([], ["Add course"]),
      h.input([
        h.Type("text"),
        h.Placeholder("Course name"),
        h.Value(model.courseName),
        h.OnInput((value) => Message.CourseNameChanged({ value })),
      ]),
      h.input([
        h.Type("text"),
        h.Placeholder("Course code"),
        h.Value(model.courseCode),
        h.OnInput((value) => Message.CourseCodeChanged({ value })),
      ]),
      h.button([
        h.OnClick(Message.AddCourseClicked()),
        h.Disabled(!model.courseName.trim() || !model.courseCode.trim()),
      ], ["Add course"]),
    ]),
    h.section([], [
      h.h2([], ["Students"]),
      h.ul([], model.students.map((student) =>
        h.li([], [
          h.button([
            h.OnClick(Message.StudentSelected({ id: student.id })),
            h.AriaPressed(model.selectedStudentId === student.id ? "true" : "false"),
          ], [`${student.name} (${student.email})`]),
        ])
      )),
    ]),
    model.selectedStudentId
      ? h.section([], [
          h.h2([], ["Record grade"]),
          h.select([
            h.Value(model.gradeCourseId),
            h.OnChange((value) => Message.GradeCourseChanged({ value })),
          ], [
            h.option([h.Value("")], ["Choose course"]),
            ...model.courses.map((course) =>
              h.option([h.Value(course.id)], [`${course.code} — ${course.name}`])
            ),
          ]),
          h.input([
            h.Type("number"),
            h.Placeholder("Grade (0-100)"),
            h.Value(model.gradeValue),
            h.OnInput((value) => Message.GradeValueChanged({ value })),
          ]),
          h.button([
            h.OnClick(Message.RecordGradeClicked()),
            h.Disabled(!model.gradeCourseId || !model.gradeValue),
          ], ["Record grade"]),
          h.h2([], ["Grades"]),
          h.ul([], model.grades.map((grade) => {
            const course = model.courses.find((item) => item.id === grade.courseId);
            return h.li([], [
              `${course?.code ?? "Course"}: ${grade.value} (${grade.letter ?? "-"})`,
            ]);
          })),
        ])
      : h.p([], ["Select a student to view and record grades."]),
    model.status === "loading" ? h.p([], ["Loading…"]) : null,
    model.error ? h.p([h.Class("error"), h.Role("alert")], [model.error]) : null,
  ]),
});
