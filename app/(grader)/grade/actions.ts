'use server'

import { db } from '@/lib/db'
import { validatePinToken } from '@/lib/pin-auth'
import { processSession } from '@/lib/session-processor'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// ── Submit / Update grades ────────────────────────────────────────────────────

const gradeValueSchema = z.number().int().min(1).max(8)

const submitGradesSchema = z.object({
  studentId:    z.string().cuid(),
  scenarioId:   z.string().cuid(),
  staffMemberId: z.string().cuid(),
  grades: z.record(z.string(), gradeValueSchema), // criterionId → gradeValue
})

export type SubmitGradesResult = { error: string } | { success: true; sessionId: string }

export async function submitGradesAction(
  _prev: SubmitGradesResult | null,
  formData: FormData,
): Promise<SubmitGradesResult> {
  const token = await validatePinToken('GRADER')
  if (!token) return { error: 'Session expired. Please re-authenticate.' }

  // Parse grades from formData — each criterion field is named `grade_<criterionId>`
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
  if (!parsed.success) {
    return { error: 'Invalid form data: ' + parsed.error.issues[0]?.message }
  }

  const { studentId, scenarioId, staffMemberId, grades } = parsed.data

  // Validate all 7 criteria have been graded
  const allCriteria = await db.criterion.findMany({ select: { id: true } })
  const missingCriteria = allCriteria.filter((c) => grades[c.id] === undefined)
  if (missingCriteria.length > 0) {
    return { error: `Please grade all ${allCriteria.length} criteria before submitting.` }
  }

  // Verify this student + scenario belong to the grader's class
  const [student, scenario] = await Promise.all([
    db.student.findFirst({
      where: { id: studentId, classId: token.classId },
    }),
    db.scenario.findFirst({
      where: { id: scenarioId, classId: token.classId },
    }),
  ])
  if (!student) return { error: 'Student not found in your class.' }
  if (!scenario) return { error: 'Scenario not found in your class.' }

  // Find or create the grading session for this student + scenario
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
        classId: token.classId,
        studentId,
        scenarioId,
        status: 'OPEN',
      },
    })
  }

  // Find or create the grader's assessment for this session
  let assessment = await db.graderAssessment.findUnique({
    where: {
      sessionId_staffMemberId: {
        sessionId: session.id,
        staffMemberId,
      },
    },
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
            editedBy: 'GRADER',
            editedAt: new Date(),
          },
        })
      } else {
        return db.criterionGrade.create({
          data: {
            assessmentId: assessment!.id,
            criterionId,
            gradeValue,
          },
        })
      }
    }),
  )

  // Mark assessment as submitted
  await db.graderAssessment.update({
    where: { id: assessment.id },
    data: { submittedAt: new Date() },
  })

  // Run session processing (discontinuity detection + weighted sums)
  await processSession(session.id)

  redirect(`/grade?submitted=1&sessionId=${session.id}`)
}

// ── Add student (quick-add from grader form) ──────────────────────────────────

const addStudentSchema = z.object({
  name:  z.string().min(1).max(100).transform((s) => s.trim()),
  track: z.enum(['PILOT', 'RPA', 'FTE', 'OPERATOR', 'CSO_WSO', 'ABM']),
})

export async function addStudentAction(
  _prev: { error?: string; studentId?: string } | null,
  formData: FormData,
): Promise<{ error?: string; studentId?: string }> {
  const token = await validatePinToken('GRADER')
  if (!token) return { error: 'Session expired.' }

  const parsed = addStudentSchema.safeParse({
    name:  formData.get('name'),
    track: formData.get('track'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const existing = await db.student.findFirst({
    where: { classId: token.classId, name: parsed.data.name },
  })
  if (existing) return { studentId: existing.id }

  const student = await db.student.create({
    data: { classId: token.classId, ...parsed.data },
  })

  return { studentId: student.id }
}
