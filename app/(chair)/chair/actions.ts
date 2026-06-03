'use server'

import { db } from '@/lib/db'
import { validatePinToken } from '@/lib/pin-auth'
import { processSession } from '@/lib/session-processor'
import { getSessionDisplayData } from '@/lib/session-processor'
import { z } from 'zod'

// ── Panel Chair: delete an entire grader assessment ──────────────────────────

export async function deleteAssessmentAction(
  assessmentId: string,
): Promise<EditGradeResult> {
  const token = await validatePinToken('PANEL_CHAIR')
  if (!token) return { error: 'Session expired. Please re-authenticate.' }

  const assessment = await db.graderAssessment.findUnique({
    where: { id: assessmentId },
    include: { session: { select: { id: true, classId: true } } },
  })
  if (!assessment)                                        return { error: 'Assessment not found.' }
  if (assessment.session.classId !== token.classId)      return { error: 'Unauthorized — wrong class.' }

  const sessionId = assessment.session.id

  // CriterionGrades cascade-delete via onDelete: Cascade on GraderAssessment
  await db.graderAssessment.delete({ where: { id: assessmentId } })

  // Reprocess — session may revert to OPEN if grader count drops below minimum
  await processSession(sessionId)

  const data = await getSessionDisplayData(token.classId)
  return { success: true, data }
}

// ── Panel Chair: edit a grader's criterion score ──────────────────────────────

const editGradeSchema = z.object({
  criterionGradeId: z.string().cuid(),
  newGradeValue:    z.number().int().min(1).max(8),
})

export type EditGradeResult =
  | { error: string }
  | { success: true; data: Awaited<ReturnType<typeof getSessionDisplayData>> }

export async function chairEditGradeAction(
  criterionGradeId: string,
  newGradeValue: number,
): Promise<EditGradeResult> {
  const token = await validatePinToken('PANEL_CHAIR')
  if (!token) return { error: 'Session expired. Please re-authenticate.' }

  const parsed = editGradeSchema.safeParse({ criterionGradeId, newGradeValue })
  if (!parsed.success) return { error: 'Invalid grade value.' }

  // Load the grade and verify it belongs to this chair's class
  const grade = await db.criterionGrade.findUnique({
    where: { id: criterionGradeId },
    include: {
      assessment: {
        include: { session: { select: { id: true, classId: true } } },
      },
    },
  })

  if (!grade) return { error: 'Grade record not found.' }
  if (grade.assessment.session.classId !== token.classId) {
    return { error: 'Unauthorized — wrong class.' }
  }

  const sessionId = grade.assessment.session.id

  // Update the grade with audit trail
  await db.criterionGrade.update({
    where: { id: criterionGradeId },
    data: {
      gradeValue:    newGradeValue,
      originalValue: grade.originalValue ?? grade.gradeValue,
      editedBy:      'PANEL_CHAIR',
      editedAt:      new Date(),
    },
  })

  // Reprocess — recomputes weighted sums + discontinuities
  await processSession(sessionId)

  // Return fresh data so the client can update immediately without waiting for SSE
  const data = await getSessionDisplayData(token.classId)
  return { success: true, data }
}

// ── Panel Chair: finalize a session ──────────────────────────────────────────

export async function finalizeSessionAction(sessionId: string): Promise<{ error?: string }> {
  const token = await validatePinToken('PANEL_CHAIR')
  if (!token) return { error: 'Session expired.' }

  const session = await db.gradingSession.findUnique({
    where: { id: sessionId },
    select: { classId: true, status: true },
  })

  if (!session) return { error: 'Session not found.' }
  if (session.classId !== token.classId) return { error: 'Unauthorized.' }
  if (session.status !== 'READY_TO_FINALIZE') {
    return { error: 'Session has unresolved discontinuities and cannot be finalized.' }
  }

  await db.gradingSession.update({
    where: { id: sessionId },
    data: { status: 'FINALIZED', finalizedAt: new Date() },
  })

  return {}
}
