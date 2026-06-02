/**
 * Bayesian consensus engine — ported from legacy applyBayesianConsensusPhase1().
 *
 * Algorithm:
 *   1. Calculate historical bias per grader (graderMean - populationMean)
 *   2. Apply bias correction to each score
 *   3. Detect outliers using Modified Z-Score / MAD (threshold 3.5)
 *   4. Compute reliability-weighted average of non-outlier, bias-corrected scores
 *   5. Auto-fail propagates: any grade=8 bypasses weighting → score=69
 */
import type { SessionStats } from './types'
import { mean, median, mad, modifiedZScore, clamp } from './core'
import { AUTO_FAIL_SCORE, BAYESIAN, NUMERIC_MAP } from '@/lib/constants'

// ── Grader bias (per grader, aggregate across all criteria) ──────────────────

export interface GraderBiasCalc {
  bias:         number        // graderMean - populationMean (positive = lenient)
  reliability:  'Low' | 'Medium' | 'High' | 'Insufficient Data'
  graderAvg:    number | null
  populationAvg: number | null
  sampleSize:   number
}

export function calculateGraderBias(
  graderName: string,
  historicalData: SessionStats[],
): GraderBiasCalc {
  const graderScores: number[] = []
  const allScores: number[]    = []

  for (const session of historicalData) {
    for (const assessment of session.assessments) {
      if (assessment.weightedSum === null || assessment.weightedSum === AUTO_FAIL_SCORE) continue
      allScores.push(assessment.weightedSum)
      if (assessment.graderName === graderName) {
        graderScores.push(assessment.weightedSum)
      }
    }
  }

  if (graderScores.length < BAYESIAN.MIN_BIAS_SAMPLE || allScores.length < BAYESIAN.MIN_POPULATION_SAMPLE) {
    return { bias: 0, reliability: 'Insufficient Data', graderAvg: null, populationAvg: null, sampleSize: graderScores.length }
  }

  const graderAvg    = mean(graderScores)
  const populationAvg = mean(allScores)
  const bias         = graderAvg - populationAvg

  const reliability: GraderBiasCalc['reliability'] =
    graderScores.length >= 10 ? 'High' : graderScores.length >= 5 ? 'Medium' : 'Low'

  return { bias, reliability, graderAvg, populationAvg, sampleSize: graderScores.length }
}

// ── Grader reliability weight ─────────────────────────────────────────────────

export function calculateGraderWeight(
  graderName: string,
  historicalData: SessionStats[],
  confidence: number = 3, // default 3/5 when survey data unavailable
): number {
  // Count total grades for experience weighting
  let totalGrades = 0
  for (const session of historicalData) {
    for (const assessment of session.assessments) {
      if (assessment.graderName === graderName && assessment.weightedSum !== null) {
        totalGrades++
      }
    }
  }

  // Experience component — tiers from BAYESIAN.EXPERIENCE_TIERS
  let experienceWeight = 0.2
  for (const [minGrades, weight] of BAYESIAN.EXPERIENCE_TIERS) {
    if (totalGrades >= minGrades) { experienceWeight = weight; break }
  }

  // Consistency component — deviation from consensus (default moderate if insufficient history)
  const consistencyWeight = 0.5

  // Confidence component — scale 1-5 → 0.2-1.0
  const confidenceWeight = 0.2 + (clamp(confidence, 1, 5) - 1) * 0.2

  const combined =
    consistencyWeight * BAYESIAN.WEIGHT_CONSISTENCY +
    experienceWeight  * BAYESIAN.WEIGHT_EXPERIENCE  +
    confidenceWeight  * BAYESIAN.WEIGHT_CONFIDENCE

  return clamp(combined, 0.1, 1.0)
}

// ── Outlier detection using Modified Z-Score / MAD ───────────────────────────

export interface OutlierResult {
  outlierIndices: number[]
  statistics: {
    median:    number
    mad:       number
    threshold: number
  }
}

export function detectOutliers(
  scores: number[],
  threshold: number = BAYESIAN.OUTLIER_THRESHOLD,
): OutlierResult {
  const valid = scores.filter((s) => s !== AUTO_FAIL_SCORE)
  if (valid.length < 3) return { outlierIndices: [], statistics: { median: 0, mad: 0, threshold } }

  const m   = median(valid)
  const mad_val = mad(valid)

  const outlierIndices = scores
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s !== AUTO_FAIL_SCORE)
    .filter(({ s }) => Math.abs(modifiedZScore(s, m, mad_val)) > threshold)
    .map(({ i }) => i)

  return { outlierIndices, statistics: { median: m, mad: mad_val, threshold } }
}

