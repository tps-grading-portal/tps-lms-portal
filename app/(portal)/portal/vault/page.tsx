import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getVaultContents } from './actions'
import { VaultUploadForm } from './vault-upload-form'
import { VaultItemRow } from './vault-item-row'
import type { Metadata } from 'next'
import type { ContentStatus } from '@prisma/client'

export const metadata: Metadata = { title: 'Content Vault' }

const STATUS_TABS = [
  { label: 'All Active',     value: undefined as ContentStatus | undefined },
  { label: 'My Drafts',      value: 'SANDBOX'        as ContentStatus },
  { label: 'Dept Review',    value: 'PENDING_CHAIR'  as ContentStatus },
  { label: 'A9 Review',      value: 'PENDING_A9'     as ContentStatus },
  { label: 'In Vault',       value: 'VAULT'          as ContentStatus },
]

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { role } = session.user
  const canSubmit = can(role, 'submit:content')
  const canReview = can(role, 'review:content')
  const canManage = can(role, 'manage:content_vault')

  if (!canSubmit && !canReview && !canManage) return null

  const params = await searchParams
  const filterStatus = params.status as ContentStatus | undefined

  const [contents, events] = await Promise.all([
    getVaultContents(filterStatus ? { status: filterStatus } : undefined),
    canSubmit
      ? db.syllabusEvent.findMany({
          where:   { isActive: true },
          orderBy: { courseCode: 'asc' },
          select:  { id: true, courseCode: true, title: true },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Content Vault</h1>
          <p className="text-gray-500 text-sm mt-1">
            {canManage ? 'Approve, archive, and manage course content' :
             canReview  ? 'Review instructor submissions for your department' :
             'Submit course materials for review'}
          </p>
        </div>
        {canSubmit && <VaultUploadForm events={events} />}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
        {STATUS_TABS.map(tab => {
          const isActive = filterStatus === tab.value
          return (
            <a
              key={String(tab.value)}
              href={tab.value ? `/portal/vault?status=${tab.value}` : '/portal/vault'}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-tps-orange text-tps-orange'
                  : 'border-transparent text-gray-500 hover:text-tps-navy hover:border-gray-300'
              }`}
            >
              {tab.label}
            </a>
          )
        })}
      </div>

      {/* Content table */}
      {contents.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 text-sm">
          {filterStatus === 'PENDING_A9'    ? 'No content waiting for A9 review.' :
           filterStatus === 'PENDING_CHAIR' ? 'No content waiting for department review.' :
           filterStatus === 'VAULT'         ? 'No content in the active vault.' :
           filterStatus === 'SANDBOX'       ? 'No drafts yet. Submit your first file above.' :
           'No content found.'}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Title</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-28">Event</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-28">Status</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-36">Released To</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-28">Expiry</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-32">Submitted By</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-24">Date</th>
                <th className="w-36" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contents.map(c => (
                <VaultItemRow
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  fileName={c.fileName}
                  status={c.status}
                  presentationCount={c.presentationCount}
                  uploaderName={`${c.uploadedBy.lastName}, ${c.uploadedBy.firstName}`}
                  eventCode={c.syllabusEvent?.courseCode ?? null}
                  uploadedAt={c.createdAt}
                  releases={c.lessonFiles
                    .filter(lf => lf.lessonPage.class)
                    .map(lf => ({
                      className:  lf.lessonPage.class!.name,
                      approvedAt: lf.approvedForClassAt!.toISOString(),
                    }))
                    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))}
                  role={role}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* A9 lifecycle legend */}
      {(canReview || canManage) && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-700 text-sm">A9 Content Lifecycle</p>
          <p>Instructor submits → <strong>Draft</strong> → Dept Chair reviews → <strong>Dept Review</strong> → A9 approves → <strong>Vault</strong></p>
          <p>Vault items have a 3-class-cohort clock. After 3 uses, A9 must recertify or the item is archived.</p>
          <p>Items flagged &quot;Verified No Changes&quot; by A9 are eligible for auto-publish bypass on re-submission.</p>
        </div>
      )}
    </div>
  )
}
