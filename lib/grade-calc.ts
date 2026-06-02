/**
 * Core grade calculation engine — ported from legacy-apps-script.js
 * All functions are pure TypeScript, no DB calls.
 */
import {
  NUMERIC_MAP,
  DISCONTINUITY_THRESHOLD,
  AUTO_FAIL_SCORE,
  MIN_GRADERS,
} from '@/lib/constants'

export interface GraderScore {
  staffMemberId: string
  criterionScores: Record<string, number> // criterionId → gradeValue (1-8)
}

// Convert a 1-8 grade value to its 100-point numeric equivalent
export function toNumericScore(gradeValue: number): number {
  return NUMERIC_MAP[gradeValue] ?? 0
}

// Compute weighted sum for one grader's row.
// Returns AUTO_FAIL_SCORE (69) if any criterion grade === 8.
// weights: ordered array matching the criterion sort order
export function computeWeightedSum(
  criterionGrades: { gradeValue: number; weight: number }[]
): number {
  const hasFail = criterionGrades.some((g) => g.gradeValue === 8)
  if (hasFail) return AUTO_FAIL_SCORE

  return criterionGrades.reduce((sum, g) => {
    return sum + toNumericScore(g.gradeValue) * g.weight
  }, 0)
}

// Compute the session final score: average of all grader weighted sums.
// If any grader has a fail (weightedSum === 69), returns 69.
export function computeSessionFinalScore(weightedSums: number[]): {
  finalScore: number
  hasFail: boolean
} {
  if (weightedSums.length < MIN_GRADERS) {
    throw new Error(`Need at least ${MIN_GRADERS} graders to compute final score`)
  }

  const hasFail = weightedSums.some((s) => s === AUTO_FAIL_SCORE)
  if (hasFail) return { finalScore: AUTO_FAIL_SCORE, hasFail: true }

  const avg = weightedSums.reduce((a, b) => a + b, 0) / weightedSums.length
  return { finalScore: Math.round(avg * 100) / 100, hasFail: false }
}

// Detect discontinuities for a single criterion across all graders.
// Returns a Set of assessmentIds that are discontinuous with at least one other grader.
export function detectDiscontinuities(
  grades: { assessmentId: string; gradeValue: number }[]
): Set<string> {
  const discontinuous = new Set<string>()

  for (let i = 0; i < grades.length; i++) {
    for (let j = i + 1; j < grades.length; j++) {
      if (Math.abs(grades[i].gradeValue - grades[j].gradeValue) > DISCONTINUITY_THRESHOLD) {
        discontinuous.add(grades[i].assessmentId)
        discontinuous.add(grades[j].assessmentId)
      }
    }
  }

  return discontinuous
}

// Check all criteria for discontinuities in a session.
// Returns a map of criterionId → Set<assessmentId> that are discontinuous.
export function detectSessionDiscontinuities(
  // Flat list of all criterion grades across all graders in the session
  allGrades: { assessmentId: string; criterionId: string; gradeValue: number }[]
): Map<string, Set<string>> {
  const byCriterion = new Map<string, { assessmentId: string; gradeValue: number }[]>()

  for (const grade of allGrades) {
    const existing = byCriterion.get(grade.criterionId) ?? []
    existing.push({ assessmentId: grade.assessmentId, gradeValue: grade.gradeValue })
    byCriterion.set(grade.criterionId, existing)
  }

  const result = new Map<string, Set<string>>()
  Array.from(byCriterion.entries()).forEach(([criterionId, grades]) => {
    const disc = detectDiscontinuities(grades)
    if (disc.size > 0) result.set(criterionId, disc)
  })

  return result
}

// Returns true if the session has any unresolved discontinuities
export function hasDiscontinuities(
  discontinuities: Map<string, Set<string>>
): boolean {
  return discontinuities.size > 0
}
