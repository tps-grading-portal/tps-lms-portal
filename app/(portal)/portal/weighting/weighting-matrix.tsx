'use client'

import { useState, useTransition, useMemo } from 'react'
import { saveTrackWeightsAction } from './actions'
import type { Track } from '@prisma/client'

const TRACKS: Track[] = ['PILOT', 'RPA', 'FTE', 'OPERATOR', 'CSO_WSO', 'ABM']
const TRACK_LABELS: Record<Track, string> = {
  PILOT:    'Pilot',
  RPA:      'RPA',
  FTE:      'FTE',
  OPERATOR: 'STC/Operator',
  CSO_WSO:  'CSO/WSO',
  ABM:      'ABM',
}

type EventRow = {
  id:        string
  courseCode: string
  title:     string
  deptCode:  string
  phase:     number
  tracks:    string[]
}

type Props = {
  events:    EventRow[]
  weightMap: Record<string, number>
}

export function WeightingMatrix({ events, weightMap }: Props) {
  const [activeTrack, setActiveTrack] = useState<Track>('PILOT')
  const [pending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Local weight state: `${track}:${eventId}` → string (user is typing)
  const [localWeights, setLocalWeights] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const [k, v] of Object.entries(weightMap)) {
      init[k] = v.toFixed(2)
    }
    return init
  })

  const trackEvents = useMemo(
    () => events.filter(e => e.tracks.includes(activeTrack)),
    [events, activeTrack],
  )

  function getWeight(eventId: string): string {
    return localWeights[`${activeTrack}:${eventId}`] ?? '0.00'
  }

  function setWeight(eventId: string, val: string) {
    setLocalWeights(prev => ({ ...prev, [`${activeTrack}:${eventId}`]: val }))
    setSuccess(false)
  }

  function currentSum(): number {
    return trackEvents.reduce((s, e) => {
      const v = parseFloat(localWeights[`${activeTrack}:${e.id}`] ?? '0')
      return s + (isNaN(v) ? 0 : v)
    }, 0)
  }

  const sum     = currentSum()
  const sumDiff = Math.abs(sum - 100)
  const sumOk   = sumDiff < 0.01

  function handleSave() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const weights = trackEvents.map(e => ({
        syllabusEventId: e.id,
        courseCode:      e.courseCode,
        weightPct:       parseFloat(localWeights[`${activeTrack}:${e.id}`] ?? '0') || 0,
      }))
      const result = await saveTrackWeightsAction(activeTrack, weights)
      if (result.ok) {
        setSuccess(true)
      } else {
        setError(result.error ?? 'Unknown error')
      }
    })
  }

  function distributeEvenly() {
    if (trackEvents.length === 0) return
    const each = (100 / trackEvents.length).toFixed(2)
    const updates: Record<string, string> = { ...localWeights }
    for (const e of trackEvents) {
      updates[`${activeTrack}:${e.id}`] = each
    }
    setLocalWeights(updates)
    setSuccess(false)
  }

  // Group events by department
  const grouped = useMemo(() => {
    const map = new Map<string, EventRow[]>()
    for (const e of trackEvents) {
      if (!map.has(e.deptCode)) map.set(e.deptCode, [])
      map.get(e.deptCode)!.push(e)
    }
    return map
  }, [trackEvents])

  return (
    <div className="space-y-4">
      {/* Track tabs */}
      <div className="flex gap-1 flex-wrap">
        {TRACKS.map(t => (
          <button
            key={t}
            onClick={() => { setActiveTrack(t); setError(null); setSuccess(false) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTrack === t
                ? 'bg-tps-navy text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
            }`}
          >
            {TRACK_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Sum indicator */}
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
        sumOk
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-amber-50 border border-amber-300 text-amber-800'
      }`}>
        <span>
          {TRACK_LABELS[activeTrack]} total: <strong>{sum.toFixed(2)}%</strong>
          {sumOk ? ' ✓' : ` — ${sumDiff.toFixed(2)}% ${sum < 100 ? 'short' : 'over'}`}
        </span>
        <button
          type="button"
          onClick={distributeEvenly}
          className="ml-auto text-xs underline hover:no-underline"
        >
          Distribute evenly
        </button>
      </div>

      {/* Weight table */}
      {trackEvents.length === 0 ? (
        <div className="card text-center py-10 text-gray-400 text-sm">
          No graded events assigned to the {TRACK_LABELS[activeTrack]} track.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-32">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Event Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-20">Phase</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 w-28">Weight %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...grouped.entries()].map(([dept, evts]) => (
                <>
                  <tr key={`dept-${dept}`} className="bg-gray-50/80">
                    <td colSpan={4} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {dept}
                    </td>
                  </tr>
                  {evts.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">{e.courseCode}</td>
                      <td className="px-4 py-2 text-gray-800">{e.title}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{e.phase}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={getWeight(e.id)}
                            onChange={ev => setWeight(e.id, ev.target.value)}
                            className="w-20 text-right rounded border border-gray-300 px-2 py-1 text-sm
                                       focus:border-tps-orange focus:ring-1 focus:ring-tps-orange"
                          />
                          <span className="text-gray-400 text-xs">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending || !sumOk || trackEvents.length === 0}
          className="btn-primary"
        >
          {pending ? 'Saving…' : `Save ${TRACK_LABELS[activeTrack]} Weights`}
        </button>

        {error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
        {success && (
          <span className="text-sm text-green-600">Saved successfully.</span>
        )}
      </div>
    </div>
  )
}
