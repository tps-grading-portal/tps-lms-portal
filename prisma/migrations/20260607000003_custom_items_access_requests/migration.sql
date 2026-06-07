-- Custom free-text calendar items + self-service access requests

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "AccessRequestType" AS ENUM ('COURSE_OWNER', 'PHASE_OWNER', 'DEPARTMENT', 'ROLE_CHANGE', 'OTHER');

-- CreateTable
CREATE TABLE "custom_schedule_items" (
    "id" TEXT NOT NULL,
    "classId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "locationRoom" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AccessRequestType" NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "justification" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_schedule_items_scheduledDate_idx" ON "custom_schedule_items"("scheduledDate");

-- CreateIndex
CREATE INDEX "access_requests_status_idx" ON "access_requests"("status");

-- CreateIndex
CREATE INDEX "access_requests_userId_idx" ON "access_requests"("userId");

-- AddForeignKey
ALTER TABLE "custom_schedule_items" ADD CONSTRAINT "custom_schedule_items_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_schedule_items" ADD CONSTRAINT "custom_schedule_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
