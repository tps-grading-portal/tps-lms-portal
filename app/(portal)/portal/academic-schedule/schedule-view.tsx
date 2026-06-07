'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deptSortIndex, deptLabel } from '@/lib/mcg-departments'
import { WeekCalendar } from './week-calendar'
import {
  createWeekAction, updateWeekAction, deleteWeekAction,
  scheduleEventAction, unscheduleAllSessionsAction, toggleConfirmAction,
  saveEventSessionsAction, setDefaultDurationAction, generateWeeksAction,
  saveCustomItemAction, deleteCustomItemAction,
  type WeekRow, type ScheduledEventRow, type CatalogEvent, type InstructorOption,
  type ScheduleConflict, type CustomItemRow,
} from './actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso), e = new Date(endIso)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

function toInputDate(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

const DEPT_COLORS: Record<string, string> = {
  AN: 'bg-gray-100 text-gray-600',     CF: 'bg-cyan-100 text-cyan-700',
  SO: 'bg-purple-100 text-purple-700', AS: 'bg-indigo-100 text-indigo-700',
  PF: 'bg-blue-100 text-blue-700',     FQ: 'bg-sky-100 text-sky-700',
  SY: 'bg-emerald-100 text-emerald-700', TF: 'bg-amber-100 text-amber-700',
  TL: 'bg-rose-100 text-rose-700',
}

const CLASS_TOGGLE_COLORS = ['bg-blue-600 text-white', 'bg-amber-500 text-white', 'bg-purple-600 text-white']
const CLASS_BANNER_COLORS = [
  'bg-blue-50 border border-blue-200 text-blue-900',
  'bg-amber-50 border border-amber-200 text-amber-900',
  'bg-purple-50 border border-purple-200 text-purple-900',
]
const CLASS_LEGEND_COLORS = ['bg-blue-400', 'bg-amber-400', 'bg-purple-400']

// ── Sessions modal (multi-day course editor) ─────────────────────────────────

type SessionRow = { date: string; time: string; duration: string }

function SessionsModal({
  classId, className, event, existingSessions, instructors, prefill, onClose,
}: {
  classId:          string
  className:        string
  event:            { id: string; courseCode: string; title: string; defaultDuration: number | null }
  existingSessions: ScheduledEventRow[]   // current sessions for this class+event
  instructors:      InstructorOption[]
  prefill:          { date: string; time: string } | null
  onClose:          () => void
}) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null)

  const first = existingSessions[0] ?? null
  const [instructorId, setInstructorId] = useState<string>(first?.instructorId ?? '')
  const [locationRoom, setLocationRoom] = useState<string>(first?.locationRoom ?? '')
  const [defaultDur,   setDefaultDur]   = useState<string>(event.defaultDuration?.toString() ?? '')

  const initialSessions: SessionRow[] =
    existingSessions.length > 0
      ? existingSessions
          .filter(s => s.scheduledDate && s.scheduledTime)
          .sort((a, b) => a.sessionNumber - b.sessionNumber)
          .map(s => ({
            date:     toInputDate(s.scheduledDate),
            time:     s.scheduledTime ?? '',
            duration: (s.durationMinutes ?? 60).toString(),
          }))
      : [{
          date:     prefill?.date ?? '',
          time:     prefill?.time ?? '08:00',
          duration: (event.defaultDuration ?? 60).toString(),
        }]

  const [sessions, setSessions] = useState<SessionRow[]>(
    initialSessions.length > 0 ? initialSessions : [{ date: '', time: '08:00', duration: '60' }],
  )

  function setSession(i: number, patch: Partial<SessionRow>) {
    setSessions(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
    setConflicts(null)
  }

  function addDay() {
    const last = sessions[sessions.length - 1]
    // Default the new day to the day after the previous session
    let nextDate = ''
    if (last?.date) {
      const d = new Date(`${last.date}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      nextDate = d.toISOString().slice(0, 10)
    }
    setSessions(prev => [...prev, { date: nextDate, time: last?.time ?? '08:00', duration: last?.duration ?? '60' }])
  }

  function removeDay(i: number) {
    setSessions(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSave(override = false) {
    setError(null)
    const parsed = sessions
      .filter(s => s.date && s.time)
      .map(s => ({ date: s.date, time: s.time, durationMinutes: parseInt(s.duration) || 60 }))
    if (parsed.length === 0) { setError('At least one session with a date and time is required.'); return }

    startTx(async () => {
      // Persist default course length if changed
      const newDefault = defaultDur ? parseInt(defaultDur) : null
      if (newDefault !== event.defaultDuration) {
        await setDefaultDurationAction(event.id, newDefault)
      }

      const result = await saveEventSessionsAction(
        classId, event.id,
        { instructorId: instructorId || null, locationRoom: locationRoom || null },
        parsed,
        override,
      )
      if ('conflicts' in result && result.conflicts) { setConflicts(result.conflicts); return }
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  function handleRemoveAll() {
    if (!confirm(`Remove ${event.courseCode} from the ${className} schedule entirely?`)) return
    startTx(async () => {
      await unscheduleAllSessionsAction(classId, event.id)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono font-bold text-tps-navy">{event.courseCode} · Class {className}</p>
            <h3 className="font-bold text-tps-navy">{event.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Instructor + room */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Instructor</label>
            <select value={instructorId} onChange={e => setInstructorId(e.target.value)} className="field-input" disabled={pending}>
              <option value="">— Not assigned —</option>
              {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Room / Location</label>
            <input value={locationRoom} onChange={e => setLocationRoom(e.target.value)} className="field-input" placeholder="Bldg 1864 Rm 107" disabled={pending} />
          </div>
        </div>

        {/* Default course length */}
        <div>
          <label className="field-label">Course Length (default, minutes)</label>
          <input
            type="number" min={0} step={30}
            value={defaultDur}
            onChange={e => setDefaultDur(e.target.value)}
            className="field-input w-32"
            disabled={pending}
          />
          <p className="text-xs text-gray-400 mt-1">Saved on the course — pre-fills future scheduling for any class.</p>
        </div>

        {/* Sessions — spread the course over multiple days */}
        <div className="space-y-2">
          <label className="field-label">Sessions {sessions.length > 1 && `(${sessions.length} days)`}</label>
          {sessions.map((s, i) => (
            <div key={i} className="flex gap-2 items-center flex-wrap">
              <span className="text-[10px] font-bold text-gray-400 w-10">Day {i + 1}</span>
              <input type="date" value={s.date} onChange={e => setSession(i, { date: e.target.value })} className="field-input w-36 text-sm" disabled={pending} />
              <input type="time" value={s.time} onChange={e => setSession(i, { time: e.target.value })} className="field-input w-26 text-sm" disabled={pending} />
              <div className="flex items-center gap-1">
                <input type="number" min={30} step={30} value={s.duration} onChange={e => setSession(i, { duration: e.target.value })} className="field-input w-20 text-sm" disabled={pending} />
                <span className="text-xs text-gray-400">min</span>
              </div>
              {sessions.length > 1 && (
                <button onClick={() => removeDay(i)} className="text-gray-300 hover:text-red-500 text-lg leading-none" disabled={pending}>×</button>
              )}
            </div>
          ))}
          <button onClick={addDay} className="text-xs text-tps-blue hover:underline" disabled={pending}>
            + Add Day — spread this course over another day
          </button>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        {/* Conflicts + override */}
        {conflicts && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-3 space-y-2">
            <p className="text-sm font-semibold text-amber-800">
              ⚠ Overlaps {conflicts.length === 1 ? 'another event' : `${conflicts.length} other events`} for this class:
            </p>
            <ul className="space-y-1">
              {conflicts.map((c, i) => (
                <li key={i} className="text-xs text-amber-800">
                  <span className="font-mono font-bold">{c.courseCode}</span> {c.title} · {c.time}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSave(true)}
              disabled={pending}
              className="w-full text-sm py-2 rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              {pending ? 'Saving…' : 'Schedule Anyway (Override)'}
            </button>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={() => handleSave(false)} disabled={pending} className="btn-primary flex-1 text-sm py-2.5">
            {pending ? 'Saving…' : `Save ${sessions.length > 1 ? `${sessions.length} Sessions` : 'Schedule'}`}
          </button>
          {existingSessions.length > 0 && (
            <button onClick={handleRemoveAll} disabled={pending} className="text-sm text-red-500 hover:text-red-700 px-3">
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Custom calendar item modal (free text) ────────────────────────────────────

function CustomItemModal({
  item, prefill, activeClasses, onClose,
}: {
  item:          CustomItemRow | null   // present = edit
  prefill:       { date: string; time: string } | null
  activeClasses: { id: string; name: string }[]
  onClose:       () => void
}) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [title,    setTitle]    = useState(item?.title ?? '')
  const [classId,  setClassId]  = useState<string>(item?.classId ?? '')
  const [date,     setDate]     = useState(item ? item.scheduledDate.slice(0, 10) : prefill?.date ?? '')
  const [time,     setTime]     = useState(item?.scheduledTime ?? prefill?.time ?? '08:00')
  const [duration, setDuration] = useState((item?.durationMinutes ?? 60).toString())
  const [room,     setRoom]     = useState(item?.locationRoom ?? '')
  const [notes,    setNotes]    = useState(item?.notes ?? '')

  function handleSave() {
    setError(null)
    startTx(async () => {
      const result = await saveCustomItemAction({
        id:              item?.id,
        classId:         classId || null,
        title,
        notes:           notes || null,
        scheduledDate:   date,
        scheduledTime:   time,
        durationMinutes: parseInt(duration) || 60,
        locationRoom:    room || null,
      })
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  function handleDelete() {
    if (!item) return
    if (!confirm(`Remove "${item.title}" from the calendar?`)) return
    startTx(async () => {
      await deleteCustomItemAction(item.id)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-tps-navy">📌 {item ? 'Edit Calendar Item' : 'Add Calendar Item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div>
          <label className="field-label">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="field-input"
            placeholder="e.g. Commander's Call, Safety Briefing, PT…"
            disabled={pending}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Applies To</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className="field-input" disabled={pending}>
              <option value="">Whole school</option>
              {activeClasses.map(c => <option key={c.id} value={c.id}>Class {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Room / Location</label>
            <input value={room} onChange={e => setRoom(e.target.value)} className="field-input" disabled={pending} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="field-input" disabled={pending} />
          </div>
          <div>
            <label className="field-label">Time *</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="field-input" disabled={pending} />
          </div>
          <div>
            <label className="field-label">Minutes</label>
            <input type="number" min={30} step={30} value={duration} onChange={e => setDuration(e.target.value)} className="field-input" disabled={pending} />
          </div>
        </div>

        <div>
          <label className="field-label">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="field-input" rows={2} disabled={pending} />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={pending || !title.trim() || !date || !time} className="btn-primary flex-1 text-sm py-2.5">
            {pending ? 'Saving…' : 'Save Item'}
          </button>
          {item && (
            <button onClick={handleDelete} disabled={pending} className="text-sm text-red-500 hover:text-red-700 px-3">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Week form (create/edit) ───────────────────────────────────────────────────

type WeekFormState = {
  weekId:     string | null
  weekNumber: string
  label:      string
  theme:      string
  startDate:  string
  endDate:    string
}

function WeekFormModal({ state, classId, onClose }: { state: WeekFormState; classId: string; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [form,    setForm]  = useState(state)

  function set<K extends keyof WeekFormState>(key: K, val: WeekFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    setError(null)
    if (!form.label.trim() || !form.startDate || !form.endDate) {
      setError('Label, start date, and end date are required.')
      return
    }
    startTx(async () => {
      const result = form.weekId
        ? await updateWeekAction(form.weekId, {
            label: form.label, theme: form.theme || null,
            startDate: form.startDate, endDate: form.endDate,
          })
        : await createWeekAction(classId, {
            weekNumber: parseInt(form.weekNumber) || 0,
            label: form.label, theme: form.theme || null,
            startDate: form.startDate, endDate: form.endDate,
          })
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  function handleDelete() {
    if (!form.weekId) return
    if (!confirm('Delete this week? Scheduled events will become unassigned (not deleted).')) return
    startTx(async () => {
      await deleteWeekAction(form.weekId!)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy">{form.weekId ? 'Edit Week' : 'Add Week'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          {!form.weekId && (
            <div>
              <label className="field-label">Week Number</label>
              <input type="number" min={0} value={form.weekNumber} onChange={e => set('weekNumber', e.target.value)} className="field-input" disabled={pending} />
            </div>
          )}
          <div>
            <label className="field-label">Label *</label>
            <input type="text" value={form.label} onChange={e => set('label', e.target.value)} className="field-input" placeholder="e.g. Week 4" disabled={pending} />
          </div>
          <div>
            <label className="field-label">Theme</label>
            <input type="text" value={form.theme} onChange={e => set('theme', e.target.value)} className="field-input" placeholder="e.g. Performance Flight Testing" disabled={pending} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">End Date *</label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className="field-input" disabled={pending} />
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={pending} className="btn-primary flex-1 text-sm py-2.5">
              {pending ? 'Saving…' : 'Save Week'}
            </button>
            {form.weekId && (
              <button onClick={handleDelete} disabled={pending} className="text-sm text-red-500 hover:text-red-700 px-3">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Week generation setup (class start → grad date) ──────────────────────────

function GenerateWeeksPanel({
  classId, defaultStart, defaultEnd,
}: {
  classId:      string
  defaultStart: string | null
  defaultEnd:   string | null
}) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [start,   setStart] = useState(defaultStart ?? '')
  const [grad,    setGrad]  = useState(defaultEnd ?? '')

  function handleGenerate() {
    setError(null)
    if (!start || !grad) { setError('Both dates are required.'); return }
    startTx(async () => {
      const result = await generateWeeksAction(classId, start, grad)
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="card max-w-lg space-y-4">
      <div>
        <h2 className="font-bold text-tps-navy">Set Up the Class Schedule</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter the class start date and graduation date. Weeks run Monday–Friday
          and are numbered from <strong>Week 0</strong> upward.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Class Start Date *</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="field-input" disabled={pending} />
        </div>
        <div>
          <label className="field-label">Graduation Date *</label>
          <input type="date" value={grad} onChange={e => setGrad(e.target.value)} className="field-input" disabled={pending} />
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      <button onClick={handleGenerate} disabled={pending || !start || !grad} className="btn-primary text-sm px-5 py-2.5">
        {pending ? 'Generating…' : 'Generate Weeks'}
      </button>
    </div>
  )
}

// ── Unscheduled events side panel ─────────────────────────────────────────────

function UnscheduledPanel({
  activeClasses, panelClassId, onPanelClassChange, events, selectedEventId, onSelect, canEdit,
}: {
  activeClasses:      { id: string; name: string; colorIdx: number }[]
  panelClassId:       string
  onPanelClassChange: (id: string) => void
  events:             CatalogEvent[]
  selectedEventId:    string | null
  onSelect:           (e: CatalogEvent | null) => void
  canEdit:            boolean
}) {
  const [search, setSearch] = useState('')
  const [dept,   setDept]   = useState<string | 'all'>('all')

  const depts = [...new Set(events.map(e => e.deptCode))].sort((a, b) => deptSortIndex(a) - deptSortIndex(b))

  const filtered = events.filter(e => {
    if (dept !== 'all' && e.deptCode !== dept) return false
    if (search && !e.courseCode.toLowerCase().includes(search.toLowerCase()) &&
        !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <aside className="w-full lg:w-72 shrink-0 card p-0 flex flex-col" style={{ maxHeight: '75vh' }}>
      {/* Class toggle — dictates the drop target */}
      <div className="p-3 border-b border-gray-100 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Needs Scheduling — for class:
        </p>
        <div className="flex gap-1">
          {activeClasses.map(c => (
            <button
              key={c.id}
              onClick={() => onPanelClassChange(c.id)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                panelClassId === c.id
                  ? CLASS_TOGGLE_COLORS[c.colorIdx % CLASS_TOGGLE_COLORS.length]
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="field-input text-sm"
        />
        <select value={dept} onChange={e => setDept(e.target.value)} className="field-input text-xs w-full">
          <option value="all">All Courses</option>
          {depts.map(d => <option key={d} value={d}>{d} — {deptLabel(d)}</option>)}
        </select>
      </div>

      {/* Draggable event list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-xs py-6">Everything is scheduled. 🎉</p>
        ) : filtered.map(e => (
          <div
            key={e.id}
            draggable={canEdit}
            onDragStart={ev => {
              ev.dataTransfer.setData('application/x-tps-event', e.id)
              ev.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => canEdit && onSelect(selectedEventId === e.id ? null : e)}
            className={`px-2.5 py-2 rounded-lg border text-left transition-colors ${
              canEdit ? 'cursor-grab active:cursor-grabbing' : ''
            } ${
              selectedEventId === e.id
                ? 'border-tps-orange bg-tps-orange/5'
                : 'border-gray-100 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${DEPT_COLORS[e.deptCode] ?? 'bg-gray-100 text-gray-600'}`}>
                {e.deptCode}
              </span>
              <span className="text-xs font-mono font-bold text-tps-navy truncate">{e.courseCode}</span>
              {e.defaultDuration && (
                <span className="text-[9px] text-gray-400 ml-auto shrink-0">{e.defaultDuration}m</span>
              )}
            </div>
            <p className="text-[11px] text-gray-600 truncate mt-0.5">{e.title}</p>
          </div>
        ))}
      </div>

      <p className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400">
        {filtered.length} unscheduled · drag onto the calendar, or click to select then click a slot
      </p>
    </aside>
  )
}

