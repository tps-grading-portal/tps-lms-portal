import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPin, setStudentSession } from '@/lib/gradebook-auth'

export async function POST(req: Request) {
  const { token, pin } = await req.json() as { token: string; pin: string }

  const student = await db.student.findUnique({ where: { viewToken: token } })
  if (!student || !student.viewPinHash) {
    return NextResponse.json({ error: 'No PIN set — contact your instructor.' }, { status: 400 })
  }

  const ok = await verifyPin(pin, student.viewPinHash)
  if (!ok) return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 })

  await setStudentSession(student.id, token)
  return NextResponse.json({ ok: true })
}
