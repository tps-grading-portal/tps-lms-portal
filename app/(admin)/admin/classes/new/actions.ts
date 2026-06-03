'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { snapshotCriteriaForClass } from '@/lib/criteria-utils'
import { generateStudentCsv } from '@/lib/student-utils'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ── Create class with full snapshot ──────────────────────────────────────────

const schema = z.object({
  name:          z.string().min(1).max(20).transform((s) => s.trim().toUpperCase()),
  studentCount:  z.coerce.number().int().min(1).max(500),
  graderPin:     z.string().min(4).max(20),
  chairPin:      z.string().min(4).max(20),
  makeActive:    z.enum(['on', 'off']).optional(),
})

export type CreateClassWizardResult =
  | { success: true; classId: string; className: string; studentCount: number; graderPin: string; chairPin: string }
  | { success: false; error: string }

export async function createClassWizardAction(
  _prev: CreateClassWizardResult | null,
  formData: FormData,
): Promise<CreateClassWizardResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const parsed = schema.safeParse({
    name:         formData.get('name'),
    studentCount: formData.get('studentCount'),
    graderPin:    formData.get('graderPin'),
    chairPin:     formData.get('chairPin'),
    makeActive:   formData.get('makeActive'),
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { name, studentCount, graderPin, chairPin, makeActive } = parsed.data

  const existing = await db.class.findUnique({ where: { name } })
  if (existing) return { success: false, error: `Class "${name}" already exists.` }

  const [graderHash, chairHash] = await Promise.all([
    bcrypt.hash(graderPin, 12),
    bcrypt.hash(chairPin, 12),
  ])

  if (makeActive === 'on') {
    await db.class.updateMany({ where: { isActive: true }, data: { isActive: false } })
  }

  // Create class + access in one transaction
  const newClass = await db.class.create({
    data: {
      name,
      isActive: makeActive === 'on',
      access: {
        create: [
          { role: 'GRADER',       passwordHash: graderHash },
          { role: 'PANEL_CHAIR',  passwordHash: chairHash  },
        ],
      },
    },
  })

  // Snapshot current criteria template into this class
  await snapshotCriteriaForClass(newClass.id)

  // Generate student number records
  await db.student.createMany({
    data: Array.from({ length: studentCount }, (_, i) => ({
      classId: newClass.id,
      number:  i + 1,
      track:   'PILOT' as const, // default — admin updates track per student
    })),
  })

  revalidatePath('/admin')
  revalidatePath('/admin/classes')

  return {
    success: true,
    classId:      newClass.id,
    className:    newClass.name,
    studentCount,
    graderPin,
    chairPin,
  }
}

// ── Generate student number CSV for download ──────────────────────────────────

export async function getStudentCsvAction(classId: string): Promise<string> {
  const session = await auth()
  if (!session) return ''

  const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
  if (!cls) return ''

  const students = await db.student.findMany({
    where: { classId },
    orderBy: { number: 'asc' },
    select: { number: true },
  })

  const header = 'Student Number,Class,Real Name (assign offline)\n'
  const rows = students.map((s) => `${cls.name}-${s.number},${cls.name},`).join('\n')
  return header + rows
}

// ── Update criteria weights from wizard ───────────────────────────────────────

export async function updateTemplateCriterionAction(
  id: string,
  weight: number,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }
  await db.criterion.update({ where: { id }, data: { weight } })
  return {}
}
