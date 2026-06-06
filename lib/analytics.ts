/**
 * Deterministic Early Warning Analytics
 *
 * Two alert classes:
 *  1. Student alerts — consecutive score drops, below-passing trends
 *  2. Grader alerts  — IRR hard/soft bias detected via deviation from class mean
 *
 * All logic is deterministic (no ML). Thresholds are fixed constants.
 * Results are persisted in StudentAlert table and returned for dashboard display.
 */
import { db } from '@/lib/db'
import type { AlertType, AlertSeverity, Track } from '@prisma/client'

// ── Thresholds ────────────────────────────────────────────────────────────────
const CONSECUTIVE_DROP_THRESHOLD = 3      // 3+ consecutive score drops → alert
const BELOW_PASSING_THRESHOLD    = 70     // score < 70
const GRADER_HARD_BIAS_DELTA     = 15     // avg score >15 pts below class avg → hard bias
const GRADER_SOFT_BIAS_DELTA     = 8      // avg score >8 pts below class avg → soft bias

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnalyticsAlert = {
  type:        AlertType
  severity:    AlertSeverity  // INFO | WARNING | CRITICAL
  studentId?:  string
  studentName: string
  message:     string
  metadata:    Record<string, unknown>
}

export type GraderBiasAlert = {
  instructorId:   string
  instructorName: string
  avgScore:       number
  classAvg:       number
  delta:          number
  severity:       'hard' | 'soft'
  sampleSize:     number
}

export type ClassAnalytics = {
  classId:        string
  className:      string
  studentAlerts:  AnalyticsAlert[]
  graderAlerts:   GraderBiasAlert[]
  summary: {
    totalStudents:  number
    atRiskCount:    number
    gradedEvents:   number
    avgClassScore:  number | null
  }
  lastUpdated:    Date
}

// ── Student early warning ──────────────────────────────────────────────────────

/**
 * Detect consecutive score drops for a student across ordered gradebook entries.
 * Returns alert if 3+ consecutive score drops detected in any competency sequence.
 */
export function detectConsecutiveDrops(
  scores: { courseCode: string; score: number; submittedAt: Date }[],
): { triggered: boolean; dropCount: number; events: string[] } {
  if (scores.length < CONSECUTIVE_DROP_THRESHOLD) return { triggered: false, dropCount: 0, events: [] }

  const sorted = [...scores].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
  let maxDropRun = 0
  let currentRun = 0
  let dropEvents: string[] = []
  let bestDropEvents: string[] = []

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].score < sorted[i - 1].score) {
      currentRun++
      dropEvents.push(sorted[i].courseCode)
      if (currentRun > maxDropRun) {
        maxDropRun = currentRun
        bestDropEvents = [sorted[i - 1].courseCode, ...dropEvents]
      }
    } else {
      currentRun = 0
      dropEvents = []
    }
  }

  return {
    triggered:  maxDropRun >= CONSECUTIVE_DROP_THRESHOLD - 1,
    dropCount:  maxDropRun,
    events:     bestDropEvents,
  }
}

/**
 * Detect below-passing trend (majority of recent grades below 70).
 */
export function detectBelowPassingTrend(
  scores: { score: number }[],
  windowSize = 5,
): { triggered: boolean; belowCount: number } {
  if (scores.length === 0) return { triggered: false, belowCount: 0 }
  const window = scores.slice(-windowSize)
  const belowCount = window.filter(s => s.score < BELOW_PASSING_THRESHOLD).length
  return {
    triggered: belowCount >= Math.ceil(windowSize / 2),
    belowCount,
  }
}

// ── Grader bias (IRR) ─────────────────────────────────────────────────────────

export function detectGraderBias(
  graderScores: { instructorId: string; instructorName: string; scores: number[] }[],
): GraderBiasAlert[] {
  if (graderScores.length < 2) return []

  const allScores = graderScores.flatMap(g => g.scores)
  if (allScores.length === 0) return []

  const classAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length
  const results: GraderBiasAlert[] = []

  for (const grader of graderScores) {
    if (grader.scores.length < 3) continue
    const graderAvg = grader.scores.reduce((a, b) => a + b, 0) / grader.scores.length
    const delta = classAvg - graderAvg
    const absDelta = Math.abs(delta)

    if (absDelta >= GRADER_HARD_BIAS_DELTA) {
      results.push({
        instructorId:   grader.instructorId,
        instructorName: grader.instructorName,
        avgScore:       Math.round(graderAvg * 10) / 10,
        classAvg:       Math.round(classAvg * 10) / 10,
        delta:          Math.round(delta * 10) / 10,
        severity:       'hard',
        sampleSize:     grader.scores.length,
      })
    } else if (absDelta >= GRADER_SOFT_BIAS_DELTA) {
      results.push({
        instructorId:   grader.instructorId,
        instructorName: grader.instructorName,
        avgScore:       Math.round(graderAvg * 10) / 10,
        classAvg:       Math.round(classAvg * 10) / 10,
        delta:          Math.round(delta * 10) / 10,
        severity:       'soft',
        sampleSize:     grader.scores.length,
      })
    }
  }
  return results
}

