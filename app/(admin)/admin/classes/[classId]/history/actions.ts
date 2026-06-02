'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { processSession } from '@/lib/session-processor'
import { revalidatePath } from 'next/cache'

// ── Fetch all sessions for the history page ───────────────────────────────────

export async function getAdminSessionData(classId: string) {
  const [sessions, criteria] = await Promise.all([
    db.gradingSession.findMany({
      where: { classId },
      orderBy: [
        // Show active/adjusting sessions first, finalized below
        { status: 'asc' },
        { finalizedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        student:  { select: { name: true, track: true } },
        scenario: { select: { number: true, label: true } },
        assessments: {
          orderBy: { createdAt: 'asc' },
          include: {
            staffMember: { select: { name: true } },
            grades: {
              select: {
                id: true,
                criterionId: true,
                gradeValue: true,
                originalValue: true,
                isDiscontinuity: true,
                editedBy: true,
              },
              orderBy: { criterion: { sortOrder: 'asc' } },
            },
          },
        },
      },
    }),
    db.criterion.findMany({
      select: { id: true, code: true, name: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  return { sessions, criteria }
}

// ── Reopen a finalized session for adjustment ─────────────────────────────────
// Runs processSession to recalculate — status moves from FINALIZED to
// READY_TO_FINALIZE (or PENDING_RESOLUTION if the recalc finds discontinuities).

export async function reopenSessionAction(
  sessionId: string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const record = await db.gradingSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  })
  if (!record) return { error: 'Session not found.' }
  if (record.status !== 'FINALIZED') return { error: 'Session is not finalized.' }

  // Unfinalize then re-run processing so status + scores are fresh
  await db.gradingSession.update({
    where: { id: sessionId },
    data:  { status: 'OPEN', finalScore: null, finalizedAt: null },
  })

  await processSession(sessionId)
  revalidatePath(`/admin/classes`)
  return {}
}

// ── Admin inline grade edit (works on any status, including FINALIZED) ─────────

export type AdminEditGradeResult =
  | { error: string }
  | { success: true; data: Awaited<ReturnType<typeof getAdminSessionData>> }

export async function adminEditGradeAction(
  criterionGradeId: string,
  newGradeValue: number,
  classId: string,
): Promise<AdminEditGradeResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  if (newGradeValue < 1 || newGradeValue > 8) return { error: 'Grade must be 1–8.' }

  // Verify the grade belongs to this class
  const grade = await db.criterionGrade.findUnique({
    where: { id: criterionGradeId },
    include: {
      assessment: {
        include: { session: { select: { id: true, classId: true, status: true } } },
      },
    },
  })

  if (!grade)                                    return { error: 'Grade not found.' }
  if (grade.assessment.session.classId !== classId) return { error: 'Unauthorized — wrong class.' }

  await db.criterionGrade.update({
    where: { id: criterionGradeId },
    data: {
      gradeValue:    newGradeValue,
      originalValue: grade.originalValue ?? grade.gradeValue,
      editedBy:      'PANEL_CHAIR', // reuses existing enum — indicates a manual override
      editedAt:      new Date(),
    },
  })

  // If FINALIZED, open it first so processSession can set the correct status
  if (grade.assessment.session.status === 'FINALIZED') {
    await db.gradingSession.update({
      where: { id: grade.assessment.session.id },
      data:  { status: 'OPEN', finalScore: null, finalizedAt: null },
    })
  }

  await processSession(grade.assessment.session.id)

  const data = await getAdminSessionData(classId)
  return { success: true, data }
}

// ── Re-finalize after adjustment ──────────────────────────────────────────────

export async function adminFinalizeSessionAction(
  sessionId: string,
  classId: string,
): Promise<AdminEditGradeResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const record = await db.gradingSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  })
  if (!record) return { error: 'Session not found.' }
  if (record.status !== 'READY_TO_FINALIZE') {
    return { error: 'Session still has unresolved discontinuities — resolve all splits before re-finalizing.' }
  }

  await db.gradingSession.update({
    where: { id: sessionId },
    data:  { status: 'FINALIZED', finalizedAt: new Date() },
  })

  const data = await getAdminSessionData(classId)
  return { success: true, data }
}
