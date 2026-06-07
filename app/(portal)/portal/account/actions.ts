'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import type { AccessRequestType, UserRole, DepartmentCode } from '@prisma/client'

// ── Change own password ───────────────────────────────────────────────────────

export async function changeOwnPasswordAction(
  currentPassword: string,
  newPassword:     string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()

  if (newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' }
  }

  const dbUser = await db.user.findUniqueOrThrow({
    where:  { id: user.id },
    select: { passwordHash: true },
  })

  const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash)
  if (!valid) return { ok: false, error: 'Current password is incorrect.' }

  await db.user.update({
    where: { id: user.id },
    data:  { passwordHash: await bcrypt.hash(newPassword, 12) },
  })

  await db.auditLog.create({
    data: {
      userId:     user.id,
      action:     'CHANGE_OWN_PASSWORD',
      targetId:   user.id,
      targetType: 'User',
    },
  })

  return { ok: true }
}

// ── Access requests (nothing is self-granted) ────────────────────────────────

export async function createAccessRequestAction(data: {
  type:          AccessRequestType
  targetId:      string | null
  targetLabel:   string | null
  justification: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()

  if (data.type !== 'OTHER' && !data.targetId) {
    return { ok: false, error: 'Pick what you are requesting access to.' }
  }
  if (data.type === 'OTHER' && !data.justification?.trim()) {
    return { ok: false, error: 'Describe what you need access to.' }
  }

  const duplicate = await db.accessRequest.findFirst({
    where: { userId: user.id, type: data.type, targetId: data.targetId, status: 'PENDING' },
  })
  if (duplicate) return { ok: false, error: 'You already have a pending request for this.' }

  const request = await db.accessRequest.create({
    data: {
      userId:        user.id,
      type:          data.type,
      targetId:      data.targetId,
      targetLabel:   data.targetLabel,
      justification: data.justification?.trim() || null,
    },
  })

  // Notify everyone who can approve (admins manage all privileges)
  const approvers = await db.user.findMany({
    where:  { isActive: true, role: 'SYSTEM_ADMIN' },
    select: { id: true },
  })
  if (approvers.length > 0) {
    await db.notification.createMany({
      data: approvers.map(a => ({
        userId: a.id,
        title:  `Access request from ${user.firstName} ${user.lastName}`,
        body:   `${REQUEST_TYPE_LABELS[data.type]}${data.targetLabel ? ` — ${data.targetLabel}` : ''}`,
        href:   '/portal/account',
      })),
    })
  }

  await db.auditLog.create({
    data: {
      userId:     user.id,
      action:     'CREATE_ACCESS_REQUEST',
      targetId:   request.id,
      targetType: 'AccessRequest',
      metadata:   { type: data.type, target: data.targetLabel ?? data.targetId },
    },
  })

  revalidatePath('/portal/account')
  return { ok: true }
}

export async function cancelAccessRequestAction(requestId: string) {
  const user = await requireAuth()

  const request = await db.accessRequest.findUnique({ where: { id: requestId } })
  if (!request || request.userId !== user.id) return { ok: false, error: 'Request not found.' }
  if (request.status !== 'PENDING') return { ok: false, error: 'Only pending requests can be withdrawn.' }

  await db.accessRequest.delete({ where: { id: requestId } })
  revalidatePath('/portal/account')
  return { ok: true }
}

const REQUEST_TYPE_LABELS: Record<AccessRequestType, string> = {
  COURSE_OWNER: 'Course owner',
  PHASE_OWNER:  'Phase owner',
  DEPARTMENT:   'Department access',
  ROLE_CHANGE:  'Role change',
  OTHER:        'Other access',
}

/**
 * Approve or deny a request. Approval APPLIES the change (course/phase
 * ownership, department, role) — all audit-logged with who approved it.
 */
export async function reviewAccessRequestAction(
  requestId: string,
  approve:   boolean,
  note?:     string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAuth()
  if (!can(actor.role, 'manage:users')) return { ok: false, error: 'Insufficient permissions' }

  const request = await db.accessRequest.findUnique({
    where:   { id: requestId },
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
  })
  if (!request) return { ok: false, error: 'Request not found.' }
  if (request.status !== 'PENDING') return { ok: false, error: 'Request was already reviewed.' }

  if (approve) {
    try {
      switch (request.type) {
        case 'COURSE_OWNER':
          if (request.targetId) {
            const existing = await db.courseAssignment.findFirst({
              where: { userId: request.userId, syllabusEventId: request.targetId },
            })
            if (!existing) {
              await db.courseAssignment.create({
                data: { userId: request.userId, syllabusEventId: request.targetId, assignedById: actor.id },
              })
            }
          }
          break
        case 'PHASE_OWNER':
          if (request.targetId) {
            const existing = await db.courseAssignment.findFirst({
              where: { userId: request.userId, deptCode: request.targetId as DepartmentCode },
            })
            if (!existing) {
              await db.courseAssignment.create({
                data: { userId: request.userId, deptCode: request.targetId as DepartmentCode, assignedById: actor.id },
              })
            }
          }
          break
        case 'DEPARTMENT':
          if (request.targetId) {
            await db.userDepartment.upsert({
              where:  { userId_deptCode: { userId: request.userId, deptCode: request.targetId as DepartmentCode } },
              create: { userId: request.userId, deptCode: request.targetId as DepartmentCode },
              update: {},
            })
          }
          break
        case 'ROLE_CHANGE':
          if (request.targetId) {
            await db.user.update({
              where: { id: request.userId },
              data:  { role: request.targetId as UserRole },
            })
          }
          break
        case 'OTHER':
          // No automatic change — the approver actions it manually
          break
      }
    } catch (err) {
      console.error('reviewAccessRequestAction apply:', err)
      return { ok: false, error: 'Failed to apply the change.' }
    }
  }

  await db.accessRequest.update({
    where: { id: requestId },
    data: {
      status:       approve ? 'APPROVED' : 'DENIED',
      reviewedById: actor.id,
      reviewedAt:   new Date(),
      reviewNote:   note?.trim() || null,
    },
  })

  await db.auditLog.create({
    data: {
      userId:     actor.id,
      action:     approve ? 'APPROVE_ACCESS_REQUEST' : 'DENY_ACCESS_REQUEST',
      targetId:   request.userId,
      targetType: 'User',
      metadata:   { requestId, type: request.type, target: request.targetLabel ?? request.targetId },
    },
  })

  // Tell the requester
  await db.notification.create({
    data: {
      userId: request.userId,
      title:  `Access request ${approve ? 'approved' : 'denied'}`,
      body:   `${REQUEST_TYPE_LABELS[request.type]}${request.targetLabel ? ` — ${request.targetLabel}` : ''}${note ? ` · ${note}` : ''}`,
      href:   '/portal/account',
    },
  })

  revalidatePath('/portal/account')
  revalidatePath('/portal/course-owners')
  revalidatePath(`/portal/users/${request.userId}`)
  return { ok: true }
}
