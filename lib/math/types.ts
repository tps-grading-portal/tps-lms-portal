/**
 * Shared data types for the statistics engine.
 * SessionStats is the canonical input format for all math functions.
 */
import { NUMERIC_MAP } from '@/lib/constants'

export interface CriterionGradeStats {
  criterionId:   string
  code:          string      // "1.1", "1.2", …
  sortOrder:     number
  weight:        number
  gradeValue:    number      // 1-8 ordinal
  numericValue:  number      // NUMERIC_MAP[gradeValue]
}

export interface AssessmentStats {
  assessmentId: string
  graderName:   string
  weightedSum:  number | null
  hasFail:      boolean
  grades:       CriterionGradeStats[]
}

export interface SessionStats {
  sessionId:  string
  studentId:  string
  studentName: string
  track:      string          // Track enum
  scenario:   string          // scenario label
  classId:    string
  className:  string
  status:     string
  finalScore: number | null
  hasFail:    boolean
  assessments: AssessmentStats[]
}

// ── Aggregate result types ────────────────────────────────────────────────────

export interface SummaryStats {
  totalStudents:       number
  totalGraders:        Set<string>
  avgScore:            number | null
  scoreStdDev:         number | null
  passingRate:         number | null    // 0-1
  failRate:            number | null    // sessions with hasFail
  completeSessions:    number           // ≥4 graders, finalized
}

export interface GraderBiasStats {
  graderName:    string
  avgScore:      number
  stdDev:        number
  zScore:        number
  bias:          'Lenient' | 'Neutral' | 'Strict'
  correction:    number           // populationMean - graderMean
  totalGrades:   number
  reliability:   'Low' | 'Medium' | 'High'
}

export interface CriterionStats {
  criterionId:       string
  code:              string
  name:              string
  weight:            number
  avgDifficulty:     number | null   // avg grade on 1-8 scale (lower = easier)
  discrimination:    number | null   // point-biserial with total score
  failRate:          number | null   // fraction of grades that are 8
  icc:               number | null
  avgNumericScore:   number | null   // avg on 100-pt scale
}

export interface ReliabilityStats {
  icc:                    number | null
  iccByCriterion:         Map<string, number | null>
  kendallW:               number | null
  fleissKappa:            number | null
  cronbachAlpha:          number | null
  itemTotalCorrelations:  Map<string, number>
}

export interface GTheoryResult {
  studentVariance:   number
  graderVariance:    number
  criterionVariance: number
  residualVariance:  number
  totalVariance:     number
  studentPercent:    number
  graderPercent:     number
  criterionPercent:  number
  residualPercent:   number
  /** Predicted reliability for different grader counts (Spearman-Brown) */
  predictedByGraders: { n: number; reliability: number }[]
}

export interface ScenarioPerformance {
  scenario:         string
  studentCount:     number
  avgScore:         number | null
  stdDev:           number | null
  passRate:         number | null
  avgDifficulty:    number | null   // student-reported if survey data available
}

export interface TrackPerformance {
  track:         string
  studentCount:  number
  avgScore:      number | null
  stdDev:        number | null
  passRate:      number | null
}

export interface FullAnalysisResult {
  summary:         SummaryStats
  reliability:     ReliabilityStats
  graderBias:      GraderBiasStats[]
  criterionStats:  CriterionStats[]
  gTheory:         GTheoryResult | null
  scenarios:       ScenarioPerformance[]
  tracks:          TrackPerformance[]
  /** Raw data for heatmaps, etc. */
  scoresByGrader:  Map<string, number[]>
  scoresByTrack:   Map<string, number[]>
  scoresByScenario: Map<string, number[]>
}

/** Convert raw DB grade data to canonical SessionStats format */
export function toSessionStats(raw: {
  id: string
  studentId: string
  status: string
  finalScore: number | null
  hasFail: boolean
  student: { number: number; track: string }
  scenario: { label: string }
  class: { id: string; name: string }
  assessments: {
    id: string
    weightedSum: number | null
    hasFail: boolean
    staffMember: { name: string }
    grades: {
      criterionId: string
      gradeValue: number
      criterion: { code: string; sortOrder: number; weight: number }
    }[]
  }[]
}): SessionStats {
  return {
    sessionId:   raw.id,
    studentId:   raw.studentId,
    studentName: String(raw.student.number),
    track:       raw.student.track,
    scenario:    raw.scenario.label,
    classId:     raw.class.id,
    className:   raw.class.name,
    status:      raw.status,
    finalScore:  raw.finalScore,
    hasFail:     raw.hasFail,
    assessments: raw.assessments.map((a) => ({
      assessmentId: a.id,
      graderName:   a.staffMember.name,
      weightedSum:  a.weightedSum,
      hasFail:      a.hasFail,
      grades: a.grades.map((g) => ({
        criterionId:  g.criterionId,
        code:         g.criterion.code,
        sortOrder:    g.criterion.sortOrder,
        weight:       g.criterion.weight,
        gradeValue:   g.gradeValue,
        numericValue: NUMERIC_MAP[g.gradeValue] ?? 0,
      })),
    })),
  }
}
