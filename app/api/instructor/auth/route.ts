import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPin, setInstructorSession } from '@/lib/gradebook-auth'

export async function POST(req: Request) {
  const { name, pin } = await req.json() as { name: string; pin: string }

  const instructor = await db.gradebookInstructor.findUnique({ where: { name } })
  if (!instructor || !instructor.isActive) {
    return NextResponse.json({ error: 'Instructor not found or inactive.' }, { status: 401 })
  }

  const ok = await verifyPin(pin, instructor.pinHash)
  if (!ok) return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 })

  await setInstructorSession(instructor.id, instructor.name)
  return NextResponse.json({ ok: true })
}
