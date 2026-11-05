CREATE TABLE "Teacher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL
);

CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

ALTER TABLE "Course" ADD COLUMN "teacherId" TEXT
  REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Section" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Section_id_courseId_key" ON "Section"("id", "courseId");
CREATE UNIQUE INDEX "Section_courseId_name_key" ON "Section"("courseId", "name");

CREATE TABLE "Enrollment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Enrollment_sectionId_courseId_fkey" FOREIGN KEY ("sectionId", "courseId")
    REFERENCES "Section"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Enrollment_studentId_sectionId_key"
  ON "Enrollment"("studentId", "sectionId");
CREATE UNIQUE INDEX "Enrollment_id_courseId_key" ON "Enrollment"("id", "courseId");
CREATE INDEX "Enrollment_courseId_sectionId_idx" ON "Enrollment"("courseId", "sectionId");

CREATE TABLE "Assessment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "maxScore" INTEGER NOT NULL,
  "occurredAt" DATETIME NOT NULL,
  CONSTRAINT "Assessment_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Assessment_id_courseId_key" ON "Assessment"("id", "courseId");
CREATE UNIQUE INDEX "Assessment_courseId_category_title_occurredAt_key"
  ON "Assessment"("courseId", "category", "title", "occurredAt");
CREATE INDEX "Assessment_courseId_category_occurredAt_idx"
  ON "Assessment"("courseId", "category", "occurredAt");

CREATE TABLE "AssessmentResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  CONSTRAINT "AssessmentResult_assessmentId_courseId_fkey"
    FOREIGN KEY ("assessmentId", "courseId")
    REFERENCES "Assessment"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssessmentResult_enrollmentId_courseId_fkey"
    FOREIGN KEY ("enrollmentId", "courseId")
    REFERENCES "Enrollment"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AssessmentResult_assessmentId_enrollmentId_key"
  ON "AssessmentResult"("assessmentId", "enrollmentId");
CREATE INDEX "AssessmentResult_enrollmentId_idx" ON "AssessmentResult"("enrollmentId");
