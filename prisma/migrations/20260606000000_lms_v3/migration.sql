-- TPS LMS v3 Migration
-- Adds all new LMS models: User/RBAC, SyllabusEvents, ContentVault, Chat, Surveys, FlightSchedule, Alerts
-- All existing v2 tables are preserved; this migration only ADDS new tables and columns.

-- ============================================================
-- NEW ENUMS
-- ============================================================

CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'DEAN_COMMANDER', 'A9_STANDARDS', 'DEPT_CHAIR', 'LINE_INSTRUCTOR', 'STUDENT');
CREATE TYPE "Concentration" AS ENUM ('FTC', 'STC');
CREATE TYPE "DepartmentCode" AS ENUM ('AN', 'CF', 'SO', 'AS', 'PF', 'FQ', 'SY', 'TF', 'TL');
CREATE TYPE "EventSuffix" AS ENUM ('A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'O', 'R', 'S', 'W', 'Y', 'Z');
CREATE TYPE "SyllabusEventStatus" AS ENUM ('LOCKED', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'REVIEW');
CREATE TYPE "ContentStatus" AS ENUM ('SANDBOX', 'PENDING_CHAIR', 'PENDING_A9', 'VAULT', 'ARCHIVED');
CREATE TYPE "ContentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED_NO_CHANGES', 'CHANGES_REQUIRED', 'RECERTIFICATION');
CREATE TYPE "StorageProvider" AS ENUM ('VERCEL_BLOB', 'AZURE_BLOB', 'LOCAL');
CREATE TYPE "AlertType" AS ENUM ('CONSECUTIVE_SCORE_DROPS', 'BELOW_PASSING_THRESHOLD', 'PREREQ_MISSING_FOR_FLIGHT', 'GRADER_HARD_BIAS', 'GRADER_SOFT_BIAS', 'CONTENT_EXPIRING_SOON', 'SURVEY_POOR_FEEDBACK');
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "ChatChannelType" AS ENUM ('TRACK', 'COURSE', 'CLASS', 'DEPARTMENT', 'DIRECT', 'GENERAL');

-- ============================================================
-- ALTER EXISTING TABLES — add new columns
-- ============================================================

-- classes: add new LMS columns
ALTER TABLE "classes"
  ADD COLUMN IF NOT EXISTS "cohortCode"    TEXT,
  ADD COLUMN IF NOT EXISTS "concentration" "Concentration",
  ADD COLUMN IF NOT EXISTS "startDate"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate"       TIMESTAMP(3);

-- students: add real-name fields + userId link
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastName"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "email"     TEXT,
  ADD COLUMN IF NOT EXISTS "userId"    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "students_email_key" ON "students"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "students_userId_key" ON "students"("userId");

-- staff_members: bridge to User
ALTER TABLE "staff_members"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "staff_members_userId_key" ON "staff_members"("userId");

-- admin_users: bridge to User
ALTER TABLE "admin_users"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_userId_key" ON "admin_users"("userId");

-- gradebook_instructors: bridge to User
ALTER TABLE "gradebook_instructors"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "gradebook_instructors_userId_key" ON "gradebook_instructors"("userId");

-- gradebook_entries: add syllabusEventId + instructorId
ALTER TABLE "gradebook_entries"
  ADD COLUMN IF NOT EXISTS "syllabusEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "instructorId"    TEXT;

-- grading_sessions: add syllabusEventId
ALTER TABLE "grading_sessions"
  ADD COLUMN IF NOT EXISTS "syllabusEventId" TEXT;

-- ============================================================
-- USERS & RBAC
-- ============================================================

CREATE TABLE "users" (
  "id"           TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "firstName"    TEXT NOT NULL,
  "lastName"     TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role"         "UserRole" NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "mfaEnabled"   BOOLEAN NOT NULL DEFAULT FALSE,
  "mfaSecret"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt"  TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "user_departments" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "deptCode"  "DepartmentCode" NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_departments_userId_deptCode_key" ON "user_departments"("userId", "deptCode");

CREATE TABLE "user_track_access" (
  "id"     TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "track"  "Track" NOT NULL,
  CONSTRAINT "user_track_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_track_access_userId_track_key" ON "user_track_access"("userId", "track");

CREATE TABLE "audit_logs" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "targetId"   TEXT,
  "targetType" TEXT,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- SYLLABUS EVENTS
-- ============================================================

CREATE TABLE "syllabus_events" (
  "id"                   TEXT NOT NULL,
  "courseCode"           TEXT NOT NULL,
  "title"                TEXT NOT NULL,
  "deptCode"             "DepartmentCode" NOT NULL,
  "eventSuffix"          "EventSuffix" NOT NULL,
  "phase"                INTEGER NOT NULL,
  "creditHours"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "description"          TEXT,
  "isGraded"             BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive"             BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder"            INTEGER NOT NULL DEFAULT 0,
  "tracks"               "Track"[],
  "gradesheetTemplateId" TEXT,
  "isCompOral"           BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "syllabus_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "syllabus_events_courseCode_key" ON "syllabus_events"("courseCode");

CREATE TABLE "syllabus_event_prerequisites" (
  "id"             TEXT NOT NULL,
  "eventId"        TEXT NOT NULL,
  "prerequisiteId" TEXT NOT NULL,
  "isHard"         BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "syllabus_event_prerequisites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "syllabus_event_prerequisites_eventId_prerequisiteId_key"
  ON "syllabus_event_prerequisites"("eventId", "prerequisiteId");

CREATE TABLE "class_syllabus_schedules" (
  "id"              TEXT NOT NULL,
  "classId"         TEXT NOT NULL,
  "syllabusEventId" TEXT NOT NULL,
  "scheduledDate"   TIMESTAMP(3),
  "scheduledTime"   TEXT,
  "locationRoom"    TEXT,
  "notes"           TEXT,
  "isConfirmed"     BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "class_syllabus_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "class_syllabus_schedules_classId_syllabusEventId_key"
  ON "class_syllabus_schedules"("classId", "syllabusEventId");

CREATE TABLE "student_syllabus_events" (
  "id"                 TEXT NOT NULL,
  "studentId"          TEXT NOT NULL,
  "syllabusEventId"    TEXT NOT NULL,
  "status"             "SyllabusEventStatus" NOT NULL DEFAULT 'LOCKED',
  "score"              DOUBLE PRECISION,
  "completedAt"        TIMESTAMP(3),
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gradebookEntryId"   TEXT,
  "gradingSessionId"   TEXT,
  CONSTRAINT "student_syllabus_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "student_syllabus_events_studentId_syllabusEventId_key"
  ON "student_syllabus_events"("studentId", "syllabusEventId");
CREATE UNIQUE INDEX "student_syllabus_events_gradebookEntryId_key"
  ON "student_syllabus_events"("gradebookEntryId");
CREATE UNIQUE INDEX "student_syllabus_events_gradingSessionId_key"
  ON "student_syllabus_events"("gradingSessionId");

-- ============================================================
-- CURRICULUM WEIGHTING MATRIX
-- ============================================================

CREATE TABLE "curriculum_weights" (
  "id"              TEXT NOT NULL,
  "track"           "Track" NOT NULL,
  "syllabusEventId" TEXT NOT NULL,
  "weightPct"       DOUBLE PRECISION NOT NULL,
  "setByUserId"     TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "curriculum_weights_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curriculum_weights_track_syllabusEventId_key"
  ON "curriculum_weights"("track", "syllabusEventId");

-- ============================================================
-- CONTENT VAULT
-- ============================================================

CREATE TABLE "content_files" (
  "id"                TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "description"       TEXT,
  "syllabusEventId"   TEXT,
  "uploadedById"      TEXT NOT NULL,
  "status"            "ContentStatus" NOT NULL DEFAULT 'SANDBOX',
  "storageProvider"   "StorageProvider" NOT NULL DEFAULT 'VERCEL_BLOB',
  "storageKey"        TEXT,
  "storageUrl"        TEXT,
  "fileHash"          TEXT,
  "fileSizeBytes"     INTEGER,
  "mimeType"          TEXT,
  "fileName"          TEXT,
  "presentationCount" INTEGER NOT NULL DEFAULT 0,
  "version"           INTEGER NOT NULL DEFAULT 1,
  "previousVersionId" TEXT,
  "isLatest"          BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt"        TIMESTAMP(3),
  CONSTRAINT "content_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_workflows" (
  "id"                   TEXT NOT NULL,
  "contentFileId"        TEXT NOT NULL,
  "submittedById"        TEXT NOT NULL,
  "submittedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "chairReviewedById"    TEXT,
  "chairReviewedAt"      TIMESTAMP(3),
  "chairNotes"           TEXT,
  "a9ReviewedById"       TEXT,
  "a9ReviewedAt"         TIMESTAMP(3),
  "a9Notes"              TEXT,
  "currentStatus"        "ContentStatus" NOT NULL DEFAULT 'SANDBOX',
  "autoPublished"        BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_workflows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "content_workflows_contentFileId_key" ON "content_workflows"("contentFileId");

CREATE TABLE "content_verifications" (
  "id"              TEXT NOT NULL,
  "contentFileId"   TEXT NOT NULL,
  "classId"         TEXT NOT NULL,
  "verifiedById"    TEXT NOT NULL,
  "verifiedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"          "ContentVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "autoPublished"   BOOLEAN NOT NULL DEFAULT FALSE,
  "notes"           TEXT,
  CONSTRAINT "content_verifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "content_verifications_contentFileId_classId_key"
  ON "content_verifications"("contentFileId", "classId");

-- ============================================================
-- DIGITAL SQUADRON CHAT
-- ============================================================

CREATE TABLE "chat_channels" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "type"              "ChatChannelType" NOT NULL,
  "classId"           TEXT,
  "trackFilter"       "Track",
  "courseCode"        TEXT,
  "deptCode"          "DepartmentCode",
  "isAutoProvisioned" BOOLEAN NOT NULL DEFAULT FALSE,
  "isArchived"        BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_channels_classId_name_key" ON "chat_channels"("classId", "name");

CREATE TABLE "chat_messages" (
  "id"          TEXT NOT NULL,
  "channelId"   TEXT NOT NULL,
  "authorId"    TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "attachments" JSONB,
  "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt"    TIMESTAMP(3),
  "isDeleted"   BOOLEAN NOT NULL DEFAULT FALSE,
  "replyToId"   TEXT,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_channel_members" (
  "id"         TEXT NOT NULL,
  "channelId"  TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "joinedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(3),
  "isMuted"    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "chat_channel_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_channel_members_channelId_userId_key"
  ON "chat_channel_members"("channelId", "userId");

-- ============================================================
-- ENHANCED SURVEY MODULE
-- ============================================================

CREATE TABLE "survey_deployments" (
  "id"              TEXT NOT NULL,
  "classId"         TEXT NOT NULL,
  "syllabusEventId" TEXT,
  "surveyType"      "SurveyType" NOT NULL,
  "deployedById"    TEXT NOT NULL,
  "deployedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closesAt"        TIMESTAMP(3),
  "isActive"        BOOLEAN NOT NULL DEFAULT TRUE,
  "instructorName"  TEXT,
  "scenarioLabel"   TEXT,
  "trackFilter"     "Track",
  "customQuestions" JSONB,
  CONSTRAINT "survey_deployments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "survey_responses_v2" (
  "id"           TEXT NOT NULL,
  "deploymentId" TEXT NOT NULL,
  "trackLabel"   TEXT,
  "cohortLabel"  TEXT,
  "responses"    JSONB NOT NULL,
  "submittedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "survey_responses_v2_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "survey_sanitized_reports" (
  "id"               TEXT NOT NULL,
  "deploymentId"     TEXT NOT NULL,
  "rawSummaryText"   TEXT,
  "sanitizedText"    TEXT,
  "pdfStorageKey"    TEXT,
  "pdfUrl"           TEXT,
  "publishedAt"      TIMESTAMP(3),
  "publishedById"    TEXT,
  "recertTriggered"  BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "survey_sanitized_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "survey_sanitized_reports_deploymentId_key"
  ON "survey_sanitized_reports"("deploymentId");

-- ============================================================
-- FLIGHT SCHEDULE INTEGRATION
-- ============================================================

CREATE TABLE "flight_schedule_syncs" (
  "id"           TEXT NOT NULL,
  "sheetId"      TEXT NOT NULL,
  "tabGid"       TEXT NOT NULL,
  "syncedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"       TEXT NOT NULL,
  "errorMsg"     TEXT,
  "rowsIngested" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "flight_schedule_syncs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flight_schedule_entries" (
  "id"               TEXT NOT NULL,
  "syncId"           TEXT NOT NULL,
  "classId"          TEXT,
  "scheduleDate"     DATE NOT NULL,
  "studentName"      TEXT NOT NULL,
  "studentId"        TEXT,
  "eventType"        TEXT NOT NULL,
  "eventTime"        TEXT,
  "courseCode"       TEXT,
  "aircraft"         TEXT,
  "notes"            TEXT,
  "prerequisitesMet" BOOLEAN,
  CONSTRAINT "flight_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- EARLY WARNING ALERTS
-- ============================================================

CREATE TABLE "student_alerts" (
  "id"            TEXT NOT NULL,
  "studentId"     TEXT NOT NULL,
  "type"          "AlertType" NOT NULL,
  "severity"      "AlertSeverity" NOT NULL DEFAULT 'WARNING',
  "message"       TEXT NOT NULL,
  "metadata"      JSONB,
  "isResolved"    BOOLEAN NOT NULL DEFAULT FALSE,
  "resolvedAt"    TIMESTAMP(3),
  "resolvedById"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_alerts_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================

-- users
ALTER TABLE "user_departments"  ADD CONSTRAINT "user_departments_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_track_access" ADD CONSTRAINT "user_track_access_userId_fkey" FOREIGN KEY ("userId")  REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "audit_logs"        ADD CONSTRAINT "audit_logs_userId_fkey"        FOREIGN KEY ("userId")  REFERENCES "users"("id");

-- students bridge
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id");
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id");

-- syllabus events
ALTER TABLE "syllabus_events" ADD CONSTRAINT "syllabus_events_gradesheetTemplateId_fkey"
  FOREIGN KEY ("gradesheetTemplateId") REFERENCES "gradesheet_templates"("id");
ALTER TABLE "syllabus_event_prerequisites" ADD CONSTRAINT "sep_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "syllabus_events"("id") ON DELETE CASCADE;
ALTER TABLE "syllabus_event_prerequisites" ADD CONSTRAINT "sep_prerequisiteId_fkey"
  FOREIGN KEY ("prerequisiteId") REFERENCES "syllabus_events"("id") ON DELETE CASCADE;
ALTER TABLE "class_syllabus_schedules" ADD CONSTRAINT "css_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "class_syllabus_schedules" ADD CONSTRAINT "css_syllabusEventId_fkey"
  FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id");
ALTER TABLE "student_syllabus_events" ADD CONSTRAINT "sse_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE;
ALTER TABLE "student_syllabus_events" ADD CONSTRAINT "sse_syllabusEventId_fkey"
  FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id");
ALTER TABLE "student_syllabus_events" ADD CONSTRAINT "sse_gradebookEntryId_fkey"
  FOREIGN KEY ("gradebookEntryId") REFERENCES "gradebook_entries"("id");
ALTER TABLE "student_syllabus_events" ADD CONSTRAINT "sse_gradingSessionId_fkey"
  FOREIGN KEY ("gradingSessionId") REFERENCES "grading_sessions"("id");

-- curriculum weights
ALTER TABLE "curriculum_weights" ADD CONSTRAINT "cw_syllabusEventId_fkey"
  FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id") ON DELETE CASCADE;

-- content vault
ALTER TABLE "content_files" ADD CONSTRAINT "cf_syllabusEventId_fkey"
  FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id");
ALTER TABLE "content_files" ADD CONSTRAINT "cf_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id");
ALTER TABLE "content_files" ADD CONSTRAINT "cf_previousVersionId_fkey"
  FOREIGN KEY ("previousVersionId") REFERENCES "content_files"("id");
ALTER TABLE "content_workflows" ADD CONSTRAINT "cw_contentFileId_fkey"
  FOREIGN KEY ("contentFileId") REFERENCES "content_files"("id") ON DELETE CASCADE;
ALTER TABLE "content_workflows" ADD CONSTRAINT "cw_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "users"("id");
ALTER TABLE "content_verifications" ADD CONSTRAINT "cv_contentFileId_fkey"
  FOREIGN KEY ("contentFileId") REFERENCES "content_files"("id");
ALTER TABLE "content_verifications" ADD CONSTRAINT "cv_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes"("id");
ALTER TABLE "content_verifications" ADD CONSTRAINT "cv_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "users"("id");

-- chat
ALTER TABLE "chat_channels"      ADD CONSTRAINT "cc_classId_fkey"    FOREIGN KEY ("classId")   REFERENCES "classes"("id");
ALTER TABLE "chat_messages"      ADD CONSTRAINT "cm_channelId_fkey"  FOREIGN KEY ("channelId") REFERENCES "chat_channels"("id") ON DELETE CASCADE;
ALTER TABLE "chat_messages"      ADD CONSTRAINT "cm_authorId_fkey"   FOREIGN KEY ("authorId")  REFERENCES "users"("id");
ALTER TABLE "chat_messages"      ADD CONSTRAINT "cm_replyToId_fkey"  FOREIGN KEY ("replyToId") REFERENCES "chat_messages"("id");
ALTER TABLE "chat_channel_members" ADD CONSTRAINT "ccm_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "chat_channels"("id") ON DELETE CASCADE;
ALTER TABLE "chat_channel_members" ADD CONSTRAINT "ccm_userId_fkey"   FOREIGN KEY ("userId")    REFERENCES "users"("id") ON DELETE CASCADE;

-- surveys
ALTER TABLE "survey_deployments" ADD CONSTRAINT "sd_classId_fkey"         FOREIGN KEY ("classId")         REFERENCES "classes"("id");
ALTER TABLE "survey_deployments" ADD CONSTRAINT "sd_syllabusEventId_fkey"  FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id");
ALTER TABLE "survey_deployments" ADD CONSTRAINT "sd_deployedById_fkey"     FOREIGN KEY ("deployedById")    REFERENCES "users"("id");
ALTER TABLE "survey_responses_v2" ADD CONSTRAINT "srv2_deploymentId_fkey"  FOREIGN KEY ("deploymentId")    REFERENCES "survey_deployments"("id");
ALTER TABLE "survey_sanitized_reports" ADD CONSTRAINT "ssr_deploymentId_fkey"  FOREIGN KEY ("deploymentId") REFERENCES "survey_deployments"("id");
ALTER TABLE "survey_sanitized_reports" ADD CONSTRAINT "ssr_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id");

-- flight schedule
ALTER TABLE "flight_schedule_entries" ADD CONSTRAINT "fse_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id");

-- alerts
ALTER TABLE "student_alerts" ADD CONSTRAINT "sa_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE;

-- gradebook entries new FKs
ALTER TABLE "gradebook_entries" ADD CONSTRAINT "ge_instructorId_fkey"    FOREIGN KEY ("instructorId")    REFERENCES "users"("id");
ALTER TABLE "gradebook_entries" ADD CONSTRAINT "ge_syllabusEventId_fkey" FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id");
ALTER TABLE "grading_sessions"  ADD CONSTRAINT "gs_syllabusEventId_fkey" FOREIGN KEY ("syllabusEventId") REFERENCES "syllabus_events"("id");
