'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { Track, Concentration } from '@prisma/client'

// ── Create class ──────────────────────────────────────────────────────────────

export async function createClassAction(data: {
  name:          string
  concentration: Concentration | null
  startDate:     string | null  // YYYY-MM-DD
  endDate:       string | null
  isActive:      boolean
}) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  const name = data.name.trim().toUpperCase()
  if (!name) return { error: 'Class name is required.' }

  const existing = await db.class.findUnique({ where: { name } })
  if (existing) return { error: `Class ${name} already exists.` }

  // Only one active class at a time
  if (data.isActive) {
    await db.class.updateMany({ where: { isActive: true }, data: { isActive: false } })
  }

  const cls = await db.class.create({
    data: {
      name,
      cohortCode:    name,
      concentration: data.concentration,
      startDate:     data.startDate ? new Date(data.startDate) : null,
      endDate:       data.endDate ? new Date(data.endDate) : null,
      isActive:      data.isActive,
    },
  })

  revalidatePath('/portal/classes')
  return { ok: true, classId: cls.id }
}

// ── Update class ──────────────────────────────────────────────────────────────

export async function updateClassAction(classId: string, data: {
  concentration: Concentration | null
  startDate:     string | null
  endDate:       string | null
  isActive:      boolean
}) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  if (data.isActive) {
    await db.class.updateMany({ where: { isActive: true, NOT: { id: classId } }, data: { isActive: false } })
  }

  await db.class.update({
    where: { id: classId },
    data: {
      concentration: data.concentration,
      startDate:     data.startDate ? new Date(data.startDate) : null,
      endDate:       data.endDate ? new Date(data.endDate) : null,
      isActive:      data.isActive,
    },
  })

  revalidatePath('/portal/classes')
  revalidatePath(`/portal/classes/${classId}`)
  return { ok: true }
}

// ── Archive class ─────────────────────────────────────────────────────────────

export async function archiveClassAction(classId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  await db.class.update({
    where: { id: classId },
    data:  { isActive: false, archivedAt: new Date() },
  })

  revalidatePath('/portal/classes')
  return { ok: true }
}

// ── Add student to class ──────────────────────────────────────────────────────

export async function addStudentAction(classId: string, data: {
  firstName: string
  lastName:  string
  email:     string | null
  track:     Track
  number:    number | null  // null = auto-assign next number
}) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  if (!data.firstName.trim() || !data.lastName.trim()) return { error: 'First and last name are required.' }

  // Auto-assign next number if not provided
  let number = data.number
  if (!number) {
    const max = await db.student.aggregate({ where: { classId }, _max: { number: true } })
    number = (max._max.number ?? 0) + 1
  } else {
    const existing = await db.student.findUnique({
      where: { classId_number: { classId, number } },
    })
    if (existing) return { error: `Student number ${number} is already taken in this class.` }
  }

  if (data.email) {
    const emailTaken = await db.student.findUnique({ where: { email: data.email.trim().toLowerCase() } })
    if (emailTaken) return { error: 'A student with that email already exists.' }
  }

  const student = await db.student.create({
    data: {
      classId,
      number,
      track:     data.track,
      firstName: data.firstName.trim(),
      lastName:  data.lastName.trim(),
      email:     data.email?.trim().toLowerCase() || null,
    },
  })

  // Generate gradebook entries for templates matching this student's track
  const templates = await db.gradesheetTemplate.findMany({
    where:  { isActive: true, tracks: { has: data.track } },
    select: { id: true },
  })
  for (const tmpl of templates) {
    await db.gradebookEntry.upsert({
      where:  { studentId_templateId: { studentId: student.id, templateId: tmpl.id } },
      update: {},
      create: { studentId: student.id, templateId: tmpl.id },
    })
  }

  revalidatePath(`/portal/classes/${classId}`)
  return { ok: true, studentId: student.id }
}

// ── Update student ────────────────────────────────────────────────────────────

export async function updateStudentAction(studentId: string, data: {
  firstName: string
  lastName:  string
  email:     string | null
}) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  const student = await db.student.findUnique({ where: { id: studentId }, select: { classId: true } })
  if (!student) return { error: 'Student not found.' }

  if (data.email) {
    const emailTaken = await db.student.findFirst({
      where: { email: data.email.trim().toLowerCase(), NOT: { id: studentId } },
    })
    if (emailTaken) return { error: 'Another student already uses that email.' }
  }

  await db.student.update({
    where: { id: studentId },
    data: {
      firstName: data.firstName.trim(),
      lastName:  data.lastName.trim(),
      email:     data.email?.trim().toLowerCase() || null,
    },
  })

  revalidatePath(`/portal/classes/${student.classId}`)
  revalidatePath(`/portal/classes/${student.classId}/students/${studentId}`)
  return { ok: true }
}

// ── Remove student from class ─────────────────────────────────────────────────

export async function removeStudentAction(studentId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  const student = await db.student.findUnique({
    where:   { id: studentId },
    include: { entries: { where: { status: 'SUBMITTED' }, take: 1 } },
  })
  if (!student) return { error: 'Student not found.' }
  if (student.entries.length > 0) {
    return { error: 'Cannot remove a student with submitted grades. Archive the class instead.' }
  }

  await db.student.delete({ where: { id: studentId } })

  revalidatePath(`/portal/classes/${student.classId}`)
  return { ok: true }
}
