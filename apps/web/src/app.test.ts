import { describe, expect, it } from "vitest";
import * as Story from "foldkit/story";
import type { TeacherDashboard } from "@sgms/core";
import { initialModel, Message, update } from "./app";

const dashboard: TeacherDashboard = {
  teacher: {
    id: "teacher-1",
    name: "Demo Teacher",
    email: "teacher@example.com",
  },
  courses: [
    {
      id: "course-1",
      name: "Mathematics",
      code: "MATH-101",
      sections: [
        { id: "section-1", name: "Section 1" },
        { id: "section-2", name: "Section 2" },
      ],
      students: [],
      assessments: [],
      results: [],
    },
  ],
};

describe("gradebook dashboard state", () => {
  it("selects the first course and filters to the chosen section", () => {
    Story.story(
      update,
      Story.given(initialModel),
      Story.message(Message.DashboardLoaded({ dashboard })),
      Story.message(Message.SectionSelected({ sectionId: "section-2" })),
      Story.message(Message.StudentSearchChanged({ value: "Selam" })),
      Story.model((model) => {
        expect(model.dashboard?.courses[0]?.id).toBe("course-1");
        expect(model.selectedSectionId).toBe("section-2");
        expect(model.studentQuery).toBe("Selam");
        expect(model.status).toBe("idle");
        expect(model.error).toBeNull();
      }),
      Story.Command.expectNone()
    );
  });
});
