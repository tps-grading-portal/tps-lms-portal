'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { provisionStudentCurriculum } from '@/lib/student-provisioning'
import type { Track, Concentration } from '@prisma/client'

// ── Create class ──────────────────────────────────────────────────────────────

// TPS runs two active classes at a time. Activating a third requires
// choosing which currently-active class to deactivate.
async function checkActiveLimit(excludeClassId: string | null, deactivateClassId: string | null) {
  const active = await db.class.findMany({
    where:  { isActive: true, archivedAt: null, ...(excludeClassId ? { NOT: { id: excludeClassId } } : {}) },
    select: { id: true, name: true },
    orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
  })
  if (active.length < 2) return { ok: true as const }
  if (deactivateClassId && active.some(c => c.id === deactivateClassId)) {
    await db.class.update({ where: { id: deactivateClassId }, data: { isActive: false } })
    return { ok: true as const }
  }
  return { ok: false as const, activeClasses: active }
}

export async function createClassAction(data: {
  name:              string
  concentration:     Concentration | null
  startDate:         string | null  // YYYY-MM-DD
  endDate:           string | null
  isActive:          boolean
  deactivateClassId?: string | null  // which active class to deactivate when at the 2-class limit
}) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  const name = data.name.trim().toUpperCase()
  if (!name) return { error: 'Class name is required.' }

  const existing = await db.class.findUnique({ where: { name } })
  if (existing) return { error: `Class ${name} already exists.` }

  // Two active classes max
  if (data.isActive) {
    const limit = await checkActiveLimit(null, data.deactivateClassId ?? null)
    if (!limit.ok) return { needsDeactivation: limit.activeClasses }
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
  concentration:     Concentration | null
  startDate:         string | null
  endDate:           string | null
  isActive:          boolean
  deactivateClassId?: string | null
}) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  if (data.isActive) {
    const limit = await checkActiveLimit(classId, data.deactivateClassId ?? null)
    if (!limit.ok) return { needsDeactivation: limit.activeClasses }
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
  firstName:   string
  lastName:    string
  email:       string | null
  track:       Track
  number:      number | null  // null = auto-assign next number
  createLogin: boolean
  password:    string | null  // required when createLogin
}) {
  const user = await requireAuth()
  if (!can(user.role, 'manage:classes')) return { error: 'Insufficient permissions' }

  if (!data.firstName.trim() || !data.lastName.trim()) return { error: 'First and last name are required.' }

  const email = data.email?.trim().toLowerCase() || null
  if (data.createLogin) {
    if (!email)                 return { error: 'Email is required to create a portal login.' }
    if (!data.password || data.password.length < 12) return { error: 'Login password must be at least 12 characters.' }
    const userTaken = await db.user.findUnique({ where: { email } })
    if (userTaken) return { error: 'A portal account with that email already exists.' }
  }

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

  if (email) {
    const emailTaken = await db.student.findUnique({ where: { email } })
    if (emailTaken) return { error: 'A student with that email already exists.' }
  }

  // Optional portal login — the class dictates their curriculum below
  let userId: string | null = null
  if (data.createLogin && email && data.password) {
    const account = await db.user.create({
      data: {
        email,
        firstName:    data.firstName.trim(),
        lastName:     data.lastName.trim(),
        role:         'STUDENT',
        passwordHash: await bcrypt.hash(data.password, 12),
      },
    })
    userId = account.id
  }

  const student = await db.student.create({
    data: {
      classId,
      number,
      track:     data.track,
      firstName: data.firstName.trim(),
      lastName:  data.lastName.trim(),
      email,
      userId,
    },
  })

  await provisionStudentCurriculum(student.id, data.track)

  revalidatePath(`/portal/classes/${classId}`)
  return { ok: true, studentId: student.id }
}

// ── Create portal login for an existing student ───────────────────────────────

export async function createStudentLoginAction(studentId: string, password: string) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:classes')) return { error: 'Insufficient permissions' }
  if (password.length < 12) return { error: 'Password must be at least 12 characters.' }

  const student = await db.student.findUnique({
    where:  { id: studentId },
    select: { id: true, classId: true, firstName: true, lastName: true, email: true, userId: true, track: true },
  })
  if (!student)        return { error: 'Student not found.' }
  if (student.userId)  return { error: 'This student already has a portal login.' }
  if (!student.email)  return { error: 'Add an email to the student profile first.' }

  const userTaken = await db.user.findUnique({ where: { email: student.email } })
  if (userTaken) return { error: 'A portal account with that email already exists.' }

  const account = await db.user.create({
    data: {
      email:        student.email,
      firstName:    student.firstName,
      lastName:     student.lastName,
      role:         'STUDENT',
      passwordHash: await bcrypt.hash(password, 12),
    },
  })
  await db.student.update({ where: { id: studentId }, data: { userId: account.id } })

  // Backfill curriculum in case the student predates MCG provisioning
  await provisionStudentCurriculum(studentId, student.track)

  revalidatePath(`/portal/classes/${student.classId}`)
  return { ok: true }
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
