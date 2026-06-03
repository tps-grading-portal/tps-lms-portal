'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type RosterResult = { error?: string; success?: boolean }

// ── Add Student (manual, by number) ──────────────────────────────────────────

export async function addStudentAction(
  _prev: RosterResult | null,
  formData: FormData,
): Promise<RosterResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const classId  = formData.get('classId')?.toString()
  const numberStr = formData.get('number')?.toString()
  const track    = formData.get('track')?.toString()

  if (!classId || !numberStr || !track) return { error: 'All fields required.' }

  const number = parseInt(numberStr, 10)
  if (isNaN(number) || number < 1) return { error: 'Student number must be a positive integer.' }

  const valid = z.enum(['PILOT','RPA','FTE','OPERATOR','CSO_WSO','ABM']).safeParse(track)
  if (!valid.success) return { error: 'Invalid track.' }

  try {
    await db.student.create({ data: { classId, number, track: valid.data } })
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Student number already exists in this class.' }
  }
}

export async function removeStudentAction(studentId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  await db.student.delete({ where: { id: studentId } })
  revalidatePath('/admin')
}

// ── Student track update ──────────────────────────────────────────────────────

export async function updateStudentTrackAction(
  studentId: string,
  track: string,
): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  const valid = z.enum(['PILOT','RPA','FTE','OPERATOR','CSO_WSO','ABM']).parse(track)
  await db.student.update({ where: { id: studentId }, data: { track: valid } })
  revalidatePath('/admin')
}

// ── Scenarios are now global — managed in /admin/settings ────────────────────

export async function addScenarioAction(
  _prev: RosterResult | null,
  formData: FormData,
): Promise<RosterResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const numberStr = formData.get('number')?.toString()
  const label     = formData.get('label')?.toString()?.trim()

  if (!numberStr || !label) return { error: 'All fields required.' }

  const number = parseInt(numberStr, 10)
  if (isNaN(number) || number < 1) return { error: 'Scenario number must be a positive integer.' }

  try {
    await db.scenario.create({ data: { number, label } })
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'Scenario number already exists globally.' }
  }
}

export async function removeScenarioAction(scenarioId: string): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  await db.scenario.update({ where: { id: scenarioId }, data: { isActive: false } })
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
