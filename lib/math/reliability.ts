/**
 * Inter-rater reliability and internal consistency statistics.
 * Ported exactly from legacy-apps-script.js.
 *
 * Functions: ICC(2,k), Kendall's W, Fleiss' Kappa, Cronbach's Alpha,
 *            item-total correlations, G-theory, Spearman-Brown prophecy.
 */
import type { SessionStats, ReliabilityStats, GTheoryResult } from './types'
import { mean, variance, stdDev, pearsonR, clamp } from './core'
import { AUTO_FAIL_SCORE, PASSING_SCORE } from '@/lib/constants'

const MIN_GRADERS_FOR_STATS = 2
const MIN_STUDENTS_FOR_STATS = 2

// ── Helper: get complete assessments (all criteria graded) ────────────────────

function completeAssessments(session: SessionStats) {
  // Only count assessments that have grades submitted
  return session.assessments.filter((a) => a.grades.length > 0 && a.weightedSum !== null)
}

// ── ICC(2,k) — Intraclass Correlation Coefficient ────────────────────────────
// Simplified two-way random effects model (legacy approximation)

export function calculateICC(data: SessionStats[]): number | null {
  const eligible = data.filter((s) => completeAssessments(s).length >= MIN_GRADERS_FOR_STATS)
  if (eligible.length < MIN_STUDENTS_FOR_STATS) return null

  let MSB = 0
  let MSW = 0
  let totalStudents = 0
  let totalGraders  = 0

  for (const session of eligible) {
    const scores = completeAssessments(session)
      .map((a) => a.weightedSum!)
      .filter((s) => s !== AUTO_FAIL_SCORE)

    if (scores.length < MIN_GRADERS_FOR_STATS) continue

    totalStudents++
    totalGraders += scores.length

    const studentMean = mean(scores)
    const studentVar  = variance(scores)

    MSW += studentVar * (scores.length - 1)
    MSB += scores.length * Math.pow(studentMean, 2)
  }

  if (totalStudents < MIN_STUDENTS_FOR_STATS || totalGraders < 4) return null

  MSB = MSB / totalStudents
  MSW = MSW / (totalGraders - totalStudents)
  if (MSB === 0) return null

  return clamp((MSB - MSW) / MSB, 0, 1)
}

// ── ICC by criterion ─────────────────────────────────────────────────────────

export function calculateICCByCriterion(data: SessionStats[]): Map<string, number | null> {
  // Collect all unique criterion codes
  const criterionIds = new Set<string>()
  for (const s of data) {
    for (const a of s.assessments) {
      for (const g of a.grades) criterionIds.add(g.criterionId)
    }
  }

  const result = new Map<string, number | null>()

  for (const criterionId of criterionIds) {
    const eligible = data.filter((s) =>
      completeAssessments(s).filter((a) =>
        a.grades.some((g) => g.criterionId === criterionId)
      ).length >= MIN_GRADERS_FOR_STATS
    )

    if (eligible.length < MIN_STUDENTS_FOR_STATS) {
      result.set(criterionId, null)
      continue
    }

    let MSB = 0, MSW = 0, totalStu = 0, totalGra = 0

    for (const session of eligible) {
      const scores = completeAssessments(session)
        .map((a) => {
          const g = a.grades.find((g) => g.criterionId === criterionId)
          return g ? g.numericValue : null
        })
        .filter((s): s is number => s !== null)

      if (scores.length < MIN_GRADERS_FOR_STATS) continue
      totalStu++
      totalGra += scores.length
      MSW += variance(scores) * (scores.length - 1)
      MSB += scores.length * Math.pow(mean(scores), 2)
    }

    if (totalStu < MIN_STUDENTS_FOR_STATS || totalGra < 4) {
      result.set(criterionId, null)
      continue
    }

    MSB = MSB / totalStu
    MSW = MSW / (totalGra - totalStu)
    result.set(criterionId, MSB === 0 ? null : clamp((MSB - MSW) / MSB, 0, 1))
  }

  return result
}

// ── Kendall's W — Coefficient of Concordance ─────────────────────────────────
// Simplified rank-variance approach (legacy implementation)

