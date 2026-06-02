'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ── Add Student ───────────────────────────────────────────────────────────────

export type RosterResult = { error?: string; success?: boolean }

export async function addStudentAction(
  _prev: RosterResult | null,
  formData: FormData,
): Promise<RosterResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const classId = formData.get('classId')?.toString()
  const name    = formData.get('name')?.toString()?.trim()
  const track   = formData.get('track')?.toString()

  if (!classId || !name || !track) return { error: 'All fields required.' }

  const valid = z.enum(['PILOT','RPA','FTE','OPERATOR','CSO_WSO','ABM']).safeParse(track)
  if (!valid.success) return { error: 'Invalid track.' }

  try {
    await db.student.create({ data: { classId, name, track: valid.data } })
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Student already exists in this class.' }
  }
}

export async function removeStudentAction(studentId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  await db.student.delete({ where: { id: studentId } })
  revalidatePath('/admin')
}

// ── Add Scenario ──────────────────────────────────────────────────────────────

export async function addScenarioAction(
  _prev: RosterResult | null,
  formData: FormData,
): Promise<RosterResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const classId     = formData.get('classId')?.toString()
  const numberStr   = formData.get('number')?.toString()
  const label       = formData.get('label')?.toString()?.trim()

  if (!classId || !numberStr || !label) return { error: 'All fields required.' }

  const number = parseInt(numberStr, 10)
  if (isNaN(number) || number < 1) return { error: 'Scenario number must be a positive integer.' }

  try {
    await db.scenario.create({ data: { classId, number, label } })
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Scenario number already exists for this class.' }
  }
}

export async function removeScenarioAction(scenarioId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  await db.scenario.delete({ where: { id: scenarioId } })
  revalidatePath('/admin')
}

// ── Staff Members ─────────────────────────────────────────────────────────────

export async function addStaffMemberAction(
  _prev: RosterResult | null,
  formData: FormData,
): Promise<RosterResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const name = formData.get('name')?.toString()?.trim()
  if (!name) return { error: 'Name required.' }

  try {
    await db.staffMember.create({ data: { name } })
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Staff member already exists.' }
  }
}

export async function toggleStaffMemberAction(
  staffId: string,
  isActive: boolean,
): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  await db.staffMember.update({ where: { id: staffId }, data: { isActive } })
  revalidatePath('/admin')
}
