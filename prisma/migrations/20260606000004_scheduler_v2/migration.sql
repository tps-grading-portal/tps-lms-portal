-- Migration: 20260606000004_scheduler_v2
-- Multi-day course sessions + default course duration

ALTER TABLE "syllabus_events"
    ADD COLUMN "defaultDurationMinutes" INTEGER;

ALTER TABLE "class_syllabus_schedules"
    ADD COLUMN "sessionNumber" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "class_syllabus_schedules_classId_syllabusEventId_key";
CREATE UNIQUE INDEX "class_syllabus_schedules_classId_syllabusEventId_sessionNum_key"
    ON "class_syllabus_schedules"("classId", "syllabusEventId", "sessionNumber");