// ── Main analytics computation ────────────────────────────────────────────────

export async function computeClassAnalytics(classId: string): Promise<ClassAnalytics> {
  const cls = await db.class.findUniqueOrThrow({
    where: { id: classId },
    include: {
      students: {
        include: {
          entries: {
            where:   { overallScore: { not: null }, submittedAt: { not: null } },
            include: { template: { select: { courseCode: true } } },
          },
          alerts: { where: { resolvedAt: null } },
        },
      },
    },
  })

  const studentAlerts: AnalyticsAlert[] = []

  let totalScores = 0
  let scoreSum    = 0
  let gradedEvents = 0

  for (const student of cls.students) {
    if (student.entries.length === 0) continue

    const scores = student.entries.map(e => ({
      courseCode:  e.template.courseCode,
      score:       e.overallScore!,
      submittedAt: e.submittedAt!,
    }))

    totalScores += scores.length
    scoreSum    += scores.reduce((s, e) => s + e.score, 0)
    gradedEvents++

    const displayName = student.lastName
      ? `${student.lastName}, ${student.firstName}`
      : `${cls.name}-${student.number}`

    // Consecutive drop check
    const dropCheck = detectConsecutiveDrops(scores)
    if (dropCheck.triggered) {
      studentAlerts.push({
        type:        'CONSECUTIVE_SCORE_DROPS' as AlertType,
        severity:    (dropCheck.dropCount >= 4 ? 'CRITICAL' : 'WARNING') as AlertSeverity,
        studentId:   student.id,
        studentName: displayName,
        message:     `${dropCheck.dropCount + 1} consecutive score drops detected`,
        metadata:    { events: dropCheck.events, dropCount: dropCheck.dropCount },
      })
    }

    // Below-passing trend
    const trendCheck = detectBelowPassingTrend(scores)
    if (trendCheck.triggered) {
      studentAlerts.push({
        type:        'BELOW_PASSING_THRESHOLD' as AlertType,
        severity:    'CRITICAL' as AlertSeverity,
        studentId:   student.id,
        studentName: displayName,
        message:     `${trendCheck.belowCount} of last 5 grades below passing (70%)`,
        metadata:    { belowCount: trendCheck.belowCount },
      })
    }
  }

  // Grader bias analysis from gradebook entries
  const entriesByInstructor = await db.gradebookEntry.groupBy({
    by:    ['instructorId', 'instructorName'],
    where: { student: { classId }, overallScore: { not: null }, instructorId: { not: null } },
  })

  const graderData = await Promise.all(
    entriesByInstructor.map(async g => {
      const entries = await db.gradebookEntry.findMany({
        where:  { instructorId: g.instructorId, student: { classId }, overallScore: { not: null } },
        select: { overallScore: true, instructor: { select: { firstName: true, lastName: true } } },
      })
      const firstEntry = entries[0]
      return {
        instructorId:   g.instructorId!,
        instructorName: firstEntry?.instructor
          ? `${firstEntry.instructor.lastName}, ${firstEntry.instructor.firstName}`
          : (g.instructorName ?? 'Unknown'),
        scores:         entries.map(e => e.overallScore!),
      }
    }),
  )

  const graderAlerts = detectGraderBias(graderData)

  return {
    classId,
    className:     cls.name,
    studentAlerts,
    graderAlerts,
    summary: {
      totalStudents: cls.students.length,
      atRiskCount:   studentAlerts.filter(a => a.severity === 'CRITICAL').length,
      gradedEvents,
      avgClassScore: totalScores > 0 ? Math.round((scoreSum / totalScores) * 10) / 10 : null,
    },
    lastUpdated: new Date(),
  }
}

/**
 * Persist new alerts to the database, deduplicating against existing open alerts.
 */
export async function persistAlerts(alerts: AnalyticsAlert[]): Promise<void> {
  for (const alert of alerts) {
    if (!alert.studentId) continue

    const existing = await db.studentAlert.findFirst({
      where: {
        studentId:  alert.studentId,
        type:       alert.type,
        resolvedAt: null,
      },
    })
    if (existing) continue

    await db.studentAlert.create({
      data: {
        studentId: alert.studentId,
        type:      alert.type,
        severity:  alert.severity,
        message:   alert.message,
        metadata:  alert.metadata as object,
      },
    })
  }
}
