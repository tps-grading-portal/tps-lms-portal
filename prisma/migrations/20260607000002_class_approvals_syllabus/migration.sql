-- Migration: 20260607000002_class_approvals_syllabus
-- Per-class document release + per-class syllabus membership

ALTER TABLE "lesson_page_files"
    ADD COLUMN "approvedForClassAt"   TIMESTAMP(3),
    ADD COLUMN "approvedForClassById" TEXT;

-- Files already in the vault were approved under the old global model —
-- grandfather their existing class links as released.
UPDATE "lesson_page_files" lpf
SET "approvedForClassAt" = NOW()
FROM "content_files" cf
WHERE lpf."contentFileId" = cf.id AND cf.status = 'VAULT';

ALTER TABLE "syllabus_events" ADD COLUMN "classId" TEXT;

CREATE TABLE "class_syllabus_exclusions" (
    "id"              TEXT NOT NULL,
    "classId"         TEXT NOT NULL,
    "syllabusEventId" TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_syllabus_exclusions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "class_syllabus_exclusions_classId_syllabusEventId_key"
    ON "class_syllabus_exclusions"("classId", "syllabusEventId");
ALTER TABLE "class_syllabus_exclusions"
    ADD CONSTRAINT "class_syllabus_exclusions_syllabusEventId_fkey"
    FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