// ── Full Bayesian consensus for one session ───────────────────────────────────

export interface BayesianSessionResult {
  sessionId:    string
  studentName:  string
  originalScore: number | null
  bayesianScore: number | null
  delta:        number | null
  confidence:   'High' | 'Medium' | 'Low' | 'Very Low' | 'Failure' | 'Insufficient'
  hasFailGrade: boolean
  gradesDetail: {
    graderName:     string
    originalScore:  number
    correctedScore: number
    weight:         number
    isOutlier:      boolean
    bias:           number
  }[]
}

export function applyBayesianConsensus(
  session: SessionStats,
  allHistoricalData: SessionStats[],
): BayesianSessionResult {
  const assessments = session.assessments.filter((a) => a.weightedSum !== null)

  const base: BayesianSessionResult = {
    sessionId:     session.sessionId,
    studentName:   session.studentName,
    originalScore: session.finalScore,
    bayesianScore: null,
    delta:         null,
    confidence:    'Insufficient',
    hasFailGrade:  session.hasFail,
    gradesDetail:  [],
  }

  if (assessments.length < 2) return base

  // Auto-fail: any grader gave a fail grade → score stays 69
  const hasFailGrade = assessments.some(
    (a) => a.hasFail || a.grades.some((g) => g.gradeValue === 8)
  )
  if (hasFailGrade) {
    return {
      ...base,
      bayesianScore: AUTO_FAIL_SCORE,
      delta: session.finalScore !== null ? AUTO_FAIL_SCORE - session.finalScore : null,
      confidence: 'Failure',
      hasFailGrade: true,
    }
  }

  // Step 1: Bias-correct each grader's weighted sum
  const corrected = assessments.map((a) => {
    const biasCalc = calculateGraderBias(a.graderName, allHistoricalData)
    const correctedScore = clamp((a.weightedSum ?? 0) - biasCalc.bias, 69, 100)
    const weight         = calculateGraderWeight(a.graderName, allHistoricalData)

    return {
      graderName:    a.graderName,
      originalScore: a.weightedSum!,
      correctedScore,
      weight,
      bias:          biasCalc.bias,
      isOutlier:     false,
    }
  })

  // Step 2: Detect outliers on bias-corrected scores
  const correctedValues = corrected.map((c) => c.correctedScore)
  const outlierResult   = detectOutliers(correctedValues)

  corrected.forEach((c, i) => {
    c.isOutlier = outlierResult.outlierIndices.includes(i)
  })

  // Step 3: Weighted average excluding outliers
  const valid = corrected.filter((c) => !c.isOutlier)
  if (valid.length < 1) {
    return { ...base, confidence: 'Insufficient', gradesDetail: corrected }
  }

  const totalWeight  = valid.reduce((s, c) => s + c.weight, 0)
  const weightedSum  = valid.reduce((s, c) => s + c.correctedScore * c.weight, 0)
  const bayesianScore = totalWeight > 0 ? clamp(weightedSum / totalWeight, 69, 100) : null

  // Step 4: Confidence level
  const outlierCount = outlierResult.outlierIndices.length
  let confidence: BayesianSessionResult['confidence'] =
    valid.length >= 4 && outlierCount <= 1
      ? 'High'
      : valid.length >= 3
      ? 'Medium'
      : valid.length >= 2
      ? 'Low'
      : 'Very Low'

  if (outlierCount > valid.length * 0.3) {
    confidence = confidence === 'High' ? 'Medium' : 'Low'
  }

  const rounded = bayesianScore !== null ? Math.round(bayesianScore * 100) / 100 : null
  const delta   = rounded !== null && session.finalScore !== null
    ? Math.round((rounded - session.finalScore) * 100) / 100
    : null

  return {
    ...base,
    bayesianScore: rounded,
    delta,
    confidence,
    hasFailGrade: false,
    gradesDetail: corrected,
  }
}

// ── Apply Bayesian consensus to all sessions in a class ───────────────────────

export function applyBayesianToAll(
  targetSessions: SessionStats[],
  allHistoricalData: SessionStats[],
): BayesianSessionResult[] {
  return targetSessions.map((s) => applyBayesianConsensus(s, allHistoricalData))
}
