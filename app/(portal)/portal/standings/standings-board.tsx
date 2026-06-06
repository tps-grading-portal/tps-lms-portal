'use client'

import { useState } from 'react'
import type { StandingsResult } from '@/lib/standings'
import type { Track } from '@prisma/client'

const TRACK_LABELS: Record<Track, string> = {
  PILOT:    'Pilot',
  RPA:      'RPA',
  FTE:      'FTE',
  OPERATOR: 'STC',
  CSO_WSO:  'CSO/WSO',
  ABM:      'ABM',
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400'
  if (score >= 90) return 'text-green-700 font-semibold'
  if (score >= 80) return 'text-tps-navy'
  if (score >= 70) return 'text-amber-600 font-semibold'
  return 'text-red-600 font-bold'
}

export function StandingsBoard({ data }: { data: StandingsResult }) {
  const [view, setView] = useState<'all' | Track>('all')

  const tracks = Object.keys(data.byTrack) as Track[]
  const displayList =
    view === 'all'
      ? data.allStudents
      : (data.byTrack[view] ?? [])

  return (
    <div className="space-y-4">
      {/* View selector */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setView('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'all'
              ? 'bg-tps-navy text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
          }`}
        >
          All Students
        </button>
        {tracks.map(t => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === t
                ? 'bg-tps-navy text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-tps-orange hover:text-tps-orange'
            }`}
          >
            {TRACK_LABELS[t]} ({data.byTrack[t]?.length ?? 0})
          </button>
        ))}
      </div>

      {displayList.length === 0 ? (
        <div className="card text-center py-16 text-gray-400 text-sm">
          No student data available for this selection.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-center px-3 py-3 font-semibold text-gray-700 w-14">Rank</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Student</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-700 w-24">Track</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 w-32">Weighted Avg</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 w-32">Events Graded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayList.map((s, idx) => {
                const isTop3 = s.rank <= 3 && s.weightedAvg !== null
                return (
                  <tr
                    key={s.studentId}
                    className={`transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    } hover:bg-tps-orange/5`}
                  >
                    <td className="text-center px-3 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        s.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        s.rank === 2 ? 'bg-gray-300 text-gray-700' :
                        s.rank === 3 ? 'bg-amber-600/80 text-white' :
                        'text-gray-600'
                      }`}>
                        {s.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-tps-navy">
                      {s.displayName}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-tps-navy/10 text-tps-navy">
                        {TRACK_LABELS[s.track]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-sm ${scoreColor(s.weightedAvg)}`}>
                      {s.weightedAvg !== null ? `${s.weightedAvg.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {s.gradedEvents} / {s.totalEvents}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Last updated: {new Date(data.lastUpdated).toLocaleString()} ·
        Standings update in real time as grades are submitted.
      </p>
    </div>
  )
}
