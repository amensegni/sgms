import { Schema, Effect } from "effect";
import {
  Program,
  Model,
  Message,
  Command,
  View,
  html,
  text,
} from "foldkit";

// --- Domain types ---

export const StudentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
});
export type Student = typeof StudentSchema.Type;

export const GradeSchema = Schema.Struct({
  id: Schema.String,
  studentId: Schema.String,
  courseId: Schema.String,
  value: Schema.Number,
  letter: Schema.optional(Schema.String),
});
export type Grade = typeof GradeSchema.Type;

// --- Model ---

export interface AppModel {
  students: Student[];
  grades: Grade[];
  selectedStudentId: string | null;
  newStudentName: string;
  newStudentEmail: string;
  newGradeValue: string | null;
  newGradeCourse: string | null;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
}

export const initialModel: AppModel = {
  students: [],
  grades: [],
  selectedStudentId: null,
  newStudentName: "",
  newStudentEmail: "",
  newGradeValue: null,
  newGradeCourse: null,
  status: "idle",
  error: null,
};

// --- Messages ---

export const Msg = Schema.TaggedUnion("type", {
  AddStudent: Schema.Struct({ type: Schema.literal("AddStudent"), name: Schema.String, email: Schema.String }),
  SelectStudent: Schema.Struct({ type: Schema.literal("SelectStudent"), id: Schema.String }),
  RecordGrade: Schema.Struct({ type: Schema.literal("RecordGrade"), value: Schema.Number, course: Schema.String }),
  SetNewStudentName: Schema.Struct({ type: Schema.literal("SetNewStudentName"), value: Schema.String }),
  SetNewStudentEmail: Schema.Struct({ type: Schema.literal("SetNewStudentEmail"), value: Schema.String }),
  SetNewGradeValue: Schema.Struct({ type: Schema.literal("SetNewGradeValue"), value: Schema.String }),
  SetNewGradeCourse: Schema.Struct({ type: Schema.literal("SetNewGradeCourse"), value: Schema.String }),
  StudentAdded: Schema.Struct({ type: Schema.literal("StudentAdded"), student: StudentSchema }),
  GradeRecorded: Schema.Struct({ type: Schema.literal("GradeRecorded"), grade: GradeSchema }),
  OperationFailed: Schema.Struct({ type: Schema.literal("OperationFailed"), message: Schema.String }),
});
export type AppMessage = typeof Msg.Type;

// --- Commands ---

const addStudentCmd = (name: string, email: string): Command.Command<AppMessage> =>
  Command.async("AddStudent", (resume) => {
    const id = crypto.randomUUID();
    resume(Effect.succeed({ type: "StudentAdded", student: { id, name, email } }));
  });

const recordGradeCmd = (studentId: string, value: number, course: string): Command.Command<AppMessage> =>
  Command.async("RecordGrade", (resume) => {
    const id = crypto.randomUUID();
    const letter = value >= 90 ? "A" : value >= 80 ? "B" : value >= 70 ? "C" : value >= 60 ? "D" : "F";
    resume(Effect.succeed({ type: "GradeRecorded", grade: { id, studentId, courseId: course, value, letter } }));
  });

// --- Update ---

export const update = (model: AppModel, message: AppMessage): Model.UpdateReturn<AppModel, AppMessage> => {
  switch (message.type) {
    case "SetNewStudentName":
      return { model: { ...model, newStudentName: message.value, error: null } };

    case "SetNewStudentEmail":
      return { model: { ...model, newStudentEmail: message.value, error: null } };

    case "SetNewGradeValue":
      return { model: { ...model, newGradeValue: message.value, error: null } };

    case "SetNewGradeCourse":
      return { model: { ...model, newGradeCourse: message.value, error: null } };

    case "SelectStudent":
      return { model: { ...model, selectedStudentId: message.id, error: null } };

    case "AddStudent":
      return {
        model: { ...model, status: "loading" },
        commands: [addStudentCmd(message.name, message.email)],
      };

    case "RecordGrade":
      if (!model.selectedStudentId) {
        return { model: { ...model, error: "No student selected" } };
      }
      return {
        model: { ...model, status: "loading" },
        commands: [recordGradeCmd(model.selectedStudentId, message.value, message.course)],
      };

    case "StudentAdded":
      return {
        model: {
          ...model,
          students: [...model.students, message.student],
          newStudentName: "",
          newStudentEmail: "",
          status: "idle",
          error: null,
        },
      };

    case "GradeRecorded":
      return {
        model: {
          ...model,
          grades: [...model.grades, message.grade],
          newGradeValue: null,
          newGradeCourse: null,
          status: "idle",
          error: null,
        },
      };

    case "OperationFailed":
      return { model: { ...model, status: "idle", error: message.message } };
  }
};

