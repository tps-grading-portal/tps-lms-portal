/**
 * Session processor — the core engine.
 * Called after every grade submission or edit.
 * Computes weighted sums, detects discontinuities, updates session status.
 * Pure DB operations — no HTTP concerns.
 */
import { db } from '@/lib/db'
import { computeWeightedSum, detectSessionDiscontinuities } from '@/lib/grade-calc'
import { MIN_GRADERS, AUTO_FAIL_SCORE, PASSING_SCORE } from '@/lib/constants'
import { getCriteriaForClass } from '@/lib/criteria-utils'

export async function processSession(sessionId: string): Promise<void> {
  // Single query — load session + all assessments + all grades + criterion weights
  const session = await db.gradingSession.findUnique({
    where: { id: sessionId },
    include: {
      assessments: {
        include: {
          grades: {
            include: { criterion: { select: { id: true, weight: true } } },
          },
        },
      },
    },
  })

  if (!session) throw new Error(`Session ${sessionId} not found`)

  // Use class-specific criteria if available, otherwise fall back to global template
  const allCriteria = await getCriteriaForClass(session.classId)

  const totalCriteria = allCriteria.length

  // Only assessments where all criteria have been graded count toward the minimum
  const completeAssessments = session.assessments.filter(
    (a) => a.grades.length === totalCriteria,
  )

  // Not enough graders yet
  if (completeAssessments.length < MIN_GRADERS) {
    await db.gradingSession.update({
      where: { id: sessionId },
      data: { status: 'OPEN', finalScore: null, hasFail: false },
    })
    return
  }

  // ── Step 1: Compute weighted sum per grader ──────────────────────────────────
  await Promise.all(
    completeAssessments.map((assessment) => {
      const gradeInputs = assessment.grades.map((g) => ({
        gradeValue: g.gradeValue,
        weight: g.criterion.weight,
      }))
      const weightedSum = computeWeightedSum(gradeInputs)
      const hasFail = gradeInputs.some((g) => g.gradeValue === 8)
      return db.graderAssessment.update({
        where: { id: assessment.id },
        data: { weightedSum, hasFail },
      })
    }),
  )

  // ── Step 2: Detect discontinuities across all complete assessments ────────────
  const allGrades = completeAssessments.flatMap((a) =>
    a.grades.map((g) => ({
      assessmentId: a.id,
      criterionId: g.criterionId,
      gradeValue: g.gradeValue,
    })),
  )

  const discontinuityMap = detectSessionDiscontinuities(allGrades)

  // ── Step 3: Update isDiscontinuity flags in batch ─────────────────────────────
  await Promise.all(
    completeAssessments.flatMap((assessment) =>
      assessment.grades.map((grade) => {
        const isDisc =
          discontinuityMap.get(grade.criterionId)?.has(assessment.id) ?? false
        return db.criterionGrade.update({
          where: { id: grade.id },
          data: { isDiscontinuity: isDisc },
        })
      }),
    ),
  )

  // ── Step 4: Update session status and final score ────────────────────────────
  if (discontinuityMap.size > 0) {
    // Outstanding discontinuities — Panel Chair must resolve
    await db.gradingSession.update({
      where: { id: sessionId },
      data: { status: 'PENDING_RESOLUTION', finalScore: null, hasFail: false },
    })
    return
  }

  // No discontinuities — compute final score from updated weighted sums
  const updatedAssessments = await db.graderAssessment.findMany({
    where: { id: { in: completeAssessments.map((a) => a.id) } },
    select: { weightedSum: true, hasFail: true },
  })

  const hasFail = updatedAssessments.some((a) => a.hasFail)

  if (hasFail) {
    await db.gradingSession.update({
      where: { id: sessionId },
      data: { status: 'READY_TO_FINALIZE', finalScore: AUTO_FAIL_SCORE, hasFail: true },
    })
    return
  }

  const sums = updatedAssessments.map((a) => a.weightedSum ?? 0)
  const avgScore = sums.reduce((a, b) => a + b, 0) / sums.length
  const finalScore = Math.round(avgScore * 100) / 100

  // Retake rule: if this is a retake and the student passes,
  // the official output score is capped at exactly 70.0
  const outputScore =
    session.isRetake && finalScore >= PASSING_SCORE ? PASSING_SCORE : finalScore

  await db.gradingSession.update({
    where: { id: sessionId },
    data: {
      status: 'READY_TO_FINALIZE',
      finalScore,
      outputScore,
      hasFail: false,
    },
  })
}

// ── Query helper: full session display data for Chair dashboard ───────────────

export type SessionDisplayData = Awaited<ReturnType<typeof getSessionDisplayData>>

export async function getSessionDisplayData(classId: string) {
  const [sessions, criteria] = await Promise.all([
    db.gradingSession.findMany({
      where: {
        classId,
        status: { not: 'FINALIZED' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { number: true, track: true } },
        scenario: { select: { number: true, label: true } },
        assessments: {
          include: {
            staffMember: { select: { name: true } },
            grades: {
              select: {
                id: true,
                criterionId: true,
                gradeValue: true,
                isDiscontinuity: true,
                editedBy: true,
                originalValue: true,
              },
              orderBy: { criterion: { sortOrder: 'asc' } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    getCriteriaForClass(classId).then((criteria) =>
      criteria.map((c) => ({ id: c.id, code: c.code, name: c.name, sortOrder: c.sortOrder }))
    ),
  ])

  return { sessions, criteria }
}
