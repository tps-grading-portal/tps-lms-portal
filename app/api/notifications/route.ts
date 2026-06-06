import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
    }),
    db.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ])

  return NextResponse.json({ notifications, unread })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  if (body.action === 'mark-all-read') {
    await db.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data:  { readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'mark-read' && typeof body.id === 'string') {
    await db.notification.updateMany({
      where: { id: body.id, userId: session.user.id },
      data:  { readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
