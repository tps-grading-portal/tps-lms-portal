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
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Digital Squadron</h1>
          <p className="text-gray-500 text-sm">
            {channels.length} channel{channels.length !== 1 ? 's' : ''} · Class {activeClass.name}
          </p>
        </div>
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
