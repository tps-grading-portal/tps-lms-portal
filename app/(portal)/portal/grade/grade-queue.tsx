'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GradeQueueEntry } from './actions'
import type { Track } from '@prisma/client'

const TRACK_LABELS: Record<Track, string> = {
  PILOT:    'Pilot',
  RPA:      'RPA',
  FTE:      'FTE',
  OPERATOR: 'STC',
  CSO_WSO:  'CSO/WSO',
  ABM:      'ABM',
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  NOT_STARTED: { label: 'Not Started', color: 'bg-gray-100 text-gray-500' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  SUBMITTED:   { label: 'Submitted',   color: 'bg-green-100 text-green-700' },
}

function QrModal({ entryId, label, onClose }: { entryId: string; label: string; onClose: () => void }) {
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/grade/${entryId}`
    : `/portal/grade/${entryId}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy text-sm">QR Code — {label}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* QR code rendered server-side via img tag pointing to API route */}
        <div className="flex justify-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr?url=${encodeURIComponent(url)}`}
            alt="QR code for grading entry"
            className="w-48 h-48 rounded-lg border border-gray-100"
          />
        </div>

        <p className="text-xs text-gray-500 text-center break-all">{url}</p>

        <button
          onClick={() => navigator.clipboard?.writeText(url)}
          className="w-full mt-3 btn-secondary text-xs py-2"
        >
          Copy Link
        </button>
      </div>
    </div>
  )
}

type Filter = 'all' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED'

export function GradeQueue({ entries }: { entries: GradeQueueEntry[]; className: string }) {
  const [filter,     setFilter]     = useState<Filter>('all')
  const [qrEntryId,  setQrEntryId]  = useState<string | null>(null)
  const [search,     setSearch]     = useState('')

  const filtered = entries.filter(e => {
    if (filter !== 'all' && e.status !== filter) return false
    if (search && !e.studentName.toLowerCase().includes(search.toLowerCase()) &&
        !e.courseCode.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const qrEntry = qrEntryId ? entries.find(e => e.entryId === qrEntryId) : null

  const counts = {
    NOT_STARTED: entries.filter(e => e.status === 'NOT_STARTED').length,
    IN_PROGRESS: entries.filter(e => e.status === 'IN_PROGRESS').length,
    SUBMITTED:   entries.filter(e => e.status === 'SUBMITTED').length,
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-gray-400">{counts.NOT_STARTED}</p>
          <p className="text-xs text-gray-400">Not Started</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-amber-600">{counts.IN_PROGRESS}</p>
          <p className="text-xs text-gray-400">In Progress</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-green-600">{counts.SUBMITTED}</p>
          <p className="text-xs text-gray-400">Submitted</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search student or course…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="field-input flex-1"
        />
        <div className="flex gap-1 flex-wrap">
          {(['all', 'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-tps-navy text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
              }`}
            >
              {f === 'all' ? `All (${entries.length})` : `${STATUS_META[f].label} (${counts[f]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Entry table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">No entries match your filters.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const meta = STATUS_META[entry.status] ?? STATUS_META.NOT_STARTED
            return (
              <div key={entry.entryId} className="card flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded font-mono">
                      {entry.courseCode}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{TRACK_LABELS[entry.track]}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{entry.studentName}</p>
                  <p className="text-xs text-gray-400 truncate">{entry.templateTitle}</p>
                  {entry.overallScore !== null && (
                    <p className="text-xs font-semibold mt-0.5 text-tps-navy">
                      Score: {entry.overallScore.toFixed(1)}%
                      {entry.overallPass !== null && (
                        <span className={entry.overallPass ? ' text-green-600' : ' text-red-600'}>
                          {' '}({entry.overallPass ? 'Pass' : 'Fail'})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <Link
                    href={`/portal/grade/${entry.entryId}`}
                    className="btn-primary text-xs px-3 py-2 text-center"
                  >
                    {entry.status === 'NOT_STARTED' ? 'Grade' : 'Edit'}
                  </Link>
                  <button
                    onClick={() => setQrEntryId(entry.entryId)}
                    className="btn-secondary text-xs px-3 py-2"
                    title="Show QR code"
                  >
                    QR
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* QR modal */}
      {qrEntry && (
        <QrModal
          entryId={qrEntry.entryId}
          label={`${qrEntry.courseCode} — ${qrEntry.studentName}`}
          onClose={() => setQrEntryId(null)}
        />
      )}
    </div>
  )
}
