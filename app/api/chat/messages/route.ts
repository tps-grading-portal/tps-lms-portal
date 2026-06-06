import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const channelId = req.nextUrl.searchParams.get('channelId')
  const since     = req.nextUrl.searchParams.get('since') // ISO timestamp

  if (!channelId) {
    return NextResponse.json({ error: 'Missing channelId' }, { status: 400 })
  }

  // Verify channel exists and is not archived
  const channel = await db.chatChannel.findUnique({
    where:  { id: channelId },
    select: { id: true, isArchived: true },
  })
  if (!channel || channel.isArchived) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  const sinceDate = since ? new Date(since) : undefined

  const messages = await db.chatMessage.findMany({
    where: {
      channelId,
      isDeleted: false,
      ...(sinceDate ? { sentAt: { gt: sinceDate } } : {}),
    },
    orderBy: { sentAt: 'asc' },
    take: 100,
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  })

  return NextResponse.json({ messages })
}
