import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../apps/api/src/database-url.ts";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: resolveDatabaseUrl(process.env.DATABASE_URL),
  }),
});

const teacherId = "bits-demo-teacher";
const courseId = "bits-demo-course";
const sectionIds = ["bits-demo-section-1", "bits-demo-section-2"] as const;

const roster = [
  { id: "bits-demo-student-01", name: "Mekdes Alemu", section: 0 },
  { id: "bits-demo-student-02", name: "Dawit Bekele", section: 0 },
  { id: "bits-demo-student-03", name: "Hana Girma", section: 0 },
  { id: "bits-demo-student-04", name: "Samuel Tadesse", section: 0 },
  { id: "bits-demo-student-05", name: "Liya Kebede", section: 1 },
  { id: "bits-demo-student-06", name: "Nahom Abebe", section: 1 },
  { id: "bits-demo-student-07", name: "Selam Tesfaye", section: 1 },
  { id: "bits-demo-student-08", name: "Yonas Worku", section: 1 },
] as const;

const assessments = [
  {
    id: "bits-demo-mid-exam",
    category: "MID_EXAM",
    title: "Mid exam",
    maxScore: 100,
    occurredAt: new Date("2026-03-15T09:00:00.000Z"),
  },
  {
    id: "bits-demo-final-exam",
    category: "FINAL_EXAM",
    title: "Final exam",
    maxScore: 100,
    occurredAt: new Date("2026-06-15T09:00:00.000Z"),
  },
  {
    id: "bits-demo-activity-1",
    category: "CLASS_ACTIVITY",
    title: "Programming lab",
    maxScore: 10,
    occurredAt: new Date("2026-02-20T09:00:00.000Z"),
  },
  {
    id: "bits-demo-activity-2",
    category: "CLASS_ACTIVITY",
    title: "Problem set",
    maxScore: 10,
    occurredAt: new Date("2026-03-28T09:00:00.000Z"),
  },
  {
    id: "bits-demo-activity-3",
    category: "CLASS_ACTIVITY",
    title: "In-class exercise",
    maxScore: 10,
    occurredAt: new Date("2026-04-18T09:00:00.000Z"),
  },
] as const;

const resultScores = [
  [82, 88, 8, 9, 10],
  [76, 84, 7, 8, 9],
  [91, 94, 10, 10, 10],
  [68, 78, 6, 8, 8],
  [87, 90, 9, 9, 10],
  [73, 80, 8, 7, 9],
  [95, 97, 10, 10, 10],
  [79, 86, 7, 9, 9],
] as const;

const seed = async () => {
  await prisma.teacher.upsert({
    where: { id: teacherId },
    update: { name: "Dr. Hana Tesfaye", email: "hana.tesfaye@bitscollege.example" },
    create: {
      id: teacherId,
      name: "Dr. Hana Tesfaye",
      email: "hana.tesfaye@bitscollege.example",
    },
  });

  await prisma.course.upsert({
    where: { id: courseId },
    update: {
      name: "Introduction to Computing",
      code: "BIT-CS101",
      teacherId,
    },
    create: {
      id: courseId,
      name: "Introduction to Computing",
      code: "BIT-CS101",
      teacherId,
    },
  });

  for (const [index, sectionId] of sectionIds.entries()) {
    await prisma.section.upsert({
      where: { id: sectionId },
      update: { name: `Section ${index + 1}`, courseId },
      create: { id: sectionId, name: `Section ${index + 1}`, courseId },
    });
  }

  const enrollments = [];
  for (const student of roster) {
    const email = `${student.id}@students.bitscollege.example`;
    await prisma.student.upsert({
      where: { id: student.id },
      update: { name: student.name, email },
      create: { id: student.id, name: student.name, email },
    });
    const sectionId = sectionIds[student.section];
    enrollments.push(
      await prisma.enrollment.upsert({
        where: {
          studentId_sectionId: { studentId: student.id, sectionId },
        },
        update: { courseId },
        create: { studentId: student.id, sectionId, courseId },
      })
    );
  }

  for (const assessment of assessments) {
    await prisma.assessment.upsert({
      where: { id: assessment.id },
      update: {
        courseId,
        category: assessment.category,
        title: assessment.title,
        maxScore: assessment.maxScore,
        occurredAt: assessment.occurredAt,
      },
      create: { ...assessment, courseId },
    });
  }

  for (const [studentIndex, enrollment] of enrollments.entries()) {
    for (const [assessmentIndex, assessment] of assessments.entries()) {
      if (assessment.category === "FINAL_EXAM" && studentIndex === 3) {
        continue;
      }
      await prisma.assessmentResult.upsert({
        where: {
          assessmentId_enrollmentId: {
            assessmentId: assessment.id,
            enrollmentId: enrollment.id,
          },
        },
        update: { score: resultScores[studentIndex]![assessmentIndex]! },
        create: {
          courseId,
          assessmentId: assessment.id,
          enrollmentId: enrollment.id,
          score: resultScores[studentIndex]![assessmentIndex]!,
        },
      });
    }
  }
};

seed()
  .catch((cause: unknown) => {
    console.error("BITS College demo data seeding failed", cause);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
