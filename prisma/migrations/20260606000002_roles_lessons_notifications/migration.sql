-- Migration: 20260606000002_roles_lessons_notifications
-- Adds: ADO/DO/GUEST_INSTRUCTOR roles, CourseAssignment, Lesson,
--       Notification; LessonPageFile.lessonId

-- ── New UserRole values ──────────────────────────────────────────────────────
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADO';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DO';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GUEST_INSTRUCTOR';

-- ── CourseAssignment ─────────────────────────────────────────────────────────
CREATE TABLE "course_assignments" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "syllabusEventId" TEXT,
    "deptCode"        "DepartmentCode",
    "assignedById"    TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "course_assignments_userId_syllabusEventId_key"
    ON "course_assignments"("userId", "syllabusEventId");
CREATE UNIQUE INDEX "course_assignments_userId_deptCode_key"
    ON "course_assignments"("userId", "deptCode");
ALTER TABLE "course_assignments"
    ADD CONSTRAINT "course_assignments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_assignments"
    ADD CONSTRAINT "course_assignments_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_assignments"
    ADD CONSTRAINT "course_assignments_syllabusEventId_fkey"
    FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Notification ─────────────────────────────────────────────────────────────
CREATE TABLE "notifications" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "body"      TEXT,
    "href"      TEXT,
    "readAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Lesson ───────────────────────────────────────────────────────────────────
CREATE TABLE "lessons" (
    "id"           TEXT NOT NULL,
    "lessonPageId" TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "overview"     TEXT,
    "outline"      TEXT,
    "tlos"         JSONB,
    "plos"         JSONB,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "lessons"
    ADD CONSTRAINT "lessons_lessonPageId_fkey"
    FOREIGN KEY ("lessonPageId") REFERENCES "lesson_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── LessonPageFile.lessonId ──────────────────────────────────────────────────
ALTER TABLE "lesson_page_files" ADD COLUMN "lessonId" TEXT;
ALTER TABLE "lesson_page_files"
    ADD CONSTRAINT "lesson_page_files_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
