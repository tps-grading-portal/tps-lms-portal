'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { saveGradebookEntryAction } from '@/app/(admin)/admin/gradebook/actions'
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

// ── Portal-auth wrapper for saving a gradebook entry ─────────────────────────

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

  // Delegate to the existing scoring engine, bypassing admin auth (we already checked)
  const result = await saveGradebookEntryAction(
    entryId,
    instructorName || `${user.firstName} ${user.lastName}`.trim(),
    scores,
    submit,
    true, // isInstructor flag — bypasses admin session check
  )

  if ('error' in result && result.error) return { error: result.error }

  // Trigger standings recalculation for the active class
  if (submit) {
    try {
      const entry = await db.gradebookEntry.findUnique({
        where:   { id: entryId },
        include: { student: { select: { classId: true } } },
      })
      if (entry?.student?.classId) {
        await computeStandings(entry.student.classId)
      }
    } catch {
      // Non-fatal: standings will recompute on next view
    }

    revalidatePath('/portal/standings')
    revalidatePath('/portal/grade')
  }

  return { ok: true }
}
