'use client'

import { useState, useTransition } from 'react'
import { updateStudentTrackAction } from '@/app/(admin)/admin/roster-actions'
import { TRACK_LABELS } from '@/lib/utils'

const TRACKS = Object.keys(TRACK_LABELS) as (keyof typeof TRACK_LABELS)[]

interface Props {
  studentId: string
  number:    number
  className: string
  track:     string
}

export function StudentTrackEditor({ studentId, number, className, track }: Props) {
  const [currentTrack, setCurrentTrack] = useState(track)
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [,             startT]          = useTransition()

  const save = async (newTrack: string) => {
    setSaving(true)
    await updateStudentTrackAction(studentId, newTrack)
    startT(() => {
      setCurrentTrack(newTrack)
      setEditing(false)
    })
    setSaving(false)
  }

  return (
    <div
      className="card border border-gray-200 py-2 px-3 text-sm cursor-pointer hover:border-tps-orange hover:bg-orange-50 transition-colors relative"
      onClick={() => !editing && setEditing(true)}
      title="Click to edit track"
    >
      <p className="font-medium font-mono">{className}-{number}</p>

      {editing ? (
        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
          <select
            autoFocus
            defaultValue={currentTrack}
            disabled={saving}
            onChange={(e) => save(e.target.value)}
            onBlur={() => setEditing(false)}
            className="text-xs border border-tps-orange rounded px-1 py-0.5 w-full bg-white focus:outline-none"
          >
            {TRACKS.map((t) => (
              <option key={t} value={t}>{TRACK_LABELS[t]}</option>
            ))}
          </select>
          {saving && <p className="text-[10px] text-gray-400 mt-0.5">Saving…</p>}
        </div>
      ) : (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          {TRACK_LABELS[currentTrack] ?? currentTrack}
          <span className="text-tps-orange opacity-0 group-hover:opacity-100">✎</span>
        </p>
      )}
    </div>
  )
}
