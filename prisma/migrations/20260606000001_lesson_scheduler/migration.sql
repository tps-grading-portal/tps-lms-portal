-- Migration: 20260606000001_lesson_scheduler
-- Adds: AcademicWeek, LessonPage, LessonPageFile, StudentLessonView
-- Updates: ClassSyllabusSchedule (instructorId, academicWeekId, durationMinutes)

-- ── AcademicWeek ─────────────────────────────────────────────────────────────
CREATE TABLE "academic_weeks" (
    "id"         TEXT    NOT NULL,
    "classId"    TEXT    NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "label"      TEXT    NOT NULL,
    "theme"      TEXT,
    "startDate"  DATE    NOT NULL,
    "endDate"    DATE    NOT NULL,
    "notes"      TEXT,
    CONSTRAINT "academic_weeks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "academic_weeks_classId_weekNumber_key" ON "academic_weeks"("classId", "weekNumber");
ALTER TABLE "academic_weeks"
    ADD CONSTRAINT "academic_weeks_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClassSyllabusSchedule additions ─────────────────────────────────────────
ALTER TABLE "class_syllabus_schedules"
    ADD COLUMN "instructorId"    TEXT,
    ADD COLUMN "academicWeekId"  TEXT,
    ADD COLUMN "durationMinutes" INTEGER;

ALTER TABLE "class_syllabus_schedules"
    ADD CONSTRAINT "class_syllabus_schedules_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "class_syllabus_schedules"
    ADD CONSTRAINT "class_syllabus_schedules_academicWeekId_fkey"
    FOREIGN KEY ("academicWeekId") REFERENCES "academic_weeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── LessonPage ───────────────────────────────────────────────────────────────
CREATE TABLE "lesson_pages" (
    "id"                 TEXT      NOT NULL,
    "syllabusEventId"    TEXT      NOT NULL,
    "authorId"           TEXT      NOT NULL,
    "overview"           TEXT,
    "learningObjectives" JSONB,
    "outline"            TEXT,
    "estimatedMinutes"   INTEGER,
    "isPublished"        BOOLEAN   NOT NULL DEFAULT false,
    "publishedAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lesson_pages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lesson_pages_syllabusEventId_key" ON "lesson_pages"("syllabusEventId");
ALTER TABLE "lesson_pages"
    ADD CONSTRAINT "lesson_pages_syllabusEventId_fkey"
    FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_pages"
    ADD CONSTRAINT "lesson_pages_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── LessonPageFile ───────────────────────────────────────────────────────────
CREATE TABLE "lesson_page_files" (
    "id"            TEXT    NOT NULL,
    "lessonPageId"  TEXT    NOT NULL,
    "contentFileId" TEXT    NOT NULL,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "displayLabel"  TEXT,
    CONSTRAINT "lesson_page_files_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lesson_page_files_lessonPageId_contentFileId_key"
    ON "lesson_page_files"("lessonPageId", "contentFileId");
ALTER TABLE "lesson_page_files"
    ADD CONSTRAINT "lesson_page_files_lessonPageId_fkey"
    FOREIGN KEY ("lessonPageId") REFERENCES "lesson_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_page_files"
    ADD CONSTRAINT "lesson_page_files_contentFileId_fkey"
    FOREIGN KEY ("contentFileId") REFERENCES "content_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── StudentLessonView ────────────────────────────────────────────────────────
CREATE TABLE "student_lesson_views" (
    "id"            TEXT      NOT NULL,
    "studentId"     TEXT      NOT NULL,
    "lessonPageId"  TEXT      NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCompleted"   BOOLEAN   NOT NULL DEFAULT false,
    CONSTRAINT "student_lesson_views_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_lesson_views_studentId_lessonPageId_key"
    ON "student_lesson_views"("studentId", "lessonPageId");
ALTER TABLE "student_lesson_views"
    ADD CONSTRAINT "student_lesson_views_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_lesson_views"
    ADD CONSTRAINT "student_lesson_views_lessonPageId_fkey"
    FOREIGN KEY ("lessonPageId") REFERENCES "lesson_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
