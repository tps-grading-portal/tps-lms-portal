/**
 * Item difficulty and discrimination analysis.
 * Ported from legacy buildDifficultyAnalysis() and related functions.
 *
 * Difficulty index: average grade on 1-8 scale per criterion.
 *   Lower value = easier (students score lower = grade closer to 1=WAA).
 *   Higher value = harder (students score higher = grade closer to 8=Fail).
 *
 * Discrimination index: point-biserial correlation between criterion grade
 *   and total score (higher performers vs lower performers).
 */
import type { SessionStats, CriterionStats } from './types'
import { mean, stdDev, pointBiserial, clamp } from './core'
import { AUTO_FAIL_SCORE, PASSING_SCORE, STATS_THRESHOLDS } from '@/lib/constants'

export function calculateDifficultyIndices(
  data: SessionStats[],
): Map<string, number | null> {
  const result = new Map<string, number | null>()
  const byCode = new Map<string, number[]>()

  for (const session of data) {
    for (const assessment of session.assessments) {
      for (const g of assessment.grades) {
        if (!byCode.has(g.code)) byCode.set(g.code, [])
        byCode.get(g.code)!.push(g.gradeValue)
      }
    }
  }

  for (const [code, vals] of byCode) {
    result.set(code, vals.length >= 3 ? mean(vals) : null)
  }
  return result
}

export function calculateDiscriminationIndices(
  data: SessionStats[],
): Map<string, number | null> {
  const result = new Map<string, number | null>()

  // Build per-criterion arrays aligned with total scores
  type Row = { code: string; numericValue: number; total: number }
  const rows: Row[] = []

  for (const session of data) {
    for (const assessment of session.assessments) {
      const total = assessment.weightedSum
      if (total === null || total === AUTO_FAIL_SCORE) continue
      for (const g of assessment.grades) {
        rows.push({ code: g.code, numericValue: g.numericValue, total })
      }
    }
  }

  const codes = new Set(rows.map((r) => r.code))
  for (const code of codes) {
    const codeRows = rows.filter((r) => r.code === code)
    if (codeRows.length < 5) {
      result.set(code, null)
      continue
    }
    const values = codeRows.map((r) => r.numericValue)
    const totals = codeRows.map((r) => r.total)

    // Split into high/low performers (top/bottom 27% is classic, but we use median split for small n)
    const medianTotal = [...totals].sort((a, b) => a - b)[Math.floor(totals.length / 2)]
    const highGroup   = values.filter((_, i) => totals[i] >= medianTotal)
    const lowGroup    = values.filter((_, i) => totals[i] < medianTotal)

    if (highGroup.length === 0 || lowGroup.length === 0) {
      result.set(code, null)
      continue
    }

    // Discrimination = mean(high) - mean(low) / max_possible_range
    const disc = (mean(highGroup) - mean(lowGroup)) / (100 - 69)
    result.set(code, clamp(disc, -1, 1))
  }

  return result
}

export function calculateFailureRatesByCriterion(
  data: SessionStats[],
): Map<string, number | null> {
  const result  = new Map<string, number | null>()
  const byCode  = new Map<string, { total: number; fails: number }>()

  for (const session of data) {
    for (const assessment of session.assessments) {
      for (const g of assessment.grades) {
        if (!byCode.has(g.code)) byCode.set(g.code, { total: 0, fails: 0 })
        const entry = byCode.get(g.code)!
        entry.total++
        if (g.gradeValue === 8) entry.fails++
      }
    }
  }

  for (const [code, { total, fails }] of byCode) {
    result.set(code, total >= 5 ? fails / total : null)
  }
  return result
}

// ── Grader bias analysis ──────────────────────────────────────────────────────
// Ported from calculateGraderBiasCorrections() in legacy

import type { GraderBiasStats } from './types'
import { STATS_THRESHOLDS as THRESH } from '@/lib/constants'

export function calculateGraderBiasStats(data: SessionStats[]): GraderBiasStats[] {
  const graderData = new Map<string, number[]>()
  const allScores: number[] = []

  for (const session of data) {
    for (const a of session.assessments) {
      if (a.weightedSum === null || a.weightedSum === AUTO_FAIL_SCORE) continue
      if (!graderData.has(a.graderName)) graderData.set(a.graderName, [])
      graderData.get(a.graderName)!.push(a.weightedSum)
      allScores.push(a.weightedSum)
    }
  }

  if (allScores.length < 3) return []

  const popMean   = mean(allScores)
  const popStdDev = stdDev(allScores)

  const stats: GraderBiasStats[] = []

  for (const [graderName, scores] of graderData) {
    if (scores.length === 0) continue

    const graderMean   = mean(scores)
    const graderStdDev = stdDev(scores)
    const zScore       = popStdDev === 0 ? 0 : (graderMean - popMean) / popStdDev
    const correction   = popMean - graderMean

    const bias: GraderBiasStats['bias'] =
      zScore > THRESH.GRADER_DEVIATION
        ? 'Lenient'
        : zScore < -THRESH.GRADER_DEVIATION
        ? 'Strict'
        : 'Neutral'

    const reliability: GraderBiasStats['reliability'] =
      scores.length >= 10 ? 'High' : scores.length >= 5 ? 'Medium' : 'Low'

    stats.push({ graderName, avgScore: graderMean, stdDev: graderStdDev, zScore, bias, correction, totalGrades: scores.length, reliability })
  }

  return stats.sort((a, b) => b.zScore - a.zScore)
}
