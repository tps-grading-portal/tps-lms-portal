import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Total unread chat messages across channels visible to the user. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const isAdmin = session.user.role === 'SYSTEM_ADMIN'

  const channels = await db.chatChannel.findMany({
    where: { isArchived: false },
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

  let unread = 0
  for (const ch of visible) {
    const lastReadAt = ch.members[0]?.lastReadAt ?? null
    unread += await db.chatMessage.count({
      where: {
        channelId: ch.id,
        isDeleted: false,
        authorId:  { not: userId },
        sentAt:    { gt: lastReadAt ?? recentCutoff },
      },
    })
  }

  return NextResponse.json({ unread })
}