export function calculateKendallW(data: SessionStats[]): number | null {
  const eligible = data.filter((s) => completeAssessments(s).length >= MIN_GRADERS_FOR_STATS)
  if (eligible.length < MIN_STUDENTS_FOR_STATS) return null

  let totalRankVariance = 0
  let totalStudents = 0
  let totalGraders  = 0

  for (const session of eligible) {
    const scores = completeAssessments(session)
      .map((a) => a.weightedSum!)
      .filter((s) => s !== AUTO_FAIL_SCORE)

    if (scores.length < MIN_GRADERS_FOR_STATS) continue

    const sorted = [...scores].sort((a, b) => a - b)
    const ranks  = scores.map((s) => sorted.indexOf(s) + 1)

    totalRankVariance += variance(ranks)
    totalStudents++
    totalGraders += scores.length
  }

  if (totalStudents < MIN_STUDENTS_FOR_STATS) return null

  const avgRankVariance = totalRankVariance / totalStudents
  const avgGraders      = totalGraders / totalStudents
  const maxRankVariance = (Math.pow(avgGraders, 2) - 1) / 12
  if (maxRankVariance === 0) return null

  return clamp(avgRankVariance / maxRankVariance, 0, 1)
}

// ── Fleiss' Kappa — Pass/Fail Agreement ──────────────────────────────────────

export function calculateFleissKappa(data: SessionStats[]): number | null {
  const eligible = data.filter((s) => completeAssessments(s).length >= MIN_GRADERS_FOR_STATS)
  if (eligible.length < MIN_STUDENTS_FOR_STATS) return null

  let totalP  = 0
  let totalPe = 0
  let n       = 0

  for (const session of eligible) {
    const graders = completeAssessments(session)
    if (graders.length < MIN_GRADERS_FOR_STATS) continue

    // 1 = fail (any grade of 8), 0 = pass
    const results = graders.map((a) =>
      a.hasFail || a.grades.some((g) => g.gradeValue === 8) ? 1 : 0
    )

    const k        = results.length
    const failProp = results.filter((r) => r === 1).length / k
    const passProp = 1 - failProp

    const pi = Math.pow(failProp, 2) + Math.pow(passProp, 2)
    const piAdjusted = (pi * k) / (k - 1)

    totalP  += piAdjusted
    totalPe += failProp * passProp
    n++
  }

  if (n < MIN_STUDENTS_FOR_STATS) return null

  const P  = totalP  / n
  const Pe = totalPe / n

  if (Pe >= 1) return null

  return clamp((P - Pe) / (1 - Pe), -1, 1)
}

// ── Cronbach's Alpha — Internal Consistency ───────────────────────────────────

export function calculateCronbachAlpha(data: SessionStats[]): number | null {
  // Each "student" is one observation; "items" are criterion grade values
  const eligible = data.filter((s) => completeAssessments(s).length >= 1)
  if (eligible.length < 3) return null

  // Collect all criterion codes
  const criterionCodes = new Set<string>()
  for (const s of eligible) {
    for (const a of s.assessments) {
      for (const g of a.grades) criterionCodes.add(g.code)
    }
  }
  const codes = Array.from(criterionCodes).sort()
  if (codes.length < 2) return null

  // Build item scores matrix: each row = one grader-assessment, each column = criterion
  const rows: number[][] = []

  for (const session of eligible) {
    for (const assessment of completeAssessments(session)) {
      const row = codes.map((code) => {
        const g = assessment.grades.find((g) => g.code === code)
        return g ? g.numericValue : 0
      })
      rows.push(row)
    }
  }

  if (rows.length < 3) return null

  const k = codes.length
  // Variance of each item across all rows
  const itemVariances = codes.map((_, colIdx) => {
    const vals = rows.map((r) => r[colIdx])
    return variance(vals)
  })
  const sumItemVariances = itemVariances.reduce((a, b) => a + b, 0)

  // Variance of row totals
  const rowTotals = rows.map((r) => r.reduce((a, b) => a + b, 0))
  const totalVariance = variance(rowTotals)

  if (totalVariance === 0) return null

  const alpha = (k / (k - 1)) * (1 - sumItemVariances / totalVariance)
  return clamp(alpha, 0, 1)
}

// ── Item-Total Correlations ───────────────────────────────────────────────────

