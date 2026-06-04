'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { scoreEntry } from '@/lib/gradebook-scoring'
import type { Track } from '@prisma/client'

// ── Create class + students + auto-generate gradebook entries ────────────────

export async function createGradebookClassAction(formData: FormData) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const name = formData.get('name')?.toString()?.trim()
  if (!name) return { error: 'Class name required.' }

  const studentsRaw = formData.get('students')?.toString() ?? '[]'
  let students: { name: string; track: Track }[] = []
  try { students = JSON.parse(studentsRaw) } catch { return { error: 'Invalid student data.' } }
  if (students.length === 0) return { error: 'At least one student required.' }

  // Fetch all active templates
  const templates = await db.gradesheetTemplate.findMany({
    where:  { isActive: true },
    select: { id: true, tracks: true },
  })

  const cls = await db.gradebookClass.create({
    data: {
      name,
      students: {
        create: students.map((s, i) => ({
          name:      s.name,
          track:     s.track,
          sortOrder: i,
          entries: {
            create: templates
              .filter((t) => t.tracks.includes(s.track))
              .map((t) => ({ templateId: t.id })),
          },
        })),
      },
    },
  })

  revalidatePath('/admin/gradebook')
  return { classId: cls.id }
}

// ── Save gradesheet entry (instructor submits scores) ────────────────────────

export async function saveGradebookEntryAction(
  entryId:       string,
  instructorName: string,
  scores:        Record<string, { scoreEntered: number; numberAccomplished?: number; comments?: string }>,
  submit:        boolean,
) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const entry = await db.gradebookEntry.findUnique({
    where:   { id: entryId },
    include: { template: { include: { tasks: true } } },
  })
  if (!entry) return { error: 'Entry not found.' }
  if (entry.isLocked) return { error: 'This gradesheet is locked.' }

  // Build task score inputs for scoring engine
  const taskInputs = entry.template.tasks.map((t) => {
    const s = scores[t.id]
    return {
      taskId:            t.id,
      isAirmanship:      t.isAirmanship,
      isBonus:           t.isBonus,
      isDemo:            t.isDemo,
      minScore:          t.minScore,
      minScoreHard:      t.minScoreHard,
      desiredScore:      t.desiredScore,
      weight:            t.weight,
      scoreEntered:      s?.scoreEntered ?? null,
      numberAccomplished: s?.numberAccomplished ?? null,
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
        scoreEntered:       s.scoreEntered,
        numberAccomplished: s.numberAccomplished ?? null,
        scoreAwarded:       taskResult?.scoreAwarded ?? null,
        isAutoFail:         taskResult?.isAutoFail ?? false,
        comments:           s.comments ?? null,
      },
      create: {
        entryId,
        taskId:             t.id,
        scoreEntered:       s.scoreEntered,
        numberAccomplished: s.numberAccomplished ?? null,
        scoreAwarded:       taskResult?.scoreAwarded ?? null,
        isAutoFail:         taskResult?.isAutoFail ?? false,
        comments:           s.comments ?? null,
      },
    })
  }

  await db.gradebookEntry.update({
    where: { id: entryId },
    data: {
      instructorName,
      status:        submit ? 'SUBMITTED' : 'IN_PROGRESS',
      isLocked:      submit,
      submittedAt:   submit ? new Date() : null,
      overallScore:  submit ? result.overallScore : null,
      academicPass:  submit ? result.academicPass : null,
      airmanshipPass: submit ? result.airmanshipPass : null,
      overallPass:   submit ? result.overallPass : null,
    },
  })

  revalidatePath(`/admin/gradebook`)
  return { success: true, result }
}

// ── Admin unlock a submitted entry ────────────────────────────────────────────

export async function unlockGradebookEntryAction(entryId: string) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.gradebookEntry.update({
    where: { id: entryId },
    data:  { isLocked: false, status: 'IN_PROGRESS', submittedAt: null, overallScore: null, academicPass: null, airmanshipPass: null, overallPass: null },
  })

  revalidatePath('/admin/gradebook')
  return { success: true }
}

// ── Archive / restore a template ─────────────────────────────────────────────

export async function archiveTemplateAction(templateId: string, archive: boolean) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.gradesheetTemplate.update({
    where: { id: templateId },
    data:  { isActive: !archive, archivedAt: archive ? new Date() : null },
  })

  revalidatePath('/admin/gradebook/templates')
  return { success: true }
}
