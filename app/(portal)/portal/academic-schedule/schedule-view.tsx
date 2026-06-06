'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deptSortIndex, deptLabel } from '@/lib/mcg-departments'
import {
  createWeekAction, updateWeekAction, deleteWeekAction,
  scheduleEventAction, unscheduleEventAction, toggleConfirmAction,
  type WeekRow, type ScheduledEventRow, type CatalogEvent, type InstructorOption,
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

// ── Event scheduling form (modal) ────────────────────────────────────────────

type EventFormState = {
  syllabusEventId: string
  courseCode:      string
  title:           string
  scheduleId:      string | null   // null = scheduling from catalog
  academicWeekId:  string | null
  instructorId:    string | null
  scheduledDate:   string
  scheduledTime:   string
  durationMinutes: string
  locationRoom:    string
}

function EventFormModal({
  state, weeks, instructors, classId, onClose,
}: {
  state:       EventFormState
  weeks:       WeekRow[]
  instructors: InstructorOption[]
  classId:     string
  onClose:     () => void
}) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [error,   setError] = useState<string | null>(null)
  const [form,    setForm]  = useState(state)

  function set<K extends keyof EventFormState>(key: K, val: EventFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    setError(null)
    startTx(async () => {
      const result = await scheduleEventAction(classId, form.syllabusEventId, {
        academicWeekId:  form.academicWeekId || null,
        instructorId:    form.instructorId || null,
        scheduledDate:   form.scheduledDate || null,
        scheduledTime:   form.scheduledTime || null,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : null,
        locationRoom:    form.locationRoom || null,
      })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
      router.refresh()
      onClose()
    })
  }

  function handleRemove() {
    if (!form.scheduleId) return
    startTx(async () => {
      await unscheduleEventAction(form.scheduleId!)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-mono font-bold text-tps-navy">{form.courseCode}</p>
            <h3 className="font-bold text-tps-navy">{form.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* Week */}
          <div>
            <label className="field-label">Academic Week</label>
            <select
              value={form.academicWeekId ?? ''}
              onChange={e => set('academicWeekId', e.target.value || null)}
              className="field-input"
              disabled={pending}
            >
              <option value="">— Unassigned —</option>
              {weeks.map(w => (
                <option key={w.id} value={w.id}>Week {w.weekNumber} · {w.label}</option>
              ))}
            </select>
          </div>

          {/* Instructor */}
          <div>
            <label className="field-label">Instructor</label>
            <select
              value={form.instructorId ?? ''}
              onChange={e => set('instructorId', e.target.value || null)}
              className="field-input"
              disabled={pending}
            >
              <option value="">— Not assigned —</option>
              {instructors.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Date</label>
              <input type="date" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Time</label>
              <input type="time" value={form.scheduledTime} onChange={e => set('scheduledTime', e.target.value)} className="field-input" disabled={pending} />
            </div>
          </div>

          {/* Duration + room */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Duration (min)</label>
              <input type="number" min={0} value={form.durationMinutes} onChange={e => set('durationMinutes', e.target.value)} className="field-input" disabled={pending} />
            </div>
            <div>
              <label className="field-label">Room / Location</label>
              <input type="text" value={form.locationRoom} onChange={e => set('locationRoom', e.target.value)} className="field-input" placeholder="e.g. Bldg 1864 Rm 107" disabled={pending} />
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={pending} className="btn-primary flex-1 text-sm py-2.5">
              {pending ? 'Saving…' : 'Save'}
            </button>
            {form.scheduleId && (
              <button onClick={handleRemove} disabled={pending} className="text-sm text-red-500 hover:text-red-700 px-3">
                Remove
              </button>
            )}
          </div>
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
            weekNumber: parseInt(form.weekNumber) || 1,
            label: form.label, theme: form.theme || null,
            startDate: form.startDate, endDate: form.endDate,
          })
      if ('error' in result) { setError(result.error ?? 'Failed'); return }
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
              <input type="number" min={1} value={form.weekNumber} onChange={e => set('weekNumber', e.target.value)} className="field-input" disabled={pending} />
            </div>
          )}
          <div>
            <label className="field-label">Label *</label>
            <input type="text" value={form.label} onChange={e => set('label', e.target.value)} className="field-input" placeholder="e.g. Phase 6 — Week 2" disabled={pending} />
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

// ── Catalog picker (add event to schedule) ───────────────────────────────────

function CatalogPicker({
  catalog, onPick, onClose,
}: {
  catalog: CatalogEvent[]
  onPick:  (e: CatalogEvent) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [dept,   setDept]   = useState<string | 'all'>('all')

  const filtered = catalog.filter(e => {
    if (dept !== 'all' && e.deptCode !== dept) return false
    if (search && !e.courseCode.toLowerCase().includes(search.toLowerCase()) &&
        !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const depts = [...new Set(catalog.map(e => e.deptCode))]
    .sort((a, b) => deptSortIndex(a) - deptSortIndex(b))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-tps-navy">Add Event to Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <input
            type="search"
            placeholder="Search course code or title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input flex-1 min-w-[180px]"
          />
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="field-input w-auto"
          >
            <option value="all">All Courses</option>
            {depts.map(d => <option key={d} value={d}>{d} — {deptLabel(d)}</option>)}
          </select>
        </div>

        <div className="overflow-y-auto flex-1 space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No unscheduled events match.</p>
          ) : filtered.map(e => (
            <button
              key={e.id}
              onClick={() => onPick(e)}
              className="w-full text-left card py-2.5 hover:border-tps-orange transition-colors flex items-center gap-3"
            >
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${DEPT_COLORS[e.deptCode] ?? 'bg-gray-100 text-gray-600'}`}>
                {e.deptCode}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono font-bold text-tps-navy">{e.courseCode}</p>
                <p className="text-sm text-gray-700 truncate">{e.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Event row card ────────────────────────────────────────────────────────────

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
            {event.courseCode}
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
  selectedClassId:   string
  selectedClassName: string
  weeks:             WeekRow[]
  unscheduled:       ScheduledEventRow[]
  catalog:           CatalogEvent[]
  instructors:       InstructorOption[]
  canEdit:           boolean
}

export function ScheduleView({
  classes, selectedClassId, selectedClassName, weeks, unscheduled, catalog, instructors, canEdit,
}: Props) {
  const router = useRouter()
  const [eventForm,  setEventForm]  = useState<EventFormState | null>(null)
  const [weekForm,   setWeekForm]   = useState<WeekFormState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  function openEventEdit(e: ScheduledEventRow) {
    setEventForm({
      syllabusEventId: e.syllabusEventId,
      courseCode:      e.courseCode,
      title:           e.title,
      scheduleId:      e.scheduleId,
      academicWeekId:  e.academicWeekId,
      instructorId:    e.instructorId,
      scheduledDate:   toInputDate(e.scheduledDate),
      scheduledTime:   e.scheduledTime ?? '',
      durationMinutes: e.durationMinutes?.toString() ?? '',
      locationRoom:    e.locationRoom ?? '',
    })
  }

  function openCatalogPick(e: CatalogEvent) {
    setPickerOpen(false)
    setEventForm({
      syllabusEventId: e.id,
      courseCode:      e.courseCode,
      title:           e.title,
      scheduleId:      null,
      academicWeekId:  null,
      instructorId:    null,
      scheduledDate:   '',
      scheduledTime:   '',
      durationMinutes: '',
      locationRoom:    '',
    })
  }

  async function handleToggleConfirm(scheduleId: string) {
    await toggleConfirmAction(scheduleId)
    router.refresh()
  }

  const totalScheduled = weeks.reduce((n, w) => n + w.events.length, 0) + unscheduled.length

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Academic Schedule</h1>
          <p className="text-gray-500 text-sm">
            Class {selectedClassName} · {totalScheduled} scheduled event{totalScheduled === 1 ? '' : 's'} · {weeks.length} week{weeks.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {classes.length > 1 && (
            <select
              value={selectedClassId}
              onChange={e => router.push(`/portal/academic-schedule?classId=${e.target.value}`)}
              className="field-input w-auto text-sm"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {canEdit && (
            <>
              <button
                onClick={() => setWeekForm({
                  weekId: null,
                  weekNumber: (Math.max(0, ...weeks.map(w => w.weekNumber)) + 1).toString(),
                  label: '', theme: '', startDate: '', endDate: '',
                })}
                className="btn-secondary text-sm px-3 py-2"
              >
                + Week
              </button>
              <button onClick={() => setPickerOpen(true)} className="btn-primary text-sm px-3 py-2">
                + Schedule Event
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty state */}
      {weeks.length === 0 && unscheduled.length === 0 && (
        <div className="card text-center py-16 text-gray-400 text-sm">
          No academic schedule yet.
          {canEdit && ' Start by adding a week, then schedule events into it.'}
        </div>
      )}

      {/* Week sections */}
      {weeks.map(week => (
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
                  onEdit={() => openEventEdit(e)}
                  onToggleConfirm={() => handleToggleConfirm(e.scheduleId)}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Unassigned events */}
      {unscheduled.length > 0 && (
        <section>
          <h2 className="font-bold text-gray-500 mb-2">Unassigned to a Week</h2>
          <div className="space-y-2">
            {unscheduled.map(e => (
              <EventCard
                key={e.scheduleId}
                event={e}
                canEdit={canEdit}
                onEdit={() => openEventEdit(e)}
                onToggleConfirm={() => handleToggleConfirm(e.scheduleId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      {eventForm && (
        <EventFormModal
          state={eventForm}
          weeks={weeks}
          instructors={instructors}
          classId={selectedClassId}
          onClose={() => setEventForm(null)}
        />
      )}
      {weekForm && (
        <WeekFormModal state={weekForm} classId={selectedClassId} onClose={() => setWeekForm(null)} />
      )}
      {pickerOpen && (
        <CatalogPicker catalog={catalog} onPick={openCatalogPick} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
