'use client'

import { useState } from 'react'
import { archiveTemplateAction } from '../actions'
import { cn } from '@/lib/utils'

type Template = {
  id:         string
  courseCode: string
  title:      string
  type:       string
  tracks:     string[]
  isActive:   boolean
  archivedAt: Date | null
  _count:     { tasks: number; entries: number }
}

const TYPE_ICON: Record<string, string> = {
  FLIGHT: '✈', REPORT: '📄', ORAL: '🎤', SIM: '🖥', CONTROL_ROOM: '🎛',
}

const TRACK_SHORT: Record<string, string> = {
  PILOT: 'P', FTE: 'FTE', CSO_WSO: 'CSO', ABM: 'ABM', RPA: 'RPA', OPERATOR: 'OPS',
}

export function TemplateLibraryPanel({ templates }: { templates: Template[] }) {
  const [showArchived, setShowArchived] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = templates.filter((t) => {
    if (!showArchived && !t.isActive) return false
    if (search) {
      const q = search.toLowerCase()
      return t.courseCode.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
    }
    return true
  })

  const handleArchive = async (id: string, archive: boolean) => {
    setBusy(id)
    await archiveTemplateAction(id, archive)
    setBusy(null)
  }

  // Group by program prefix
  const grouped = filtered.reduce<Record<string, Template[]>>((acc, t) => {
    const prefix = t.courseCode.split(' ')[0]
    if (!acc[prefix]) acc[prefix] = []
    acc[prefix].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code or title…" className="field-input flex-1" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded" />
          Show archived
        </label>
      </div>

      {Object.entries(grouped).map(([prefix, items]) => (
        <div key={prefix} className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{prefix}</h2>
          <div className="space-y-1">
            {items.map((t) => (
              <div key={t.id} className={cn(
                'flex items-center gap-4 rounded-xl border px-4 py-3',
                !t.isActive ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'
              )}>
                <span className="text-lg flex-shrink-0">{TYPE_ICON[t.type] ?? '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-tps-navy">{t.courseCode}</p>
                  <p className="text-xs text-gray-500 truncate">{t.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex gap-1">
                    {t.tracks.map((tr) => (
                      <span key={tr} className="text-[10px] bg-tps-navy text-white px-1.5 py-0.5 rounded font-medium">
                        {TRACK_SHORT[tr] ?? tr}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{t._count.tasks} tasks</span>
                  {t._count.entries > 0 && (
                    <span className="text-xs text-gray-400">{t._count.entries} entries</span>
                  )}
                  <button
                    onClick={() => handleArchive(t.id, t.isActive)}
                    disabled={busy === t.id}
                    className="text-xs text-gray-400 hover:text-tps-orange ml-2"
                  >
                    {busy === t.id ? '…' : t.isActive ? 'Archive' : 'Restore'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No templates found.</p>
      )}
    </div>
  )
}
