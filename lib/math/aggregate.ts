/**
 * Fetches all grade data from the DB and runs the full statistical analysis.
 * This is the single entry point for the stats dashboard and Foundation Report.
 */
import { db } from '@/lib/db'
import { toSessionStats } from './types'
import type { SessionStats, FullAnalysisResult, SummaryStats, ScenarioPerformance, TrackPerformance } from './types'
import { calculateReliability, calculateGStudy } from './reliability'
import { calculateDifficultyIndices, calculateDiscriminationIndices, calculateFailureRatesByCriterion, calculateGraderBiasStats } from './difficulty'
import { mean, stdDev } from './core'
import { AUTO_FAIL_SCORE, PASSING_SCORE, FTC_TRACKS, STC_TRACKS } from '@/lib/constants'

// ── DB query ─────────────────────────────────────────────────────────────────

export async function fetchStatsData(classIds: string[]): Promise<SessionStats[]> {
  const raw = await db.gradingSession.findMany({
    where: {
      classId: { in: classIds },
      status:  { in: ['READY_TO_FINALIZE', 'FINALIZED'] },
    },
    include: {
      student:  true,
      scenario: true,
      class:    { select: { id: true, name: true } },
      assessments: {
        include: {
          staffMember: true,
          grades: {
            include: { criterion: true },
            orderBy: { criterion: { sortOrder: 'asc' } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return raw.map(toSessionStats)
}

/** Also fetch survey responses for the Foundation Report */
export async function fetchSurveyData(classIds: string[]) {
  const [studentSurveys, instructorSurveys] = await Promise.all([
    db.studentSurveyResponse.findMany({
      where: { classId: { in: classIds } },
      orderBy: { submittedAt: 'asc' },
    }),
    db.instructorSurveyResponse.findMany({
      where: { classId: { in: classIds } },
      orderBy: { submittedAt: 'asc' },
    }),
  ])
  return { studentSurveys, instructorSurveys }
}

/** Fetch all available classes for the class selector */
export async function fetchAvailableClasses() {
  return db.class.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select:  { id: true, name: true, isActive: true, createdAt: true },
  })
}

// ── Summary statistics ────────────────────────────────────────────────────────

function buildSummary(data: SessionStats[]): SummaryStats {
  const allGraders = new Set<string>()
  const finalScores: number[] = []

  for (const s of data) {
    for (const a of s.assessments) allGraders.add(a.graderName)
    if (s.finalScore !== null && !s.hasFail) finalScores.push(s.finalScore)
  }

  const passes    = finalScores.filter((s) => s >= PASSING_SCORE).length
  const fails     = data.filter((s) => s.hasFail).length
  const complete  = data.filter((s) => s.status === 'FINALIZED').length

  return {
    totalStudents:    data.length,
    totalGraders:     allGraders,
    avgScore:         finalScores.length ? mean(finalScores) : null,
    scoreStdDev:      finalScores.length >= 2 ? stdDev(finalScores) : null,
    passingRate:      data.length ? (passes + fails === data.length ? passes / data.length : passes / (data.length - fails + passes)) : null,
    failRate:         data.length ? fails / data.length : null,
    completeSessions: complete,
  }
}

// ── Scenario performance ──────────────────────────────────────────────────────

function buildScenarioPerformance(data: SessionStats[]): ScenarioPerformance[] {
  const byScenario = new Map<string, number[]>()

  for (const s of data) {
    if (!byScenario.has(s.scenario)) byScenario.set(s.scenario, [])
    if (s.finalScore !== null) byScenario.get(s.scenario)!.push(s.finalScore)
  }

  const result: ScenarioPerformance[] = []
  for (const [scenario, scores] of byScenario) {
    const nonFail = scores.filter((s) => s > AUTO_FAIL_SCORE)
    result.push({
      scenario,
      studentCount: scores.length,
      avgScore:     nonFail.length ? mean(nonFail) : null,
      // StdDev EXCLUDES auto-fail scores (per legacy critical requirement)
      stdDev:       nonFail.length >= 2 ? stdDev(nonFail) : null,
      passRate:     scores.length ? scores.filter((s) => s >= PASSING_SCORE).length / scores.length : null,
      avgDifficulty: null, // populated by Foundation Report if survey data available
    })
  }

  return result.sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
}

// ── Track performance ─────────────────────────────────────────────────────────

function buildTrackPerformance(data: SessionStats[]): TrackPerformance[] {
  const byTrack = new Map<string, number[]>()

  for (const s of data) {
    if (!byTrack.has(s.track)) byTrack.set(s.track, [])
    if (s.finalScore !== null) byTrack.get(s.track)!.push(s.finalScore)
  }

  const result: TrackPerformance[] = []
  for (const [track, scores] of byTrack) {
    const nonFail = scores.filter((s) => s > AUTO_FAIL_SCORE)
    result.push({
      track,
      studentCount: scores.length,
      avgScore:     nonFail.length ? mean(nonFail) : null,
      stdDev:       nonFail.length >= 2 ? stdDev(nonFail) : null,
      passRate:     scores.length ? scores.filter((s) => s >= PASSING_SCORE).length / scores.length : null,
    })
  }

  return result.sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
}

// ── Criterion-level stats (combined) ─────────────────────────────────────────

function buildCriterionStats(
  data: SessionStats[],
  criteria: { id: string; code: string; name: string; weight: number }[],
  difficulty:     Map<string, number | null>,
  discrimination: Map<string, number | null>,
  failRates:      Map<string, number | null>,
  iccByCriterion: Map<string, number | null>,
) {
  return criteria.map((c) => {
    // Average numeric score across all graders on this criterion
    const allNums: number[] = []
    for (const session of data) {
      for (const assessment of session.assessments) {
        const g = assessment.grades.find((g) => g.code === c.code)
        if (g) allNums.push(g.numericValue)
      }
    }

    return {
      criterionId:     c.id,
      code:            c.code,
      name:            c.name,
      weight:          c.weight,
      avgDifficulty:   difficulty.get(c.code) ?? null,
      discrimination:  discrimination.get(c.code) ?? null,
      failRate:        failRates.get(c.code) ?? null,
      icc:             iccByCriterion.get(c.id) ?? null,
      avgNumericScore: allNums.length ? mean(allNums) : null,
    }
  })
}

// ── Master analysis runner ────────────────────────────────────────────────────

export async function runFullAnalysis(
  classIds: string[],
): Promise<{ data: SessionStats[]; analysis: FullAnalysisResult; criteriaList: { id: string; code: string; name: string; weight: number }[] }> {
  const [data, criteriaList] = await Promise.all([
    fetchStatsData(classIds),
    db.criterion.findMany({
      orderBy: { sortOrder: 'asc' },
      select:  { id: true, code: true, name: true, weight: true },
    }),
  ])

  if (data.length === 0) {
    return {
      data,
      criteriaList,
      analysis: {
        summary:          { totalStudents: 0, totalGraders: new Set(), avgScore: null, scoreStdDev: null, passingRate: null, failRate: null, completeSessions: 0 },
        reliability:      { icc: null, iccByCriterion: new Map(), kendallW: null, fleissKappa: null, cronbachAlpha: null, itemTotalCorrelations: new Map() },
        graderBias:       [],
        criterionStats:   [],
        gTheory:          null,
        scenarios:        [],
        tracks:           [],
        scoresByGrader:   new Map(),
        scoresByTrack:    new Map(),
        scoresByScenario: new Map(),
      },
    }
  }

  const reliability     = calculateReliability(data, criteriaList)
  const difficulty      = calculateDifficultyIndices(data)
  const discrimination  = calculateDiscriminationIndices(data)
  const failRates       = calculateFailureRatesByCriterion(data)
  const graderBias      = calculateGraderBiasStats(data)
  const gTheory         = calculateGStudy(data)
  const criterionStats  = buildCriterionStats(data, criteriaList, difficulty, discrimination, failRates, reliability.iccByCriterion)

  // Raw score lookups for charts
  const scoresByGrader   = new Map<string, number[]>()
  const scoresByTrack    = new Map<string, number[]>()
  const scoresByScenario = new Map<string, number[]>()

  for (const session of data) {
    if (session.finalScore === null) continue
    if (!scoresByTrack.has(session.track)) scoresByTrack.set(session.track, [])
    scoresByTrack.get(session.track)!.push(session.finalScore)
    if (!scoresByScenario.has(session.scenario)) scoresByScenario.set(session.scenario, [])
    scoresByScenario.get(session.scenario)!.push(session.finalScore)
    for (const a of session.assessments) {
      if (a.weightedSum === null) continue
      if (!scoresByGrader.has(a.graderName)) scoresByGrader.set(a.graderName, [])
      scoresByGrader.get(a.graderName)!.push(a.weightedSum)
    }
  }

  return {
    data,
    criteriaList,
    analysis: {
      summary:         buildSummary(data),
      reliability,
      graderBias,
      criterionStats,
      gTheory,
      scenarios:       buildScenarioPerformance(data),
      tracks:          buildTrackPerformance(data),
      scoresByGrader,
      scoresByTrack,
      scoresByScenario,
    },
  }
}
