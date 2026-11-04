import { describe, expect, it } from "vitest";
import * as Story from "foldkit/story";
import {
  CreateStudent,
  initialModel,
  LoadGrades,
  Message,
  update,
} from "./app";

describe("student creation flow", () => {
  it("uses the API result and loads grades for the created student", () => {
    const student = {
      id: "student-1",
      name: "Alice",
      email: "alice@example.com",
    };

    Story.story(
      update,
      Story.given(initialModel),
      Story.message(Message.StudentNameChanged({ value: student.name })),
      Story.message(Message.StudentEmailChanged({ value: student.email })),
      Story.message(Message.AddStudentClicked()),
      Story.Command.expectExact(CreateStudent),
      Story.Command.resolve(
        CreateStudent,
        Message.StudentCreated({ student })
      ),
      Story.Command.expectExact(LoadGrades),
      Story.Command.resolve(
        LoadGrades,
        Message.GradesLoaded({ grades: [] })
      ),
      Story.model((model) => {
        expect(model.students).toEqual([student]);
        expect(model.selectedStudentId).toBe(student.id);
        expect(model.status).toBe("idle");
        expect(model.error).toBeNull();
      }),
      Story.Command.expectNone()
    );
  });
});
