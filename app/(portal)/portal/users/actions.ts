'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import type { UserRole, DepartmentCode } from '@prisma/client'

// ── Create user (staff/instructor — students provision via class roster) ─────

export async function createUserAction(data: {
  email:       string
  firstName:   string
  lastName:    string
  role:        UserRole
  password:    string
  departments: string[]   // required (non-empty) when role = DEPT_CHAIR
}) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }

  const email = data.email.trim().toLowerCase()
  if (!email || !email.includes('@'))          return { error: 'A valid email is required.' }
  if (!data.firstName.trim() || !data.lastName.trim()) return { error: 'First and last name are required.' }
  if (data.password.length < 12)               return { error: 'Password must be at least 12 characters.' }
  if (data.role === 'STUDENT')                 return { error: 'Student access is provisioned from the class roster.' }
  if (data.role === 'DEPT_CHAIR' && data.departments.length === 0) {
    return { error: 'A Dept Chair must be assigned at least one department.' }
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return { error: 'A user with that email already exists.' }

  const user = await db.user.create({
    data: {
      email,
      firstName:    data.firstName.trim(),
      lastName:     data.lastName.trim(),
      role:         data.role,
      passwordHash: await bcrypt.hash(data.password, 12),
    },
  })

  // Department scoping for Dept Chairs
  if (data.role === 'DEPT_CHAIR' && data.departments.length > 0) {
    await db.userDepartment.createMany({
      data: data.departments.map((d, i) => ({
        userId:    user.id,
        deptCode:  d as DepartmentCode,
        isPrimary: i === 0,
      })),
      skipDuplicates: true,
    })
  }

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     'CREATE_USER',
      targetId:   user.id,
      targetType: 'User',
      metadata:   { email, role: data.role },
    },
  })

  revalidatePath('/portal/users')
  return { ok: true, userId: user.id }
}

// ── Update user ───────────────────────────────────────────────────────────────

export async function updateUserAction(userId: string, data: {
  firstName: string
  lastName:  string
  role:      UserRole
}) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }

  // Prevent demoting yourself out of admin
  if (userId === actor.id && data.role !== 'SYSTEM_ADMIN') {
    return { error: 'You cannot change your own role.' }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName.trim(),
      lastName:  data.lastName.trim(),
      role:      data.role,
    },
  })

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     'UPDATE_USER',
      targetId:   userId,
      targetType: 'User',
      metadata:   { role: data.role },
    },
  })

  revalidatePath('/portal/users')
  revalidatePath(`/portal/users/${userId}`)
  return { ok: true }
}

// ── Toggle active status ──────────────────────────────────────────────────────

export async function toggleUserActiveAction(userId: string) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }
  if (userId === actor.id) return { error: 'You cannot deactivate your own account.' }

  const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } })
  if (!user) return { error: 'User not found.' }

  await db.user.update({ where: { id: userId }, data: { isActive: !user.isActive } })

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     user.isActive ? 'DEACTIVATE_USER' : 'REACTIVATE_USER',
      targetId:   userId,
      targetType: 'User',
    },
  })

  revalidatePath('/portal/users')
  revalidatePath(`/portal/users/${userId}`)
  return { ok: true }
}

// ── Privileges: course owner / phase assignments ──────────────────────────────

export async function assignCourseAction(userId: string, syllabusEventId: string) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }

  const event = await db.syllabusEvent.findUnique({
    where:  { id: syllabusEventId },
    select: { courseCode: true },
  })
  if (!event) return { error: 'Course not found.' }

  await db.courseAssignment.upsert({
    where:  { userId_syllabusEventId: { userId, syllabusEventId } },
    update: {},
    create: { userId, syllabusEventId, assignedById: actor.id },
  })

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     'ASSIGN_COURSE_OWNER',
      targetId:   userId,
      targetType: 'User',
      metadata:   { courseCode: event.courseCode, syllabusEventId },
    },
  })

  revalidatePath(`/portal/users/${userId}`)
  revalidatePath('/portal/course-owners')
  return { ok: true }
}

export async function assignPhaseAction(userId: string, deptCode: DepartmentCode) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }

  await db.courseAssignment.upsert({
    where:  { userId_deptCode: { userId, deptCode } },
    update: {},
    create: { userId, deptCode, assignedById: actor.id },
  })

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     'ASSIGN_PHASE_OWNER',
      targetId:   userId,
      targetType: 'User',
      metadata:   { deptCode },
    },
  })

  revalidatePath(`/portal/users/${userId}`)
  revalidatePath('/portal/course-owners')
  return { ok: true }
}

export async function removeAssignmentAction(assignmentId: string) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }

  const assignment = await db.courseAssignment.findUnique({
    where:   { id: assignmentId },
    include: { syllabusEvent: { select: { courseCode: true } } },
  })
  if (!assignment) return { error: 'Assignment not found.' }

  await db.courseAssignment.delete({ where: { id: assignmentId } })

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     'REMOVE_COURSE_OWNER',
      targetId:   assignment.userId,
      targetType: 'User',
      metadata:   {
        courseCode: assignment.syllabusEvent?.courseCode ?? null,
        deptCode:   assignment.deptCode ?? null,
      },
    },
  })

  revalidatePath(`/portal/users/${assignment.userId}`)
  revalidatePath('/portal/course-owners')
  return { ok: true }
}

export async function setUserDepartmentsAction(userId: string, depts: string[]) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }

  await db.$transaction([
    db.userDepartment.deleteMany({ where: { userId } }),
    ...(depts.length > 0
      ? [db.userDepartment.createMany({
          data: depts.map((d, i) => ({ userId, deptCode: d as DepartmentCode, isPrimary: i === 0 })),
        })]
      : []),
  ])

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     'SET_USER_DEPARTMENTS',
      targetId:   userId,
      targetType: 'User',
      metadata:   { departments: depts },
    },
  })

  revalidatePath(`/portal/users/${userId}`)
  return { ok: true }
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetUserPasswordAction(userId: string, newPassword: string) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }
  if (newPassword.length < 12) return { error: 'Password must be at least 12 characters.' }

  await db.user.update({
    where: { id: userId },
    data:  { passwordHash: await bcrypt.hash(newPassword, 12) },
  })

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     'RESET_PASSWORD',
      targetId:   userId,
      targetType: 'User',
    },
  })

  return { ok: true }
}
