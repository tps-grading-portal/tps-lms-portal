-- CreateEnum
CREATE TYPE "AccessRole" AS ENUM ('GRADER', 'PANEL_CHAIR');

-- CreateEnum
CREATE TYPE "Pillar" AS ENUM ('TESTER', 'LEADER', 'THINKER');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('PILOT', 'RPA', 'FTE', 'OPERATOR', 'CSO_WSO', 'ABM');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'PENDING_RESOLUTION', 'READY_TO_FINALIZE', 'FINALIZED');

-- CreateEnum
CREATE TYPE "EditSource" AS ENUM ('GRADER', 'PANEL_CHAIR');

-- CreateEnum
CREATE TYPE "SurveyType" AS ENUM ('STUDENT', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'MULTIPLE_CHOICE', 'MULTI_SELECT', 'LIKERT', 'DATE', 'NUMBER');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_access" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "role" "AccessRole" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "outcomesRefs" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "waaDescriptor" TEXT NOT NULL,
    "avgDescriptor" TEXT NOT NULL,
    "failDescriptor" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_sessions" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "finalScore" DOUBLE PRECISION,
    "hasFail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "grading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grader_assessments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "weightedSum" DOUBLE PRECISION,
    "hasFail" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grader_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criterion_grades" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "gradeValue" INTEGER NOT NULL,
    "originalValue" INTEGER,
    "isDiscontinuity" BOOLEAN NOT NULL DEFAULT false,
    "editedBy" "EditSource",
    "editedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "criterion_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_question_templates" (
    "id" TEXT NOT NULL,
    "surveyType" "SurveyType" NOT NULL,
    "classId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "survey_question_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_survey_responses" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_survey_responses" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "class_access_classId_role_key" ON "class_access"("classId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_name_key" ON "staff_members"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_classId_number_key" ON "scenarios"("classId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_code_key" ON "criteria"("code");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_sortOrder_key" ON "criteria"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "students_classId_name_key" ON "students"("classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "grader_assessments_sessionId_staffMemberId_key" ON "grader_assessments"("sessionId", "staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "criterion_grades_assessmentId_criterionId_key" ON "criterion_grades"("assessmentId", "criterionId");

-- AddForeignKey
ALTER TABLE "class_access" ADD CONSTRAINT "class_access_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_sessions" ADD CONSTRAINT "grading_sessions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_sessions" ADD CONSTRAINT "grading_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_sessions" ADD CONSTRAINT "grading_sessions_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grader_assessments" ADD CONSTRAINT "grader_assessments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "grading_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grader_assessments" ADD CONSTRAINT "grader_assessments_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criterion_grades" ADD CONSTRAINT "criterion_grades_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "grader_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criterion_grades" ADD CONSTRAINT "criterion_grades_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_question_templates" ADD CONSTRAINT "survey_question_templates_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_survey_responses" ADD CONSTRAINT "student_survey_responses_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_survey_responses" ADD CONSTRAINT "instructor_survey_responses_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
