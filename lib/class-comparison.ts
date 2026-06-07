/**
 * Cross-class performance comparison.
 *
 * Compares every class in the LMS — the two active classes AND every class
 * in the archive — against each other: overall averages, per-phase (MCG
 * department) averages, and per-event averages, ordered oldest → newest so
 * trends across cohorts are visible.
 */
import { db } from '@/lib/db'
import { deptFromCourseCode } from '@/lib/mcg-departments'

export type ClassCell = { avg: number; n: number }

export type ClassComparisonData = {
  // Oldest → newest (start date, then name)
  classes: { id: string; name: string; isActive: boolean; isArchived: boolean }[]
  overall: Record<string, ClassCell>                   // classId → avg
  byDept:  Record<string, Record<string, ClassCell>>   // deptCode → classId → avg
  byEvent: Record<string, Record<string, ClassCell>>   // courseCode → classId → avg
}

export async function computeClassComparison(): Promise<ClassComparisonData> {
  const [classes, entries] = await Promise.all([
    db.class.findMany({
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
      select:  { id: true, name: true, isActive: true, archivedAt: true, startDate: true },
    }),
    db.gradebookEntry.findMany({
      where: { status: 'SUBMITTED', overallScore: { not: null } },
      select: {
        overallScore: true,
        student:  { select: { classId: true } },
        template: { select: { courseCode: true } },
      },
    }),
  ])

  type Acc = { sum: number; n: number }
  const overallAcc = new Map<string, Acc>()
  const deptAcc    = new Map<string, Map<string, Acc>>()
  const eventAcc   = new Map<string, Map<string, Acc>>()

  const bump = (map: Map<string, Acc>, key: string, score: number) => {
    const acc = map.get(key) ?? { sum: 0, n: 0 }
    acc.sum += score
    acc.n   += 1
    map.set(key, acc)
  }

  for (const e of entries) {
    const classId = e.student.classId
    const score   = e.overallScore!
    const code    = e.template.courseCode
    const dept    = deptFromCourseCode(code)

    bump(overallAcc, classId, score)

    if (!deptAcc.has(dept)) deptAcc.set(dept, new Map())
    bump(deptAcc.get(dept)!, classId, score)

    if (!eventAcc.has(code)) eventAcc.set(code, new Map())
    bump(eventAcc.get(code)!, classId, score)
  }

  const toCells = (map: Map<string, Acc>): Record<string, ClassCell> => {
    const out: Record<string, ClassCell> = {}
    for (const [k, acc] of map) {
      out[k] = { avg: Math.round((acc.sum / acc.n) * 10) / 10, n: acc.n }
    }
    return out
  }

  // Only classes with at least one submitted grade appear in the comparison
  const overall = toCells(overallAcc)
  const gradedClasses = classes.filter(c => overall[c.id])

  const byDept: Record<string, Record<string, ClassCell>> = {}
  for (const [dept, map] of deptAcc) byDept[dept] = toCells(map)

  const byEvent: Record<string, Record<string, ClassCell>> = {}
  for (const [code, map] of eventAcc) byEvent[code] = toCells(map)

  return {
    classes: gradedClasses.map(c => ({
      id:         c.id,
      name:       c.name,
      isActive:   c.isActive,
      isArchived: c.archivedAt !== null,
    })),
    overall,
    byDept,
    byEvent,
  }
}
