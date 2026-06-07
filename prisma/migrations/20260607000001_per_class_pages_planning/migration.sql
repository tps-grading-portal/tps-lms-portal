-- Migration: 20260607000001_per_class_pages_planning
-- Per-class course pages + "Active for Planning" class status

ALTER TABLE "classes" ADD COLUMN "isPlanning" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "lesson_pages" ADD COLUMN "classId" TEXT;

-- Existing lesson pages belong to the first active class
UPDATE "lesson_pages"
SET "classId" = (
  SELECT id FROM "classes"
  WHERE "isActive" = true AND "archivedAt" IS NULL
  ORDER BY name LIMIT 1
);

DROP INDEX "lesson_pages_syllabusEventId_key";
CREATE UNIQUE INDEX "lesson_pages_syllabusEventId_classId_key"
    ON "lesson_pages"("syllabusEventId", "classId");

ALTER TABLE "lesson_pages"
    ADD CONSTRAINT "lesson_pages_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
