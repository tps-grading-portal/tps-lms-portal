'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { moveScheduledEventAction, type ScheduleConflict, type WeekRow, type ScheduledEventRow } from './actions'

// Grid geometry — 0700 to 1800 in 30-minute rows
const DAY_START_MIN = 7 * 60
const DAY_END_MIN   = 18 * 60
const SLOT_MIN      = 30
const SLOT_PX       = 26
const ROWS          = (DAY_END_MIN - DAY_START_MIN) / SLOT_MIN

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** ISO date (YYYY-MM-DD) for day index 0-4 of a week starting at startDate */
function dayISO(weekStartISO: string, dayIdx: number): string {
  const d = new Date(`${weekStartISO.slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dayIdx)
  return d.toISOString().slice(0, 10)
}

const DEPT_BLOCK_COLORS: Record<string, string> = {
  AN: 'bg-gray-200 border-gray-400 text-gray-800',
  CF: 'bg-cyan-100 border-cyan-400 text-cyan-900',
  SO: 'bg-purple-100 border-purple-400 text-purple-900',
  AS: 'bg-indigo-100 border-indigo-400 text-indigo-900',
  PF: 'bg-blue-100 border-blue-400 text-blue-900',
  FQ: 'bg-sky-100 border-sky-400 text-sky-900',
  SY: 'bg-emerald-100 border-emerald-400 text-emerald-900',
  TF: 'bg-amber-100 border-amber-400 text-amber-900',
  TL: 'bg-rose-100 border-rose-400 text-rose-900',
}

type DragState =
  | { kind: 'move';   scheduleId: string; durationMin: number; dayIdx: number; startMin: number }
  | { kind: 'resize'; scheduleId: string; dayIdx: number; startMin: number; durationMin: number }

type ConflictPrompt = {
  conflicts:   ScheduleConflict[]
  retry:       () => void
}

export function WeekCalendar({
  week, canEdit, onSlotClick, onEventClick,
}: {
  week:         WeekRow
  canEdit:      boolean
  onSlotClick:  (dateISO: string, time: string) => void
  onEventClick: (e: ScheduledEventRow) => void
}) {
  const router = useRouter()
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag,     setDrag]     = useState<DragState | null>(null)
  const [conflict, setConflict] = useState<ConflictPrompt | null>(null)
  const [saving,   setSaving]   = useState(false)

  // Events that have a concrete date+time within this week
  const placed = week.events.filter(e => e.scheduledDate && e.scheduledTime)

  const eventsForDay = (dayIdx: number) => {
    const iso = dayISO(week.startDate, dayIdx)
    return placed.filter(e => e.scheduledDate!.slice(0, 10) === iso)
  }

  // ── Pointer math ─────────────────────────────────────────────────────────────

  const posFromPointer = useCallback((clientX: number, clientY: number) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const colW = rect.width / 5
    const dayIdx = Math.max(0, Math.min(4, Math.floor(x / colW)))
    const slot   = Math.max(0, Math.min(ROWS - 1, Math.floor(y / SLOT_PX)))
    return { dayIdx, startMin: DAY_START_MIN + slot * SLOT_MIN }
  }, [])

  async function commitMove(scheduleId: string, dayIdx: number, startMin: number, durationMin: number, override = false) {
    setSaving(true)
    const payload = {
      scheduledDate:   dayISO(week.startDate, dayIdx),
      scheduledTime:   toHHMM(startMin),
      durationMinutes: durationMin,
      override,
    }
    const result = await moveScheduledEventAction(scheduleId, payload)
    setSaving(false)
    if ('conflicts' in result && result.conflicts) {
      setConflict({
        conflicts: result.conflicts,
        retry: () => { setConflict(null); commitMove(scheduleId, dayIdx, startMin, durationMin, true) },
      })
      return
    }
    router.refresh()
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return
    const pos = posFromPointer(e.clientX, e.clientY)
    if (!pos) return
    if (drag.kind === 'move') {
      setDrag({ ...drag, dayIdx: pos.dayIdx, startMin: pos.startMin })
    } else {
      // Resize: duration from block start to pointer, min one slot
      const newDur = Math.max(SLOT_MIN, pos.startMin + SLOT_MIN - drag.startMin)
      setDrag({ ...drag, durationMin: newDur })
    }
  }

  function handlePointerUp() {
    if (!drag) return
    const d = drag
    setDrag(null)
    commitMove(d.scheduleId, d.dayIdx, d.startMin, d.durationMin)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const timeLabels = []
  for (let m = DAY_START_MIN; m < DAY_END_MIN; m += 60) {
    timeLabels.push(toHHMM(m))
  }

  return (
    <div className="card p-0 overflow-x-auto select-none">
      <div className="min-w-[640px]">
        {/* Day headers */}
        <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}>
          <div />
          {DAY_LABELS.map((label, i) => {
            const iso = dayISO(week.startDate, i)
            return (
              <div key={label} className="px-2 py-2 text-center border-l border-gray-100">
                <p className="text-xs font-bold text-tps-navy">{label}</p>
                <p className="text-[10px] text-gray-400">
                  {new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>

        {/* Body: time gutter + grid */}
        <div className="grid" style={{ gridTemplateColumns: '56px repeat(5, 1fr)' }}>
          {/* Time gutter */}
          <div className="relative" style={{ height: ROWS * SLOT_PX }}>
            {timeLabels.map((t, i) => (
              <span
                key={t}
                className="absolute right-2 text-[10px] text-gray-400 -translate-y-1/2"
                style={{ top: i * 2 * SLOT_PX }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* 5-day grid */}
          <div
            ref={gridRef}
            className="relative col-span-5 grid grid-cols-5"
            style={{ height: ROWS * SLOT_PX }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => drag && handlePointerUp()}
          >
            {/* Background slots */}
            {Array.from({ length: 5 }).map((_, dayIdx) => (
              <div key={dayIdx} className="relative border-l border-gray-100">
                {Array.from({ length: ROWS }).map((_, row) => (
                  <div
                    key={row}
                    className={`border-b ${row % 2 === 1 ? 'border-gray-100' : 'border-gray-50'} ${
                      canEdit ? 'hover:bg-tps-orange/5 cursor-pointer' : ''
                    }`}
                    style={{ height: SLOT_PX }}
                    onClick={() => {
                      if (!canEdit || drag) return
                      onSlotClick(dayISO(week.startDate, dayIdx), toHHMM(DAY_START_MIN + row * SLOT_MIN))
                    }}
                  />
                ))}

                {/* Event blocks for this day */}
                {eventsForDay(dayIdx).map(e => {
                  const isDragging = drag?.scheduleId === e.scheduleId
                  const startMin = isDragging && drag.kind === 'move' ? drag.startMin : toMinutes(e.scheduledTime!)
                  const durMin   = isDragging ? drag.durationMin : (e.durationMinutes ?? 60)
                  const showDay  = isDragging && drag.kind === 'move' ? drag.dayIdx : dayIdx
                  if (showDay !== dayIdx && isDragging) return null

                  const top    = ((startMin - DAY_START_MIN) / SLOT_MIN) * SLOT_PX
                  const height = Math.max(SLOT_PX, (durMin / SLOT_MIN) * SLOT_PX)
                  const colors = DEPT_BLOCK_COLORS[e.deptCode] ?? 'bg-gray-100 border-gray-300 text-gray-800'

                  return (
                    <div
                      key={e.scheduleId}
                      className={`absolute left-0.5 right-0.5 rounded-md border-l-4 px-1.5 py-1 overflow-hidden text-left transition-shadow ${colors} ${
                        isDragging ? 'shadow-lg opacity-90 z-20' : 'z-10 hover:shadow-md'
                      } ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${!e.isConfirmed ? 'border-dashed' : ''}`}
                      style={{ top, height }}
                      onPointerDown={ev => {
                        if (!canEdit) return
                        ev.preventDefault()
                        ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
                        setDrag({
                          kind: 'move',
                          scheduleId: e.scheduleId,
                          durationMin: e.durationMinutes ?? 60,
                          dayIdx,
                          startMin: toMinutes(e.scheduledTime!),
                        })
                      }}
                      onClick={ev => {
                        ev.stopPropagation()
                        if (!drag) onEventClick(e)
                      }}
                    >
                      <p className="text-[10px] font-bold font-mono leading-tight truncate">{e.courseCode}</p>
                      {height >= SLOT_PX * 1.5 && (
                        <p className="text-[10px] leading-tight truncate opacity-80">{e.title}</p>
                      )}
                      {height >= SLOT_PX * 2.5 && e.instructorName && (
                        <p className="text-[9px] leading-tight truncate opacity-60">{e.instructorName}</p>
                      )}

                      {/* Resize handle */}
                      {canEdit && (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize"
                          onPointerDown={ev => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
                            setDrag({
                              kind: 'resize',
                              scheduleId: e.scheduleId,
                              dayIdx,
                              startMin: toMinutes(e.scheduledTime!),
                              durationMin: e.durationMinutes ?? 60,
                            })
                          }}
                        >
                          <div className="mx-auto mt-0.5 w-6 h-0.5 rounded bg-current opacity-30" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Drag ghost when moving across days */}
            {drag?.kind === 'move' && (
              <div
                className="absolute rounded-md border-2 border-dashed border-tps-orange bg-tps-orange/10 z-30 pointer-events-none"
                style={{
                  left:   `calc(${drag.dayIdx * 20}% + 2px)`,
                  width:  'calc(20% - 4px)',
                  top:    ((drag.startMin - DAY_START_MIN) / SLOT_MIN) * SLOT_PX,
                  height: Math.max(SLOT_PX, (drag.durationMin / SLOT_MIN) * SLOT_PX),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {saving && (
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Saving…</div>
      )}

      {/* Events in this week without a time yet */}
      {week.events.filter(e => !e.scheduledDate || !e.scheduledTime).length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            In this week, not yet on the calendar — click a time slot to place, or click to edit
          </p>
          <div className="flex flex-wrap gap-1.5">
            {week.events.filter(e => !e.scheduledDate || !e.scheduledTime).map(e => (
              <button
                key={e.scheduleId}
                onClick={() => onEventClick(e)}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:border-tps-orange font-mono font-bold text-tps-navy"
              >
                {e.courseCode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conflict override dialog */}
      {conflict && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConflict(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-amber-600">⚠ Schedule Conflict</h3>
            <p className="text-sm text-gray-600">
              This time overlaps {conflict.conflicts.length === 1 ? 'another event' : `${conflict.conflicts.length} other events`} for this class:
            </p>
            <ul className="space-y-1">
              {conflict.conflicts.map((c, i) => (
                <li key={i} className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-tps-navy">{c.courseCode}</span>
                  {' '}{c.title} · {c.time}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button onClick={() => setConflict(null)} className="btn-secondary flex-1 text-sm py-2">
                Cancel
              </button>
              <button onClick={conflict.retry} className="flex-1 text-sm py-2 rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                Schedule Anyway (Override)
              </button>
            </div>
          </div>
        </div>
      )}

      {canEdit && (
        <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100">
          Click an empty slot to schedule · drag a block to move it · drag the bottom
          edge to change duration · overlaps warn with an override option
        </p>
      )}
    </div>
  )
}
