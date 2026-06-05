'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { scoreEntry } from '@/lib/gradebook-scoring'
import { hashPin } from '@/lib/sandbox-auth'
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

  const templates = await db.gradesheetTemplate.findMany({
    where:  { isActive: true },
    select: { id: true, tracks: true },
  })

  const { nanoid } = await import('nanoid')

  const cls = await db.gradebookClass.create({
    data: {
      name,
      students: {
        create: students.map((s, i) => ({
          name:      s.name,
          track:     s.track,
          sortOrder: i,
          viewToken: nanoid(12),
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
  scores:        Record<string, { scoreEntered?: number; numberAccomplished?: number; isNA?: boolean; comments?: string }>,
  submit:        boolean,
  isInstructor?: boolean,
) {
  if (!isInstructor) {
    const session = await auth()
    if (!session) return { error: 'Unauthorized' }
  }

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
    if (!s && !scores[t.id]) continue
    const taskResult = result.taskResults.find((r) => r.taskId === t.id)
    await db.gradebookTaskScore.upsert({
      where:  { entryId_taskId: { entryId, taskId: t.id } },
      update: {
        scoreEntered:       s?.scoreEntered ?? null,
        numberAccomplished: s?.numberAccomplished ?? 1,
        isNA:               s?.isNA ?? false,
        scoreAwarded:       taskResult?.scoreAwarded ?? null,
        isAutoFail:         taskResult?.isAutoFail ?? false,
        comments:           s?.comments ?? null,
      },
      create: {
        entryId,
        taskId:             t.id,
        scoreEntered:       s?.scoreEntered ?? null,
        numberAccomplished: s?.numberAccomplished ?? 1,
        isNA:               s?.isNA ?? false,
        scoreAwarded:       taskResult?.scoreAwarded ?? null,
        isAutoFail:         taskResult?.isAutoFail ?? false,
        comments:           s?.comments ?? null,
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

// ── Duplicate a template ──────────────────────────────────────────────────────

export async function duplicateTemplateAction(templateId: string) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const source = await db.gradesheetTemplate.findUnique({
    where:   { id: templateId },
    include: { tasks: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!source) return { error: 'Template not found.' }

  const copy = await db.gradesheetTemplate.create({
    data: {
      courseCode:    source.courseCode + ' (copy)',
      title:         source.title + ' (copy)',
      type:          source.type,
      tracks:        source.tracks,
      airmanshipPct: source.airmanshipPct,
      bonusMaxPct:   source.bonusMaxPct,
      isActive:      true,
      tasks: {
        create: source.tasks.map((t) => ({
          sortOrder:     t.sortOrder,
          sectionLabel:  t.sectionLabel,
          isAirmanship:  t.isAirmanship,
          isBonus:       t.isBonus,
          isDemo:        t.isDemo,
          label:         t.label,
          minScore:      t.minScore,
          minScoreHard:  t.minScoreHard,
          desiredScore:  t.desiredScore,
          weight:        t.weight,
          numberRequired: t.numberRequired,
        })),
      },
    },
  })

  revalidatePath('/admin/gradebook/templates')
  return { templateId: copy.id }
}

// ── Save (update) a template ──────────────────────────────────────────────────

interface SaveTemplatePayload {
  templateId:    string
  courseCode:    string
  title:         string
  type:          string
  tracks:        string[]
  airmanshipPct: number
  tasks: {
    id?:           string
    sortOrder:     number
    label:         string
    sectionLabel:  string | null
    isAirmanship:  boolean
    isBonus:       boolean
    isDemo:        boolean
    minScore:      number | null
    minScoreHard:  boolean
    desiredScore:  number | null
    weight:        number
    numberRequired: number
  }[]
}

export async function saveTemplateAction(payload: SaveTemplatePayload): Promise<{ success: true } | { error: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const { templateId, tasks, ...header } = payload

  await db.gradesheetTemplate.update({
    where: { id: templateId },
    data: {
      courseCode:    header.courseCode,
      title:         header.title,
      type:          header.type as never,
      tracks:        header.tracks as never,
      airmanshipPct: header.airmanshipPct,
    },
  })

  // Replace all tasks
  await db.gradesheetTask.deleteMany({ where: { templateId } })
  if (tasks.length > 0) {
    await db.gradesheetTask.createMany({
      data: tasks.map((t) => ({ templateId, ...t, id: undefined })),
    })
  }

  revalidatePath(`/admin/gradebook/templates/${templateId}`)
  revalidatePath('/admin/gradebook/templates')
  return { success: true }
}

// ── Student PIN management ────────────────────────────────────────────────────

function randPin() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
}

export async function resetStudentPinAction(studentId: string): Promise<{ tempPin: string } | { error: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const tempPin = randPin()
  const hash    = await hashPin(tempPin)

  await db.gradebookStudent.update({
    where: { id: studentId },
    data:  { viewPinHash: hash, isTempPin: true },
  })

  revalidatePath('/admin/gradebook')
  return { tempPin }
}

// ── Instructor management ─────────────────────────────────────────────────────

export async function createInstructorAction(name: string, pin: string): Promise<{ success: true } | { error: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }
  if (!name.trim() || !pin.trim()) return { error: 'Name and PIN required.' }

  const existing = await db.gradebookInstructor.findUnique({ where: { name: name.trim() } })
  if (existing) return { error: 'Instructor with that name already exists.' }

  await db.gradebookInstructor.create({
    data: { name: name.trim(), pinHash: await hashPin(pin) },
  })

  revalidatePath('/admin/gradebook/instructors')
  return { success: true }
}

export async function resetInstructorPinAction(instructorId: string, newPin: string): Promise<{ success: true } | { error: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.gradebookInstructor.update({
    where: { id: instructorId },
    data:  { pinHash: await hashPin(newPin || randPin()) },
  })

  revalidatePath('/admin/gradebook/instructors')
  return { success: true }
}

export async function toggleInstructorActiveAction(instructorId: string): Promise<{ success: true } | { error: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const inst = await db.gradebookInstructor.findUnique({ where: { id: instructorId } })
  if (!inst) return { error: 'Not found.' }

  await db.gradebookInstructor.update({ where: { id: instructorId }, data: { isActive: !inst.isActive } })
  revalidatePath('/admin/gradebook/instructors')
  return { success: true }
}
