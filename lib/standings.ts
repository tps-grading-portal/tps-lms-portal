/**
 * Standings engine — computes weighted rankings from gradebook entries.
 *
 * Algorithm:
 *  1. Pull CurriculumWeight for each (track, syllabusEventId) pair
 *  2. For each student, map their gradebook entries to syllabus events
 *  3. Weighted average = sum(score_i × weight_i) / sum(weight_i of graded events)
 *     (only events WITH a completed entry are included in the denominator)
 *  4. Return sorted list with rank, tied detection, and per-event breakdown
 */
import { db } from '@/lib/db'
import type { Track } from '@prisma/client'

export type StudentStanding = {
  studentId:       string
  studentNumber:   number
  displayName:     string
  track:           Track
  rank:            number
  weightedAvg:     number | null  // null if no graded events yet
  gradedEvents:    number
  totalEvents:     number
  breakdown: {
    courseCode:  string
    title:       string
    score:       number | null
    weightPct:   number
    contribution: number | null  // score × weightPct / 100
  }[]
}

export type StandingsResult = {
  classId:    string
  className:  string
  byTrack:    Record<Track, StudentStanding[]>
  allStudents: StudentStanding[]
  lastUpdated: Date
}


export async function computeStandings(classId: string): Promise<StandingsResult> {
  const cls = await db.class.findUniqueOrThrow({
    where: { id: classId },
    include: {
      students: {
        include: {
          entries: {
            where:   { overallScore: { not: null } },
            include: { template: { select: { courseCode: true } } },
          },
        },
      },
    },
  })

  // Load all curriculum weights
  const weights = await db.curriculumWeight.findMany({
    include: { syllabusEvent: { select: { id: true, courseCode: true, title: true } } },
  })

  // Build lookup: track → Map<courseCode, {weightPct, event}>
  type WeightEntry = { weightPct: number; eventId: string; courseCode: string; title: string }
  const weightsByTrack = new Map<Track, Map<string, WeightEntry>>()

  for (const w of weights) {
    if (!weightsByTrack.has(w.track)) weightsByTrack.set(w.track, new Map())
    weightsByTrack.get(w.track)!.set(w.syllabusEvent.courseCode, {
      weightPct:  w.weightPct,
      eventId:    w.syllabusEvent.id,
      courseCode: w.syllabusEvent.courseCode,
      title:      w.syllabusEvent.title,
    })
  }

  const allStudents: StudentStanding[] = []

  for (const student of cls.students) {
    const trackWeights = weightsByTrack.get(student.track)
    if (!trackWeights) {
      allStudents.push({
        studentId:     student.id,
        studentNumber: student.number,
        displayName:   student.lastName
          ? `${student.lastName}, ${student.firstName}`
          : `${cls.name}-${student.number}`,
        track:         student.track,
        rank:          0,
        weightedAvg:   null,
        gradedEvents:  0,
        totalEvents:   0,
        breakdown:     [],
      })
      continue
    }

    // Build score map from gradebook entries: courseCode → overallScore
    const scoreMap = new Map<string, number>()
    for (const entry of student.entries) {
      if (entry.overallScore !== null && entry.template.courseCode) {
        scoreMap.set(entry.template.courseCode, entry.overallScore)
      }
    }

    let weightedSum  = 0
    let totalWeight  = 0
    let gradedEvents = 0
    const breakdown: StudentStanding['breakdown'] = []

    for (const [courseCode, w] of trackWeights) {
      const score = scoreMap.get(courseCode) ?? null
      const contribution = score !== null ? (score * w.weightPct) / 100 : null
      if (contribution !== null) {
        weightedSum  += contribution
        totalWeight  += w.weightPct
        gradedEvents++
      }
      breakdown.push({ courseCode, title: w.title, score, weightPct: w.weightPct, contribution })
    }

    // Normalize by actual graded weight (not total 100) to keep scores meaningful while some events are pending
    const weightedAvg = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : null

    allStudents.push({
      studentId:     student.id,
      studentNumber: student.number,
      displayName:   student.lastName
        ? `${student.lastName}, ${student.firstName}`
        : `${cls.name}-${student.number}`,
      track:         student.track,
      rank:          0,
      weightedAvg:   weightedAvg !== null ? Math.round(weightedAvg * 10) / 10 : null,
      gradedEvents,
      totalEvents:   trackWeights.size,
      breakdown:     breakdown.sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    })
  }

  // Assign ranks per track (tied → same rank)
  const byTrack = {} as Record<Track, StudentStanding[]>
  const tracks = [...new Set(allStudents.map(s => s.track))]

  for (const track of tracks) {
    const group = allStudents
      .filter(s => s.track === track)
      .sort((a, b) => {
        if (a.weightedAvg === null && b.weightedAvg === null) return 0
        if (a.weightedAvg === null) return 1
        if (b.weightedAvg === null) return -1
        return b.weightedAvg - a.weightedAvg
      })

    let rank = 1
    for (let i = 0; i < group.length; i++) {
      if (i > 0 && group[i].weightedAvg !== group[i - 1].weightedAvg) {
        rank = i + 1
      }
      group[i].rank = rank
    }
    byTrack[track] = group
  }

  // Overall ranking across all tracks
  const sorted = [...allStudents].sort((a, b) => {
    if (a.weightedAvg === null && b.weightedAvg === null) return 0
    if (a.weightedAvg === null) return 1
    if (b.weightedAvg === null) return -1
    return b.weightedAvg - a.weightedAvg
  })
  let overallRank = 1
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].weightedAvg !== sorted[i - 1].weightedAvg) overallRank = i + 1
    sorted[i].rank = overallRank
  }

  return {
    classId,
    className:   cls.name,
    byTrack,
    allStudents: sorted,
    lastUpdated: new Date(),
  }
}

/**
 * Validate that weights for a track sum to 100%.
 * Returns null if valid, or an error message.
 */
export function validateTrackWeights(
  weights: { courseCode: string; weightPct: number }[],
): string | null {
  const total = weights.reduce((s, w) => s + w.weightPct, 0)
  const rounded = Math.round(total * 100) / 100
  if (Math.abs(rounded - 100) > 0.01) {
    return `Weights sum to ${rounded.toFixed(2)}% — must be exactly 100%.`
  }
  return null
}
