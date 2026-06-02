'use server'

import { verifyPin, issuePinToken } from '@/lib/pin-auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export async function graderAuthAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const classId = formData.get('classId')?.toString()
  const pin = formData.get('pin')?.toString()

  if (!classId) return 'Please select a class.'
  if (!pin) return 'Please enter the PIN.'

  // Verify the class exists and is active
  const cls = await db.class.findUnique({ where: { id: classId } })
  if (!cls) return 'Class not found.'
  if (!cls.isActive) return 'This class is no longer active. Contact your administrator.'

  const valid = await verifyPin(classId, 'GRADER', pin)
  if (!valid) return 'Incorrect PIN. Check with your Panel Chair and try again.'

  await issuePinToken(classId, 'GRADER')
  redirect('/grade')
}
