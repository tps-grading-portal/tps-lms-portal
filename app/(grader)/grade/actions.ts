'use server'

import { db } from '@/lib/db'
import { validatePinToken } from '@/lib/pin-auth'
import { processSession } from '@/lib/session-processor'
import { getCriteriaForClass } from '@/lib/criteria-utils'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// ── Submit / Update grades ────────────────────────────────────────────────────

const gradeValueSchema = z.number().int().min(1).max(8)

const submitGradesSchema = z.object({
  studentId:     z.string().cuid(),
  scenarioId:    z.string().cuid(),
  staffMemberId: z.string().cuid(),
  grades: z.record(z.string(), gradeValueSchema),
})

export type SubmitGradesResult = { error: string } | { success: true; sessionId: string }

export async function submitGradesAction(
  _prev: SubmitGradesResult | null,
  formData: FormData,
): Promise<SubmitGradesResult> {
  const token = await validatePinToken('GRADER')
  if (!token) return { error: 'Session expired. Please re-authenticate.' }

  // Parse grades
  const rawGrades: Record<string, number> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('grade_')) {
      const criterionId = key.replace('grade_', '')
      const val = parseInt(value.toString(), 10)
      if (!isNaN(val)) rawGrades[criterionId] = val
    }
  }

  const raw = {
    studentId:     formData.get('studentId')?.toString(),
    scenarioId:    formData.get('scenarioId')?.toString(),
    staffMemberId: formData.get('staffMemberId')?.toString(),
    grades: rawGrades,
  }

  const parsed = submitGradesSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Invalid form data: ' + parsed.error.issues[0]?.message }

  const { studentId, scenarioId, staffMemberId, grades } = parsed.data

  // Validate all class criteria have been graded
  const classCriteria = await getCriteriaForClass(token.classId)
  const missing = classCriteria.filter((c) => grades[c.id] === undefined)
  if (missing.length > 0) {
    return { error: `Please grade all ${classCriteria.length} criteria before submitting.` }
  }

  // Verify student belongs to this class
  const student = await db.student.findFirst({
    where: { id: studentId, classId: token.classId },
  })
  if (!student) return { error: 'Student not found in your class.' }

  // Scenarios are now global — just verify it exists
  const scenario = await db.scenario.findUnique({ where: { id: scenarioId } })
  if (!scenario) return { error: 'Scenario not found.' }

  // ── Retake detection ──────────────────────────────────────────────────────────
  // If a FINALIZED session exists for this student + scenario, this is a retake.
  const priorFinalizedSession = await db.gradingSession.findFirst({
    where: {
      classId:   token.classId,
      studentId,
      scenarioId,
      status:    'FINALIZED',
    },
    orderBy: { finalizedAt: 'desc' },
  })

  // Find or create the active (non-finalized) session
  let session = await db.gradingSession.findFirst({
    where: {
      classId: token.classId,
      studentId,
      scenarioId,
      status: { not: 'FINALIZED' },
    },
  })

  if (!session) {
    session = await db.gradingSession.create({
      data: {
        classId:       token.classId,
        studentId,
        scenarioId,
        status:        'OPEN',
        isRetake:      !!priorFinalizedSession,
        retakeSourceId: priorFinalizedSession?.id ?? null,
      },
    })
  }

  // Find or create grader's assessment
  let assessment = await db.graderAssessment.findUnique({
    where: { sessionId_staffMemberId: { sessionId: session.id, staffMemberId } },
    include: { grades: true },
  })

  if (!assessment) {
    assessment = await db.graderAssessment.create({
      data: { sessionId: session.id, staffMemberId },
      include: { grades: true },
    })
  }

  // Upsert criterion grades
  await Promise.all(
    Object.entries(grades).map(([criterionId, gradeValue]) => {
      const existing = assessment!.grades.find((g) => g.criterionId === criterionId)
      if (existing) {
        return db.criterionGrade.update({
          where: { id: existing.id },
          data: {
            gradeValue,
            originalValue: existing.originalValue ?? existing.gradeValue,
            editedBy:  'GRADER',
            editedAt:  new Date(),
          },
        })
      }
      return db.criterionGrade.create({
        data: { assessmentId: assessment!.id, criterionId, gradeValue },
      })
    }),
  )

  await db.graderAssessment.update({
    where: { id: assessment.id },
    data: { submittedAt: new Date() },
  })

  await processSession(session.id)
  // Pass back identifiers so the success screen can offer an "Edit My Submission" link
  redirect(
    `/grade?submitted=1` +
    `&sessionId=${session.id}` +
    `&isRetake=${session.isRetake ? '1' : '0'}` +
    `&editStudentId=${studentId}` +
    `&editScenarioId=${scenarioId}` +
    `&editStaffMemberId=${staffMemberId}`
  )
}
