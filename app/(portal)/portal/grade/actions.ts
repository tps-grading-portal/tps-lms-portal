'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { scoreEntry } from '@/lib/gradebook-scoring'
import { computeStandings } from '@/lib/standings'
import { revalidatePath } from 'next/cache'
import type { Track } from '@prisma/client'

// ── Grading queue data ────────────────────────────────────────────────────────

export type GradeQueueEntry = {
  entryId:        string
  studentId:      string
  studentNumber:  number
  studentName:    string
  track:          Track
  templateId:     string
  templateTitle:  string
  courseCode:     string
  status:         string
  submittedAt:    Date | null
  overallScore:   number | null
  overallPass:    boolean | null
}

export async function getGradeQueueAction(): Promise<{
  entries: GradeQueueEntry[]
  className: string | null
  classId: string | null
}> {
  await requireAuth()

  const activeClass = await db.class.findFirst({
    where:  { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!activeClass) return { entries: [], className: null, classId: null }

  const entries = await db.gradebookEntry.findMany({
    where: { student: { classId: activeClass.id } },
    include: {
      student:  { select: { id: true, number: true, firstName: true, lastName: true, track: true } },
      template: { select: { id: true, title: true, courseCode: true } },
    },
    orderBy: [
      { status: 'asc' },
      { student: { number: 'asc' } },
    ],
  })

  return {
    entries: entries.map((e) => ({
      entryId:       e.id,
      studentId:     e.student.id,
      studentNumber: e.student.number,
      studentName:   `${e.student.firstName} ${e.student.lastName}`.trim() || `Student ${e.student.number}`,
      track:         e.student.track,
      templateId:    e.template.id,
      templateTitle: e.template.title,
      courseCode:    e.template.courseCode,
      status:        e.status,
      submittedAt:   e.submittedAt,
      overallScore:  e.overallScore,
      overallPass:   e.overallPass,
    })),
    className: activeClass.name,
    classId:   activeClass.id,
  }
}

// ── Load one entry for the mobile form ───────────────────────────────────────

export async function getEntryForGradingAction(entryId: string) {
  await requireAuth()

  const entry = await db.gradebookEntry.findUnique({
    where:   { id: entryId },
    include: {
      student:  { select: { id: true, number: true, firstName: true, lastName: true, track: true, class: { select: { name: true } } } },
      template: { include: { tasks: { orderBy: { sortOrder: 'asc' } } } },
      scores:   true,
    },
  })

  return entry
}

// ── Save a gradebook entry (self-contained, no admin dependency) ──────────────

export async function portalSaveEntryAction(
  entryId:        string,
  instructorName: string,
  scores: Record<string, {
    scoreEntered?:       number
    numberAccomplished?: number
    isNA?:               boolean
    comments?:           string
  }>,
  submit: boolean,
) {
  const user = await requireAuth()
  if (!can(user.role, 'grade:enter')) return { error: 'Insufficient permissions to grade' }

  const entry = await db.gradebookEntry.findUnique({
    where:   { id: entryId },
    include: { template: { include: { tasks: true } }, student: { select: { classId: true } } },
  })
  if (!entry)        return { error: 'Entry not found.' }
  if (entry.isLocked) return { error: 'This gradesheet is locked.' }

  const resolvedName = instructorName || `${user.firstName} ${user.lastName}`.trim()

  // Build scoring inputs
  const taskInputs = entry.template.tasks.map((t) => {
    const s = scores[t.id]
    return {
      taskId:             t.id,
      isAirmanship:       t.isAirmanship,
      isBonus:            t.isBonus,
      isDemo:             t.isDemo,
      isNA:               s?.isNA ?? false,
      minScore:           t.minScore,
      minScoreHard:       t.minScoreHard,
      desiredScore:       t.desiredScore,
      weight:             t.weight,
      scoreEntered:       s?.scoreEntered ?? null,
      numberAccomplished: s?.numberAccomplished ?? null,
      numberRequired:     t.numberRequired,
    }
  })

  const result = scoreEntry(taskInputs)

  // Upsert task scores
  for (const t of entry.template.tasks) {
    const s = scores[t.id]
    if (!s) continue
    const taskResult = result.taskResults.find((r) => r.taskId === t.id)
    await db.gradebookTaskScore.upsert({
      where:  { entryId_taskId: { entryId, taskId: t.id } },
      update: {
        scoreEntered:       s.scoreEntered ?? null,
        numberAccomplished: s.numberAccomplished ?? 1,
        isNA:               s.isNA ?? false,
        scoreAwarded:       taskResult?.scoreAwarded ?? null,
        isAutoFail:         taskResult?.isAutoFail ?? false,
        comments:           s.comments ?? null,
      },
      create: {
        entryId,
        taskId:             t.id,
        scoreEntered:       s.scoreEntered ?? null,
        numberAccomplished: s.numberAccomplished ?? 1,
        isNA:               s.isNA ?? false,
        scoreAwarded:       taskResult?.scoreAwarded ?? null,
        isAutoFail:         taskResult?.isAutoFail ?? false,
        comments:           s.comments ?? null,
      },
    })
  }

  await db.gradebookEntry.update({
    where: { id: entryId },
    data: {
      instructorName: resolvedName,
      instructorId:   user.id,
      status:         submit ? 'SUBMITTED' : 'IN_PROGRESS',
      isLocked:       submit,
      submittedAt:    submit ? new Date() : null,
      overallScore:   submit ? result.overallScore : null,
      academicPass:   submit ? result.academicPass : null,
      airmanshipPass: submit ? result.airmanshipPass : null,
      overallPass:    submit ? result.overallPass : null,
    },
  })

  if (submit && entry.student.classId) {
    try { await computeStandings(entry.student.classId) } catch { /* non-fatal */ }
    revalidatePath('/portal/standings')
    revalidatePath('/portal/grade')
  }

  return { ok: true }
}
