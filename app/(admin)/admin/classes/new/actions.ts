'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { snapshotCriteriaForClass } from '@/lib/criteria-utils'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const TRACK_KEYS = ['PILOT', 'RPA', 'FTE', 'OPERATOR', 'CSO_WSO', 'ABM'] as const
type TrackKey = typeof TRACK_KEYS[number]

// ── Shuffle array in place (Fisher-Yates) ────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Create class with track-based, randomly-assigned student numbers ──────────

export type CreateClassWizardResult =
  | { success: true; classId: string; className: string; studentCount: number; graderPin: string; chairPin: string }
  | { success: false; error: string }

export async function createClassWizardAction(
  _prev: CreateClassWizardResult | null,
  formData: FormData,
): Promise<CreateClassWizardResult> {
  const session = await auth()
  if (!session) return { success: false, error: 'Unauthorized' }

  const name      = formData.get('name')?.toString().trim().toUpperCase()
  const graderPin = formData.get('graderPin')?.toString()
  const chairPin  = formData.get('chairPin')?.toString()
  const makeActive = formData.get('makeActive') === 'on'

  if (!name || name.length < 1 || name.length > 20) return { success: false, error: 'Class name is required.' }
  if (!graderPin || graderPin.length < 4)            return { success: false, error: 'Grader PIN must be at least 4 characters.' }
  if (!chairPin  || chairPin.length  < 4)            return { success: false, error: 'Chair PIN must be at least 4 characters.' }

  // Parse track counts
  const trackCounts: Record<TrackKey, number> = {
    PILOT:    parseInt(formData.get('track_PILOT')?.toString()    ?? '0', 10) || 0,
    RPA:      parseInt(formData.get('track_RPA')?.toString()      ?? '0', 10) || 0,
    FTE:      parseInt(formData.get('track_FTE')?.toString()      ?? '0', 10) || 0,
    OPERATOR: parseInt(formData.get('track_OPERATOR')?.toString() ?? '0', 10) || 0,
    CSO_WSO:  parseInt(formData.get('track_CSO_WSO')?.toString()  ?? '0', 10) || 0,
    ABM:      parseInt(formData.get('track_ABM')?.toString()      ?? '0', 10) || 0,
  }

  const studentCount = Object.values(trackCounts).reduce((a, b) => a + b, 0)
  if (studentCount < 1) return { success: false, error: 'At least one student is required.' }
  if (studentCount > 500) return { success: false, error: 'Maximum 500 students per class.' }

  const existing = await db.class.findUnique({ where: { name } })
  if (existing) return { success: false, error: `Class "${name}" already exists.` }

  const [graderHash, chairHash] = await Promise.all([
    bcrypt.hash(graderPin, 12),
    bcrypt.hash(chairPin, 12),
  ])

  if (makeActive) {
    await db.class.updateMany({ where: { isActive: true }, data: { isActive: false } })
  }

  const newClass = await db.class.create({
    data: {
      name,
      isActive: makeActive,
      access: {
        create: [
          { role: 'GRADER',      passwordHash: graderHash },
          { role: 'PANEL_CHAIR', passwordHash: chairHash  },
        ],
      },
    },
  })

  await snapshotCriteriaForClass(newClass.id)

  // Build a randomly shuffled list of tracks, then assign sequential numbers
  const trackList: TrackKey[] = []
  for (const track of TRACK_KEYS) {
    for (let i = 0; i < trackCounts[track]; i++) trackList.push(track)
  }
  shuffle(trackList)

  await db.student.createMany({
    data: trackList.map((track, i) => ({
      classId: newClass.id,
      number:  i + 1,
      track,
    })),
  })

  revalidatePath('/admin')
  revalidatePath('/admin/classes')

  return { success: true, classId: newClass.id, className: newClass.name, studentCount, graderPin, chairPin }
}

// ── Generate student CSV (now includes Track column) ─────────────────────────

const TRACK_DISPLAY: Record<string, string> = {
  PILOT:    'Pilot',
  RPA:      'RPA',
  FTE:      'FTE',
  OPERATOR: 'Operator (STC)',
  CSO_WSO:  'CSO/WSO',
  ABM:      'ABM',
}

export async function getStudentCsvAction(classId: string): Promise<string> {
  const session = await auth()
  if (!session) return ''

  const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
  if (!cls) return ''

  const students = await db.student.findMany({
    where:   { classId },
    orderBy: { number: 'asc' },
    select:  { number: true, track: true },
  })

  const header = 'Student Number,Class,Track,Real Name (assign offline)\n'
  const rows   = students
    .map((s) => `${cls.name}-${s.number},${cls.name},${TRACK_DISPLAY[s.track] ?? s.track},`)
    .join('\n')

  return header + rows
}

export async function updateTemplateCriterionAction(
  id: string,
  weight: number,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }
  await db.criterion.update({ where: { id }, data: { weight } })
  return {}
}
