'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { processSession } from '@/lib/session-processor'
import { getCriteriaForClass } from '@/lib/criteria-utils'
import { revalidatePath } from 'next/cache'

// ── Fetch all sessions for the history page ───────────────────────────────────

export async function getAdminSessionData(classId: string) {
  const [sessions, criteria] = await Promise.all([
    db.gradingSession.findMany({
      where: { classId },
      orderBy: [
        // Stable sort by creation time — position never changes when status changes,
        // so clicking Adjust always affects the card in the same screen position.
        { createdAt: 'asc' },
      ],
      include: {
        student:  { select: { number: true, track: true } },
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
    // Use class-specific criteria snapshot if it exists, otherwise global template.
    // Without this filter, both the template AND the snapshot appear, doubling every row.
    getCriteriaForClass(classId).then((all) =>
      all.map((c) => ({ id: c.id, code: c.code, name: c.name, sortOrder: c.sortOrder }))
    ),
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

// ── Admin: delete an empty session (zero grader assessments) ─────────────────

export async function adminDeleteEmptySessionAction(
  sessionId: string,
  classId: string,
): Promise<AdminEditGradeResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const record = await db.gradingSession.findUnique({
    where:   { id: sessionId },
    include: { _count: { select: { assessments: true } } },
  })

  if (!record)                           return { error: 'Session not found.' }
  if (record.classId !== classId)        return { error: 'Unauthorized — wrong class.' }
  if (record._count.assessments > 0)     return { error: 'Session still has grader scores — delete all grader columns first.' }

  await db.gradingSession.delete({ where: { id: sessionId } })
  revalidatePath(`/admin/classes/${classId}/history`)

  const data = await getAdminSessionData(classId)
  return { success: true, data }
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
