'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generatePin } from '@/lib/utils'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ── Create Class ─────────────────────────────────────────────────────────────

const createClassSchema = z.object({
  name: z.string().min(1).max(20).transform((s) => s.trim().toUpperCase()),
  graderPin: z.string().min(4).max(20),
  chairPin: z.string().min(4).max(20),
  makeActive: z.enum(['on', 'off']).optional(),
})

export type CreateClassResult =
  | { success: true; classId: string; className: string; graderPin: string; chairPin: string }
  | { success: false; error: string }

export async function createClassAction(
  _prev: CreateClassResult | null,
  formData: FormData,
): Promise<CreateClassResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const raw = {
    name: formData.get('name'),
    graderPin: formData.get('graderPin'),
    chairPin: formData.get('chairPin'),
    makeActive: formData.get('makeActive'),
  }

  const parsed = createClassSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { name, graderPin, chairPin, makeActive } = parsed.data

  // Check for duplicate class name
  const existing = await db.class.findUnique({ where: { name } })
  if (existing) return { success: false, error: `Class "${name}" already exists.` }

  const [graderHash, chairHash] = await Promise.all([
    bcrypt.hash(graderPin, 12),
    bcrypt.hash(chairPin, 12),
  ])

  // If making this class active, deactivate all others first
  if (makeActive === 'on') {
    await db.class.updateMany({ where: { isActive: true }, data: { isActive: false } })
  }

  const newClass = await db.class.create({
    data: {
      name,
      isActive: makeActive === 'on',
      access: {
        create: [
          { role: 'GRADER', passwordHash: graderHash },
          { role: 'PANEL_CHAIR', passwordHash: chairHash },
        ],
      },
    },
  })

  revalidatePath('/admin')

  return {
    success: true,
    classId: newClass.id,
    className: newClass.name,
    graderPin,  // returned clear-text ONCE — hash stored in DB
    chairPin,   // returned clear-text ONCE
  }
}

// ── Toggle Active Class ───────────────────────────────────────────────────────

export async function setActiveClassAction(classId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  await db.$transaction([
    db.class.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    db.class.update({ where: { id: classId }, data: { isActive: true } }),
  ])

  revalidatePath('/admin')
}

export async function deactivateClassAction(classId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  await db.class.update({ where: { id: classId }, data: { isActive: false } })
  revalidatePath('/admin')
}

// ── Rotate PIN ──────���─────────────────────────────────────────────────────────

export type RotatePinResult =
  | { success: true; role: 'GRADER' | 'PANEL_CHAIR'; newPin: string }
  | { success: false; error: string }

export async function rotatePinAction(
  _prev: RotatePinResult | null,
  formData: FormData,
): Promise<RotatePinResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const classId = formData.get('classId')?.toString()
  const role = formData.get('role')?.toString() as 'GRADER' | 'PANEL_CHAIR'
  const customPin = formData.get('customPin')?.toString()?.trim()

  if (!classId || !role) return { success: false, error: 'Missing classId or role' }
  if (role !== 'GRADER' && role !== 'PANEL_CHAIR') return { success: false, error: 'Invalid role' }

  const newPin = customPin && customPin.length >= 4 ? customPin : generatePin(6)
  const hash = await bcrypt.hash(newPin, 12)

  await db.classAccess.upsert({
    where: { classId_role: { classId, role } },
    update: { passwordHash: hash },
    create: { classId, role, passwordHash: hash },
  })

  revalidatePath('/admin')

  return { success: true, role, newPin }
}
