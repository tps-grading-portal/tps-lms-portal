'use server'

import { verifyPin, issuePinToken } from '@/lib/pin-auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export async function chairAuthAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const classId = formData.get('classId')?.toString()
  const pin = formData.get('pin')?.toString()

  if (!classId) return 'Please select a class.'
  if (!pin) return 'Please enter the PIN.'

  const cls = await db.class.findUnique({ where: { id: classId } })
  if (!cls) return 'Class not found.'
  if (!cls.isActive) return 'This class is no longer active. Contact your administrator.'

  const valid = await verifyPin(classId, 'PANEL_CHAIR', pin)
  if (!valid) return 'Incorrect PIN. Try again.'

  await issuePinToken(classId, 'PANEL_CHAIR')
  redirect('/chair')
}