export function calculateItemTotalCorrelations(data: SessionStats[]): Map<string, number> {
  const result  = new Map<string, number>()
  const rows: { code: string; value: number; total: number }[] = []

  for (const session of data) {
    for (const assessment of completeAssessments(session)) {
      const total = assessment.weightedSum ?? 0
      if (total === AUTO_FAIL_SCORE) continue
      for (const g of assessment.grades) {
        rows.push({ code: g.code, value: g.numericValue, total })
      }
    }
  }

  const codes = new Set(rows.map((r) => r.code))
  for (const code of codes) {
    const codeRows = rows.filter((r) => r.code === code)
    const values   = codeRows.map((r) => r.value)
    const totals   = codeRows.map((r) => r.total)
    result.set(code, pearsonR(values, totals))
  }

  return result
}

// ── Generalizability Theory — Variance Components ────────────────────────────

export function calculateGStudy(data: SessionStats[]): GTheoryResult | null {
  const eligible = data.filter(
    (s) => completeAssessments(s).length >= MIN_GRADERS_FOR_STATS
  )
  if (eligible.length < MIN_STUDENTS_FOR_STATS) return null

  const studentMeans: number[]   = []
  const graderScores: Map<string, number[]> = new Map()
  const criterionScores: Map<string, number[]> = new Map()
  const allScores: number[]  = []

  for (const session of eligible) {
    const assessments = completeAssessments(session).filter(
      (a) => a.weightedSum !== AUTO_FAIL_SCORE
    )
    if (assessments.length === 0) continue

    const scores = assessments.map((a) => a.weightedSum!)
    studentMeans.push(mean(scores))

    for (const assessment of assessments) {
      if (!graderScores.has(assessment.graderName)) {
        graderScores.set(assessment.graderName, [])
      }
      graderScores.get(assessment.graderName)!.push(assessment.weightedSum!)
      allScores.push(assessment.weightedSum!)

      for (const grade of assessment.grades) {
        if (!criterionScores.has(grade.code)) {
          criterionScores.set(grade.code, [])
        }
        criterionScores.get(grade.code)!.push(grade.numericValue)
      }
    }
  }

  if (studentMeans.length < MIN_STUDENTS_FOR_STATS) return null

  const studentVar   = variance(studentMeans)
  const graderAvgs   = Array.from(graderScores.values()).map(mean)
  const graderVar    = graderAvgs.length >= 2 ? variance(graderAvgs) : 0
  const critAvgs     = Array.from(criterionScores.values()).map(mean)
  const criterionVar = critAvgs.length >= 2 ? variance(critAvgs) : 0
  const totalVar     = allScores.length >= 2 ? variance(allScores) : 0
  const residualVar  = Math.max(0, totalVar - studentVar - graderVar - criterionVar)

  const adjusted = studentVar + graderVar + criterionVar + residualVar
  if (adjusted === 0) return null

  const singleReliability = studentVar / adjusted

  const predictedByGraders = [1, 2, 3, 4, 5, 6].map((n) => ({
    n,
    reliability: spearmanBrown(singleReliability, n),
  }))

  return {
    studentVariance:   studentVar,
    graderVariance:    graderVar,
    criterionVariance: criterionVar,
    residualVariance:  residualVar,
    totalVariance:     adjusted,
    studentPercent:    studentVar / adjusted,
    graderPercent:     graderVar / adjusted,
    criterionPercent:  criterionVar / adjusted,
    residualPercent:   residualVar / adjusted,
    predictedByGraders,
  }
}

// ── Spearman-Brown Prophecy Formula ──────────────────────────────────────────

export function spearmanBrown(singleGraderReliability: number, k: number): number {
  if (singleGraderReliability <= 0) return 0
  if (singleGraderReliability >= 1) return 1
  return clamp(
    (k * singleGraderReliability) / (1 + (k - 1) * singleGraderReliability),
    0,
    1,
  )
}

// ── Bundle all reliability stats ──────────────────────────────────────────────

export function calculateReliability(
  data: SessionStats[],
  criteria: { id: string; code: string }[],
): ReliabilityStats {
  const iccByCriterion = calculateICCByCriterion(data)

  return {
    icc:                   calculateICC(data),
    iccByCriterion,
    kendallW:              calculateKendallW(data),
    fleissKappa:           calculateFleissKappa(data),
    cronbachAlpha:         calculateCronbachAlpha(data),
    itemTotalCorrelations: calculateItemTotalCorrelations(data),
  }
}
