import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPin, hashPin, setStudentSession } from '@/lib/gradebook-auth'

export async function POST(req: Request) {
  const { token, pin, tempPin } = await req.json() as { token: string; pin: string; tempPin?: string }

  const student = await db.student.findUnique({ where: { viewToken: token } })
  if (!student) return NextResponse.json({ error: 'Invalid link.' }, { status: 400 })

  if (student.isTempPin && student.viewPinHash) {
    if (!tempPin) return NextResponse.json({ error: 'Temporary PIN required.' }, { status: 400 })
    const ok = await verifyPin(tempPin, student.viewPinHash)
    if (!ok) return NextResponse.json({ error: 'Incorrect temporary PIN.' }, { status: 401 })
  }

  if (pin.length < 4) return NextResponse.json({ error: 'PIN must be at least 4 characters.' }, { status: 400 })

  const newHash = await hashPin(pin)
  await db.student.update({
    where: { id: student.id },
    data:  { viewPinHash: newHash, isTempPin: false },
  })

  await setStudentSession(student.id, token)
  return NextResponse.json({ ok: true })
}
