import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Unread chat messages, total + per channel.
 *
 * Counts ONLY the channels the chat page actually shows (the active class's
 * channels + school-wide channels, minus private channels the user isn't in)
 * — otherwise the badge counts messages the user can never see/read and it
 * never clears.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const isAdmin = session.user.role === 'SYSTEM_ADMIN'

  // Same class resolution as the chat page (getActiveClassAction)
  const activeClass = await db.class.findFirst({
    where:   { isActive: true },
    select:  { id: true },
    orderBy: { createdAt: 'desc' },
  })

  const channels = await db.chatChannel.findMany({
    where: {
      isArchived: false,
      OR: [{ classId: activeClass?.id ?? '__none__' }, { classId: null }],
    },
    select: {
      id: true,
      isPrivate: true,
      members: { where: { userId }, select: { userId: true, lastReadAt: true } },
    },
  })

  const visible = channels.filter(ch => !ch.isPrivate || isAdmin || ch.members.length > 0)

  // Channels never opened count only recent traffic (last 7 days) so old
  // history doesn't inflate the badge forever.
  const recentCutoff = new Date(Date.now() - 7 * 86400_000)

  const byChannel: Record<string, number> = {}
  let unread = 0
  for (const ch of visible) {
    const lastReadAt = ch.members[0]?.lastReadAt ?? null
    const count = await db.chatMessage.count({
      where: {
        channelId: ch.id,
        isDeleted: false,
        authorId:  { not: userId },
        sentAt:    { gt: lastReadAt ?? recentCutoff },
      },
    })
    byChannel[ch.id] = count
    unread += count
  }

  return NextResponse.json({ unread, byChannel })
}
