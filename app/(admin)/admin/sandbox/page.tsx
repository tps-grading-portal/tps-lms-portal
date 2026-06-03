import { db } from '@/lib/db'
import Link from 'next/link'
import { SandboxAdminPanel } from './sandbox-admin-panel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'The Sandbox' }

export default async function SandboxPage() {
  const [invites, standaloneForms] = await Promise.all([
    db.sandboxCreatorInvite.findMany({
      orderBy: { sentAt: 'desc' },
      include: {
        form: {
          select: {
            id:          true,
            title:       true,
            submitSlug:  true,
            resultsSlug: true,
            isActive:    true,
            createdAt:   true,
            _count: { select: { submissions: true } },
          },
        },
      },
    }),
    // Forms created directly by admin (no invite)
    db.sandboxForm.findMany({
      where:   { inviteId: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { submissions: true } } },
    }),
  ])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">The Sandbox</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Build custom gradesheets, surveys, and evaluation forms — completely independent of Comp Oral.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/sandbox/invite" className="btn-secondary text-sm">
            Send Creator Invite
          </Link>
          <Link href="/admin/sandbox/new" className="btn-primary text-sm">
            Create Form (Admin)
          </Link>
        </div>
      </div>

      <SandboxAdminPanel invites={invites} standaloneForms={standaloneForms} />
    </div>
  )
}
