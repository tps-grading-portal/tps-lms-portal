-- Migration: 20260606000005_scheduler_role_dean_step
-- SCHEDULER role + Dean review step in the content workflow

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SCHEDULER';
ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'PENDING_DEAN';
