'use client'

import { useMemo, useState } from 'react'
import { deptSortIndex, deptLabel } from '@/lib/mcg-departments'
import type { ClassComparisonData, ClassCell } from '@/lib/class-comparison'

type Mode = 'overall' | 'phase' | 'event'

// ── Trend helpers ─────────────────────────────────────────────────────────────

/** Least-squares slope across class sequence (pts per class). */
function trendSlope(values: number[]): number | null {
  if (values.length < 2) return null
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  return den === 0 ? null : num / den
}

function TrendBadge({ values }: { values: number[] }) {
  const slope = trendSlope(values)
  if (slope === null) return null
  const rounded = Math.round(slope * 10) / 10
  const flat = Math.abs(rounded) < 0.5
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
      flat ? 'bg-gray-100 text-gray-500' : rounded > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {flat ? '→ steady' : rounded > 0 ? `↑ +${rounded}` : `↓ ${rounded}`}
      {!flat && <span className="font-normal opacity-70">pts/class</span>}
    </span>
  )
}

// ── Bar chart with trend line ─────────────────────────────────────────────────

function ComparisonChart({
  classes, cells,
}: {
  classes: ClassComparisonData['classes']
  cells:   Record<string, ClassCell>
}) {
  const present = classes.filter(c => cells[c.id])
  if (present.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No graded data for this selection yet.</p>
  }

  const W = Math.max(360, present.length * 90)
  const H = 220
  const PAD_L = 36, PAD_B = 40, PAD_T = 18
  const chartH = H - PAD_B - PAD_T
  const barW = Math.min(48, (W - PAD_L) / present.length - 24)

  const values = present.map(c => cells[c.id].avg)
  const min = Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10)
  const max = Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10)
  const y = (v: number) => PAD_T + chartH - ((v - min) / Math.max(1, max - min)) * chartH
  const x = (i: number) => PAD_L + (i + 0.5) * ((W - PAD_L) / present.length)

  // Grid lines every 10 pts
  const gridLines: number[] = []
  for (let v = min; v <= max; v += 10) gridLines.push(v)

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {gridLines.map(v => (
          <g key={v}>
            <line x1={PAD_L} y1={y(v)} x2={W} y2={y(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{v}</text>
          </g>
        ))}

        {/* Bars */}
        {present.map((c, i) => {
          const cell = cells[c.id]
          const barH = PAD_T + chartH - y(cell.avg)
          return (
            <g key={c.id}>
              <rect
                x={x(i) - barW / 2}
                y={y(cell.avg)}
                width={barW}
                height={Math.max(2, barH)}
                rx={4}
                fill={c.isActive ? '#1e2a44' : c.isArchived ? '#cbd5e1' : '#94a3b8'}
              />
              <text x={x(i)} y={y(cell.avg) - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1e2a44">
                {cell.avg.toFixed(1)}
              </text>
              <text x={x(i)} y={H - PAD_B + 16} textAnchor="middle" fontSize={11} fontWeight={700}
                fill={c.isActive ? '#1e2a44' : '#64748b'}>
                {c.name}
              </text>
              <text x={x(i)} y={H - PAD_B + 28} textAnchor="middle" fontSize={8} fill="#94a3b8">
                {c.isActive ? 'active' : c.isArchived ? 'archived' : 'past'} · n={cell.n}
              </text>
            </g>
          )
        })}

        {/* Trend line connecting class averages */}
        {present.length > 1 && (
          <polyline
            points={present.map((c, i) => `${x(i)},${y(cells[c.id].avg)}`).join(' ')}
            fill="none"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        )}
        {present.map((c, i) => (
          <circle key={c.id} cx={x(i)} cy={y(cells[c.id].avg)} r={3} fill="#f97316" />
        ))}
      </svg>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ClassComparison({ data }: { data: ClassComparisonData }) {
  const [mode,  setMode]  = useState<Mode>('overall')
  const [dept,  setDept]  = useState<string>('')
  const [event, setEvent] = useState<string>('')
  const [eventSearch, setEventSearch] = useState('')

  const depts = useMemo(
    () => Object.keys(data.byDept).sort((a, b) => deptSortIndex(a) - deptSortIndex(b)),
    [data.byDept],
  )
  const eventCodes = useMemo(
    () => Object.keys(data.byEvent).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [data.byEvent],
  )
  const filteredEvents = eventSearch
    ? eventCodes.filter(c => c.toLowerCase().includes(eventSearch.toLowerCase()))
    : eventCodes

  const activeDept  = dept  && data.byDept[dept]   ? dept  : depts[0] ?? ''
  const activeEvent = event && data.byEvent[event] ? event : ''

  const cells: Record<string, ClassCell> =
    mode === 'overall' ? data.overall :
    mode === 'phase'   ? (data.byDept[activeDept] ?? {}) :
    activeEvent        ? (data.byEvent[activeEvent] ?? {}) : {}

  const presentClasses = data.classes.filter(c => cells[c.id])
  const trendValues = presentClasses.map(c => cells[c.id].avg)

  if (data.classes.length === 0) {
    return (
      <div className="card text-center py-8 text-gray-400 text-sm">
        No classes with submitted grades yet — the comparison fills in as gradebooks are graded.
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {([['overall', 'Overall'], ['phase', 'By Phase'], ['event', 'By Event']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === m
                  ? 'bg-tps-navy text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {trendValues.length > 1 && <TrendBadge values={trendValues} />}
      </div>

      {/* Selectors */}
      {mode === 'phase' && (
        <div className="flex gap-1 flex-wrap">
          {depts.map(d => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-colors ${
                d === activeDept ? 'bg-tps-orange text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={deptLabel(d)}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {mode === 'event' && (
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="search"
            placeholder="Filter courses…"
            value={eventSearch}
            onChange={e => setEventSearch(e.target.value)}
            className="field-input text-sm w-44"
          />
          <select
            value={activeEvent}
            onChange={e => setEvent(e.target.value)}
            className="field-input text-sm flex-1 min-w-[200px]"
          >
            <option value="">— Pick a graded event to compare —</option>
            {filteredEvents.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
      )}

      {/* Chart */}
      {mode === 'event' && !activeEvent ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          Pick an event above to compare its scores across every class that has taken it.
        </p>
      ) : (
        <>
          {mode === 'phase' && activeDept && (
            <p className="text-xs text-gray-400">
              {activeDept} — {deptLabel(activeDept)} · average submitted score per class
            </p>
          )}
          <ComparisonChart classes={data.classes} cells={cells} />
        </>
      )}

      {/* Comparison table */}
      {presentClasses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-3 font-semibold text-gray-500 text-xs">Class</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-500 text-xs">Avg Score</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-500 text-xs">Graded Sheets</th>
                <th className="text-right py-2 pl-3 font-semibold text-gray-500 text-xs">Δ vs Previous</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {presentClasses.map((c, i) => {
                const cell = cells[c.id]
                const prev = i > 0 ? cells[presentClasses[i - 1].id] : null
                const delta = prev ? Math.round((cell.avg - prev.avg) * 10) / 10 : null
                return (
                  <tr key={c.id}>
                    <td className="py-2 pr-3">
                      <span className="font-bold text-tps-navy">{c.name}</span>
                      <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        c.isActive ? 'bg-green-100 text-green-700' : c.isArchived ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {c.isActive ? 'ACTIVE' : c.isArchived ? 'ARCHIVED' : 'PAST'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">{cell.avg.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right text-gray-500 tabular-nums">{cell.n}</td>
                    <td className={`py-2 pl-3 text-right font-mono font-semibold tabular-nums ${
                      delta === null ? 'text-gray-300' : delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