// --- View ---

const studentRow = (student: Student, selected: boolean, onSelect: () => AppMessage) => {
  return html.tr(
    { class: selected ? "bg-gray-100" : "", onclick: onSelect },
    html.td({}, text(student.name)),
    html.td({}, text(student.email)),
    html.td({}, text("0"))
  );
};

export const view: View.View<AppModel, AppMessage> = (model) => {
  const selectedStudent = model.students.find((s) => s.id === model.selectedStudentId);

  return html.div({ class: "p-4 max-w-2xl mx-auto font-sans" }, [
    html.h1({}, text("Student Grade Management System")),

    html.div({ class: "mb-6 p-4 border rounded" }, [
      html.h2({}, text("Add Student")),
      html.div({ class: "flex gap-2" }, [
        html.input({
          type: "text",
          placeholder: "Name",
          value: model.newStudentName,
          oninput: (e) => ({ type: "SetNewStudentName", value: (e.target as HTMLInputElement).value }),
        }),
        html.input({
          type: "email",
          placeholder: "Email",
          value: model.newStudentEmail,
          oninput: (e) => ({ type: "SetNewStudentEmail", value: (e.target as HTMLInputElement).value }),
        }),
        html.button({
          onclick: () => ({ type: "AddStudent", name: model.newStudentName, email: model.newStudentEmail }),
          disabled: !model.newStudentName || !model.newStudentEmail,
        }, text("Add")),
      ]),
    ]),

    html.div({ class: "mb-6" }, [
      html.h2({}, text("Students")),
      html.table({ class: "border-collapse w-full" }, [
        html.thead({}, [
          html.tr({}, [
            html.th({}, text("Name")),
            html.th({}, text("Email")),
            html.th({}, text("Grades")),
          ]),
        ]),
        html.tbody({},
          model.students.map((s) =>
            studentRow(s, s.id === model.selectedStudentId, () => ({ type: "SelectStudent", id: s.id }))
          )
        ),
      ]),
    ]),

    selectedStudent && (
      html.div({ class: "mb-6 p-4 border rounded" }, [
        html.h2({}, text(`Record Grade — ${selectedStudent.name}`)),
        html.div({ class: "flex gap-2" }, [
          html.input({
            type: "number",
            placeholder: "Value (0-100)",
            value: model.newGradeValue ?? "",
            oninput: (e) => ({ type: "SetNewGradeValue", value: (e.target as HTMLInputElement).value }),
          }),
          html.input({
            type: "text",
            placeholder: "Course",
            value: model.newGradeCourse ?? "",
            oninput: (e) => ({ type: "SetNewGradeCourse", value: (e.target as HTMLInputElement).value }),
          }),
          html.button({
            onclick: () => {
              const value = model.newGradeValue ? parseFloat(model.newGradeValue) : NaN;
              if (isNaN(value) || !model.newGradeCourse) return { type: "SetNewStudentName", value: "" };
              return { type: "RecordGrade", value, course: model.newGradeCourse };
            },
            disabled: !model.newGradeValue || !model.newGradeCourse,
          }, text("Record")),
        ]),
      ])
    ),

    model.status === "loading" && html.p({}, text("Processing...")),
    model.error && html.p({ class: "text-red-500" }, text(model.error)),

    html.div({}, [
      html.h2({}, text("Grades")),
      html.table({ class: "border-collapse w-full" }, [
        html.thead({}, [
          html.tr({}, [
            html.th({}, text("Student")),
            html.th({}, text("Course")),
            html.th({}, text("Value")),
            html.th({}, text("Letter")),
          ]),
        ]),
        html.tbody({},
          model.grades.map((g) =>
            html.tr({}, [
              html.td({}, text(g.studentId.slice(0, 8))),
              html.td({}, text(g.courseId)),
              html.td({}, text(g.value.toString())),
              html.td({}, text(g.letter ?? "-")),
            ])
          )
        ),
      ]),
    ]),
  ]);
};

// --- Program ---

export const program = Program.program({
  model: initialModel,
  update,
  view,
});