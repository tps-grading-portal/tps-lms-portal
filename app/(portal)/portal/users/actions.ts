'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'

// ── Create user ───────────────────────────────────────────────────────────────

export async function createUserAction(data: {
  email:     string
  firstName: string
  lastName:  string
  role:      UserRole
  password:  string
}) {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { error: 'Insufficient permissions' }

  const email = data.email.trim().toLowerCase()
  if (!email || !email.includes('@'))          return { error: 'A valid email is required.' }
  if (!data.firstName.trim() || !data.lastName.trim()) return { error: 'First and last name are required.' }
  if (data.password.length < 12)               return { error: 'Password must be at least 12 characters.' }

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

  // If creating a STUDENT user, auto-link to an existing student profile by email
  if (data.role === 'STUDENT') {
    const studentProfile = await db.student.findUnique({ where: { email } })
    if (studentProfile && !studentProfile.userId) {
      await db.student.update({ where: { id: studentProfile.id }, data: { userId: user.id } })
    }
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
