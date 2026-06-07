import { requireAuth } from '@/lib/server-auth'
import { getActiveClassAction, getChannelsAction, provisionChannelsAction } from './actions'
import { ChatShell } from './chat-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Digital Squadron' }

export default async function ChatPage() {
  const user = await requireAuth()

  const activeClass = await getActiveClassAction()
  if (!activeClass) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-bold text-tps-navy mb-1">Digital Squadron</h1>
        <p className="text-gray-500 text-sm mb-6">
          Native messaging — auto-provisioned channels by track and class
        </p>
        <div className="card text-center py-16 text-gray-400">
          No active class found. Ask a System Admin to activate a class to enable chat.
        </div>
      </div>
    )
  }

  // Auto-provision channels for this class (idempotent)
  await provisionChannelsAction(activeClass.id)

  const channels = await getChannelsAction(activeClass.id)

  return (
    // Fixed to the window: the page itself never scrolls — only the message
    // history inside the shell does, and the text bar stays pinned at the
    // bottom. Height = viewport − top nav (3.5rem) − main padding.
    <div className="w-full h-[calc(100vh-5.5rem)] md:h-[calc(100vh-6.5rem)] flex flex-col overflow-hidden">
      <div className="flex items-baseline gap-3 mb-3 shrink-0">
        <h1 className="text-xl font-bold text-tps-navy">Digital Squadron</h1>
        <p className="text-gray-500 text-xs">
          {channels.length} channel{channels.length !== 1 ? 's' : ''} · Class {activeClass.name}
        </p>
      </div>

      <ChatShell
        channels={channels}
        currentUserId={user.id}
        className={activeClass.name}
        classId={activeClass.id}
      />
    </div>
  )
}