// ── Event card (list view) ────────────────────────────────────────────────────

function EventCard({
  event, canEdit, onEdit, onToggleConfirm,
}: {
  event:           ScheduledEventRow
  canEdit:         boolean
  onEdit:          () => void
  onToggleConfirm: () => void
}) {
  return (
    <div className={`card py-2.5 flex items-center gap-3 ${event.isConfirmed ? '' : 'border-dashed'}`}>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${DEPT_COLORS[event.deptCode] ?? 'bg-gray-100 text-gray-600'}`}>
        {event.deptCode}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/portal/lessons/${encodeURIComponent(event.courseCode)}`}
            className="text-xs font-mono font-bold text-tps-navy hover:text-tps-orange transition-colors"
          >
            {event.courseCode}{event.sessionCount > 1 ? ` (day ${event.sessionNumber}/${event.sessionCount})` : ''}
          </Link>
          {event.isGraded && (
            <span className="text-[10px] font-semibold bg-tps-orange/10 text-tps-orange px-1.5 py-0.5 rounded">Graded</span>
          )}
          {event.hasLessonPage && event.lessonPublished && (
            <span className="text-[10px] text-green-600 font-medium">● Lesson posted</span>
          )}
        </div>
        <p className="text-sm text-gray-700 truncate">{event.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {fmtDate(event.scheduledDate) ?? 'No date'}
          {event.scheduledTime && ` · ${event.scheduledTime}`}
          {event.durationMinutes && ` · ${event.durationMinutes} min`}
          {event.locationRoom && ` · ${event.locationRoom}`}
          {event.instructorName && <span className="text-gray-600 font-medium"> · {event.instructorName}</span>}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canEdit && (
          <>
            <button
              onClick={onToggleConfirm}
              title={event.isConfirmed ? 'Confirmed — click to unconfirm' : 'Unconfirmed — click to confirm'}
              className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                event.isConfirmed
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {event.isConfirmed ? '✓' : '—'}
            </button>
            <button onClick={onEdit} className="btn-secondary text-xs px-2.5 py-1">Edit</button>
          </>
        )}
        <Link
          href={`/portal/lessons/${encodeURIComponent(event.courseCode)}`}
          className="btn-primary text-xs px-2.5 py-1"
        >
          Lesson
        </Link>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Props = {
  classes:           { id: string; name: string; isActive: boolean }[]
  activeClasses:     { id: string; name: string; colorIdx: number; startDate: string | null; isPlanning: boolean }[]
  selectedClassId:   string
  selectedClassName: string
  classStartDate:    string | null
  classEndDate:      string | null
  weeks:             WeekRow[]
  scheduled:         ScheduledEventRow[]   // all sessions, all visible classes
  customItems:       CustomItemRow[]
  unscheduledByClass: Record<string, CatalogEvent[]>
  instructors:       InstructorOption[]
  canEdit:           boolean
}

/** Monday (YYYY-MM-DD) of the week containing the given date. */
function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`)
  const day = d.getUTCDay() // 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

function shiftWeeks(mondayISO: string, weeks: number): string {
  const d = new Date(`${mondayISO}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

/** Week number of a class for a given week's Monday (Week 0 = first week). */
function classWeekNumber(classStartISO: string, viewMondayISO: string): number {
  const start = new Date(`${mondayOf(classStartISO)}T12:00:00Z`)
  const view  = new Date(`${viewMondayISO}T12:00:00Z`)
  return Math.round((view.getTime() - start.getTime()) / (7 * 86400_000))
}

type SessionsModalState = {
  classId:   string
  className: string
  event:     { id: string; courseCode: string; title: string; defaultDuration: number | null }
  prefill:   { date: string; time: string } | null
}

export function ScheduleView({
  classes, activeClasses, selectedClassId, selectedClassName, classStartDate, classEndDate,
  weeks, scheduled, customItems, unscheduledByClass, instructors, canEdit,
}: Props) {
  const router = useRouter()
  const [weekForm,      setWeekForm]      = useState<WeekFormState | null>(null)
  const [viewMode,      setViewMode]      = useState<'calendar' | 'list'>('calendar')
  // Continuous calendar — starts at the current week, scrolls week by week
  const [viewMonday,    setViewMonday]    = useState(() => mondayOf(new Date().toISOString().slice(0, 10)))
  const [showWeekend,   setShowWeekend]   = useState(false)
  const [panelClassId,  setPanelClassId]  = useState(selectedClassId)
  const [selectedEvent, setSelectedEvent] = useState<CatalogEvent | null>(null)
  const [sessionsModal, setSessionsModal] = useState<SessionsModalState | null>(null)
  const [customModal,   setCustomModal]   = useState<{ item: CustomItemRow | null; prefill: { date: string; time: string } | null } | null>(null)
  const [dropConflicts, setDropConflicts] = useState<{ conflicts: ScheduleConflict[]; retry: () => void } | null>(null)
  const [, startTx] = useTransition()

  const panelClass = activeClasses.find(c => c.id === panelClassId) ?? activeClasses[0]
  const panelEvents = unscheduledByClass[panelClass?.id ?? ''] ?? []

  const rangeEnd = new Date(new Date(`${viewMonday}T12:00:00Z`).getTime() + (showWeekend ? 6 : 4) * 86400_000)
  const weekRangeLabel =
    `${new Date(`${viewMonday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ` +
    rangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const classNameById = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])

  // ── Scheduling flows ────────────────────────────────────────────────────────

  function scheduleAt(eventId: string, dateISO: string, time: string, override = false) {
    const targetClass = panelClass?.id ?? selectedClassId
    const catalogEvent = (unscheduledByClass[targetClass] ?? []).find(e => e.id === eventId)
    startTx(async () => {
      const result = await scheduleEventAction(targetClass, eventId, {
        academicWeekId:  null,
        instructorId:    null,
        scheduledDate:   dateISO,
        scheduledTime:   time,
        durationMinutes: catalogEvent?.defaultDuration ?? 60,
        locationRoom:    null,
        override,
      })
      if ('conflicts' in result && result.conflicts) {
        setDropConflicts({
          conflicts: result.conflicts,
          retry: () => { setDropConflicts(null); scheduleAt(eventId, dateISO, time, true) },
        })
        return
      }
      setSelectedEvent(null)
      router.refresh()
    })
  }

  function handleSlotClick(dateISO: string, time: string) {
    if (selectedEvent) {
      scheduleAt(selectedEvent.id, dateISO, time)
    }
  }

  function openSessionsForScheduled(e: ScheduledEventRow) {
    // Students (and any view-only role) go straight to the course page
    if (!canEdit) {
      router.push(`/portal/lessons/${encodeURIComponent(e.courseCode)}`)
      return
    }
    setSessionsModal({
      classId:   e.classId,
      className: classNameById.get(e.classId) ?? '',
      event: {
        id:              e.syllabusEventId,
        courseCode:      e.courseCode,
        title:           e.title,
        defaultDuration: e.durationMinutes,
      },
      prefill: null,
    })
  }

  async function handleToggleConfirm(scheduleId: string) {
    await toggleConfirmAction(scheduleId)
    router.refresh()
  }

  // Sessions for the modal's class+event
  const modalSessions = sessionsModal
    ? scheduled.filter(s => s.classId === sessionsModal.classId && s.syllabusEventId === sessionsModal.event.id)
    : []

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Academic Schedule</h1>
          <p className="text-gray-500 text-sm">
            {activeClasses.length > 1
              ? `Classes ${activeClasses.map(c => c.name).join(' + ')} on the calendar`
              : `Class ${selectedClassName}`}
            {' '}· {weeks.length} week{weeks.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Legend for visible classes */}
          {activeClasses.length > 1 && (
            <div className="flex gap-2 items-center mr-1">
              {activeClasses.map(c => (
                <span key={c.id} className="flex items-center gap-1 text-xs text-gray-500">
                  <span className={`w-3 h-3 rounded ${CLASS_LEGEND_COLORS[c.colorIdx % CLASS_LEGEND_COLORS.length]}`} />
                  {c.name}{c.isPlanning && <span className="text-gray-400">(planning)</span>}
                </span>
              ))}
            </div>
          )}

          {/* Weekend toggle */}
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showWeekend}
              onChange={e => setShowWeekend(e.target.checked)}
              className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
            />
            Weekend
          </label>

          {/* View toggle */}
          {weeks.length > 0 && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['calendar', 'list'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    viewMode === m ? 'bg-tps-navy text-white' : 'bg-white text-gray-600 hover:text-tps-navy'
                  }`}
                >
                  {m === 'calendar' ? 'Calendar' : 'List'}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Calendar + side panel ── */}
      {viewMode === 'calendar' && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 space-y-3 w-full">
            {/* Week navigation — continuous, week by week; click the date
                range to jump anywhere via date picker */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setViewMonday(m => shiftWeeks(m, -1))}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                ← Prev Week
              </button>
              <label className="relative cursor-pointer group" title="Click to jump to any date">
                <span className="text-sm font-semibold text-tps-navy px-1 group-hover:text-tps-orange transition-colors">
                  {weekRangeLabel} ▾
                </span>
                <input
                  type="date"
                  value={viewMonday}
                  onChange={e => { if (e.target.value) setViewMonday(mondayOf(e.target.value)) }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <button
                onClick={() => setViewMonday(m => shiftWeeks(m, 1))}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                Next Week →
              </button>
              <button
                onClick={() => setViewMonday(mondayOf(new Date().toISOString().slice(0, 10)))}
                className="text-xs text-tps-blue hover:underline px-1"
              >
                Today
              </button>
              {canEdit && (
                <button
                  onClick={() => setCustomModal({ item: null, prefill: { date: viewMonday, time: '08:00' } })}
                  className="btn-secondary text-xs px-3 py-1.5"
                  title="Add a free-text item (briefing, social, holiday…)"
                >
                  📌 + Custom Item
                </button>
              )}
              {selectedEvent && (
                <span className="text-xs bg-tps-orange/10 text-tps-orange font-semibold px-2.5 py-1.5 rounded-lg">
                  Placing {selectedEvent.courseCode} — click a slot
                  <button onClick={() => setSelectedEvent(null)} className="ml-1.5 text-tps-orange/60 hover:text-tps-orange">×</button>
                </span>
              )}
            </div>

            {/* Class week banners — where each active class is in its course */}
            {activeClasses.some(c => c.startDate) && (
              <div className="flex gap-2 flex-wrap">
                {activeClasses.filter(c => c.startDate).map(c => {
                  const n = classWeekNumber(c.startDate!, viewMonday)
                  return (
                    <div
                      key={c.id}
                      className={`flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm font-semibold ${
                        CLASS_BANNER_COLORS[c.colorIdx % CLASS_BANNER_COLORS.length]
                      }`}
                    >
                      Class {c.name} — {n < 0
                        ? `starts in ${-n} week${n === -1 ? '' : 's'}`
                        : `Week ${n}`}
                      {c.isPlanning && <span className="ml-1.5 text-xs font-normal opacity-70">(planning)</span>}
                    </div>
                  )
                })}
              </div>
            )}

            <WeekCalendar
              weekStartISO={viewMonday}
              events={scheduled}
              customItems={customItems}
              laneCount={activeClasses.length}
              days={showWeekend ? 7 : 5}
              canEdit={canEdit}
              onSlotClick={handleSlotClick}
              onEventClick={openSessionsForScheduled}
              onCustomItemClick={c => { if (canEdit) setCustomModal({ item: c, prefill: null }) }}
              onExternalDrop={(eventId, dateISO, time) => scheduleAt(eventId, dateISO, time)}
            />
          </div>

          {/* Side panel: unscheduled events with class toggle */}
          {canEdit && activeClasses.length > 0 && (
            <UnscheduledPanel
              activeClasses={activeClasses}
              panelClassId={panelClass?.id ?? selectedClassId}
              onPanelClassChange={id => { setPanelClassId(id); setSelectedEvent(null) }}
              events={panelEvents}
              selectedEventId={selectedEvent?.id ?? null}
              onSelect={setSelectedEvent}
              canEdit={canEdit}
            />
          )}
        </div>
      )}

      {/* List view setup — weeks records power the list grouping */}
      {viewMode === 'list' && weeks.length === 0 && canEdit && (
        <GenerateWeeksPanel
          classId={selectedClassId}
          defaultStart={classStartDate}
          defaultEnd={classEndDate}
        />
      )}

      {/* ── List view (selected class weeks) ── */}
      {viewMode === 'list' && weeks.map(week => (
        <section key={week.id}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="font-bold text-tps-navy">
                Week {week.weekNumber} <span className="font-normal text-gray-500">· {week.label}</span>
              </h2>
              <span className="text-xs text-gray-400">{fmtRange(week.startDate, week.endDate)}</span>
              {week.theme && (
                <span className="text-xs bg-tps-navy/5 text-tps-navy px-2 py-0.5 rounded-full">{week.theme}</span>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => setWeekForm({
                  weekId: week.id,
                  weekNumber: week.weekNumber.toString(),
                  label: week.label,
                  theme: week.theme ?? '',
                  startDate: toInputDate(week.startDate),
                  endDate: toInputDate(week.endDate),
                })}
                className="text-xs text-gray-400 hover:text-tps-navy"
              >
                Edit week
              </button>
            )}
          </div>

          {week.events.length === 0 ? (
            <div className="card py-4 text-center text-gray-300 text-sm border-dashed">No events scheduled this week.</div>
          ) : (
            <div className="space-y-2">
              {week.events.map(e => (
                <EventCard
                  key={e.scheduleId}
                  event={e}
                  canEdit={canEdit}
                  onEdit={() => openSessionsForScheduled(e)}
                  onToggleConfirm={() => handleToggleConfirm(e.scheduleId)}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Drop conflict dialog */}
      {dropConflicts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDropConflicts(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-amber-600">⚠ Schedule Conflict</h3>
            <ul className="space-y-1">
              {dropConflicts.conflicts.map((c, i) => (
                <li key={i} className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-tps-navy">{c.courseCode}</span>
                  {' '}{c.title} · {c.time}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button onClick={() => setDropConflicts(null)} className="btn-secondary flex-1 text-sm py-2">
                Cancel
              </button>
              <button onClick={dropConflicts.retry} className="flex-1 text-sm py-2 rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                Schedule Anyway (Override)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {sessionsModal && (
        <SessionsModal
          classId={sessionsModal.classId}
          className={sessionsModal.className}
          event={sessionsModal.event}
          existingSessions={modalSessions}
          instructors={instructors}
          prefill={sessionsModal.prefill}
          onClose={() => setSessionsModal(null)}
        />
      )}
      {weekForm && (
        <WeekFormModal state={weekForm} classId={selectedClassId} onClose={() => setWeekForm(null)} />
      )}
      {customModal && (
        <CustomItemModal
          item={customModal.item}
          prefill={customModal.prefill}
          activeClasses={activeClasses}
          onClose={() => setCustomModal(null)}
        />
      )}
    </div>
  )
}
