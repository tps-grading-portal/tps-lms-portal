'use client'

import { useState, useTransition } from 'react'
import { advanceContentAction, archiveContentAction } from './actions'
import type { ContentStatus, UserRole } from '@prisma/client'

const STATUS_LABELS: Record<ContentStatus, string> = {
  SANDBOX:        'Draft',
  PENDING_CHAIR:  'Dept Review',
  PENDING_A9:     'A9 Review',
  PENDING_DEAN:   'Dean Review',
  VAULT:          'In Vault',
  ARCHIVED:       'Archived',
}
const STATUS_COLORS: Record<ContentStatus, string> = {
  SANDBOX:        'bg-gray-100   text-gray-600',
  PENDING_CHAIR:  'bg-amber-100  text-amber-700',
  PENDING_A9:     'bg-blue-100   text-blue-700',
  PENDING_DEAN:   'bg-purple-100 text-purple-700',
  VAULT:          'bg-green-100  text-green-700',
  ARCHIVED:       'bg-red-100    text-red-500',
}

// How many more class cohorts before this item expires
function expiryBadge(presentationCount: number) {
  const remaining = 3 - presentationCount
  if (remaining <= 0) return <span className="text-red-500 text-xs font-bold">EXPIRED</span>
  if (remaining === 1) return <span className="text-amber-500 text-xs font-semibold">1 class left</span>
  return <span className="text-gray-400 text-xs">{remaining} classes left</span>
}

type Props = {
  id:               string
  title:            string
  fileName:         string | null
  status:           ContentStatus
  presentationCount: number
  uploaderName:     string
  eventCode:        string | null
  uploadedAt:       Date
  role:             UserRole
}

export function VaultItemRow(props: Props) {
  const { id, title, fileName, status, presentationCount, uploaderName, eventCode, uploadedAt, role } = props
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const canAdvance =
    (role === 'SYSTEM_ADMIN' || role === 'A9_STANDARDS') ||
    (role === 'DEPT_CHAIR' && status === 'SANDBOX')

  const canArchive = role === 'SYSTEM_ADMIN' || role === 'A9_STANDARDS'

  function advance() {
    startTransition(async () => {
      const r = await advanceContentAction(id)
      setFeedback(r.ok ? null : (r.error ?? 'Error'))
    })
  }

  function archive() {
    if (!confirm('Archive this file? It will be moved offline. This cannot be undone via the portal.')) return
    startTransition(async () => {
      const r = await archiveContentAction(id)
      setFeedback(r.ok ? null : (r.error ?? 'Error'))
    })
  }

  if (status === 'ARCHIVED') return null

  return (
    <tr className="hover:bg-gray-50/50 transition-colors group">
      <td className="px-4 py-3">
        <p className="font-medium text-tps-navy text-sm">{title}</p>
        {fileName && <p className="text-xs text-gray-400 mt-0.5">{fileName}</p>}
      </td>
      <td className="px-3 py-3 text-xs text-gray-500">{eventCode ?? '—'}</td>
      <td className="px-3 py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </td>
      <td className="px-3 py-3">
        {status === 'VAULT' ? expiryBadge(presentationCount) : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="px-3 py-3 text-xs text-gray-500">{uploaderName}</td>
      <td className="px-3 py-3 text-xs text-gray-400">
        {new Date(uploadedAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {canAdvance && status !== 'VAULT' && (
            <button
              onClick={advance}
              disabled={pending}
              className="text-xs px-2 py-1 rounded bg-tps-navy text-white hover:bg-tps-navy/80 disabled:opacity-50"
            >
              {status === 'SANDBOX' ? 'Send for Review' :
               status === 'PENDING_CHAIR' ? 'Send to A9' : 'Approve to Vault'}
            </button>
          )}
          {canArchive && status === 'VAULT' && (
            <button
              onClick={archive}
              disabled={pending}
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
            >
              Archive
            </button>
          )}
        </div>
        {feedback && <p className="text-xs text-red-500 mt-1">{feedback}</p>}
      </td>
    </tr>
  )
}
