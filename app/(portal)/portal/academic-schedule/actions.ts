'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { Track } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScheduledEventRow = {
  scheduleId:      string
  syllabusEventId: string
  classId:         string
  className:       string
  classColorIdx:   number          // 0/1 — visual distinction between active classes
  sessionNumber:   number
  sessionCount:    number          // total sessions of this event for this class
  courseCode:      string
  title:           string
  deptCode:        string
  phase:           number
  tracks:          Track[]
  isGraded:        boolean
  hasLessonPage:   boolean
  lessonPublished: boolean
  scheduledDate:   string | null   // ISO
  scheduledTime:   string | null
  durationMinutes: number | null
  locationRoom:    string | null
  isConfirmed:     boolean
  instructorId:    string | null
  instructorName:  string | null
  academicWeekId:  string | null
}

export type WeekRow = {
  id:         string
  weekNumber: number
  label:      string
  theme:      string | null
  startDate:  string
  endDate:    string
  events:     ScheduledEventRow[]
}

export type CatalogEvent = {
  id:              string
  courseCode:      string
  title:           string
  deptCode:        string
  phase:           number
  tracks:          Track[]
  isGraded:        boolean
  defaultDuration: number | null   // minutes — pre-fills the scheduler
}

export type InstructorOption = { id: string; name: string }

// ── Load full schedule for a class ───────────────────────────────────────────

export async function getScheduleDataAction(classId?: string) {
  const user = await requireAuth()
  const canEdit = can(user.role, 'schedule:academic')

  const classes = await db.class.findMany({
    where:   { archivedAt: null },
    orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
    select:  { id: true, name: true, isActive: true, startDate: true, endDate: true },
  })

  // Both active classes appear on the calendar; the "panel class" (toggle)
  // dictates which class new events are scheduled into.
  const activeClasses = classes.filter(c => c.isActive)
  const selectedClass = classId
    ? classes.find(c => c.id === classId) ?? activeClasses[0] ?? classes[0]
    : activeClasses[0] ?? classes[0]

  if (!selectedClass) {
    return {
      classes: classes.map(c => ({ id: c.id, name: c.name, isActive: c.isActive })),
      activeClasses: [],
      selectedClassId: null, classStartDate: null, classEndDate: null,
      weeks: [], scheduled: [], unscheduledByClass: {}, instructors: [], canEdit, studentTrack: null,
    }
  }

  // Calendar shows the selected class + any other active class
  const calendarClassIds = [...new Set([selectedClass.id, ...activeClasses.map(c => c.id)])]
  const colorIdxByClass = new Map(calendarClassIds.map((id, i) => [id, i]))
  const classNameById = new Map(classes.map(c => [c.id, c.name]))

  // Student track filter — students only see events for their track
  let studentTrack: Track | null = null
  if (user.role === 'STUDENT') {
    const student = await db.student.findFirst({ where: { userId: user.id }, select: { track: true } })
    studentTrack = student?.track ?? null
  }

  const [weeks, schedules, catalog, instructors] = await Promise.all([
    db.academicWeek.findMany({
      where:   { classId: selectedClass.id },
      orderBy: { weekNumber: 'asc' },
    }),
    db.classSyllabusSchedule.findMany({
      where:   { classId: { in: calendarClassIds } },
      include: {
        syllabusEvent: {
          select: {
            id: true, courseCode: true, title: true, deptCode: true, phase: true,
            tracks: true, isGraded: true,
            lessonPage: { select: { id: true, isPublished: true } },
          },
        },
        instructor: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.syllabusEvent.findMany({
      where:   { isActive: true },
      orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }],
      select:  {
        id: true, courseCode: true, title: true, deptCode: true, phase: true,
        tracks: true, isGraded: true, defaultDurationMinutes: true,
      },
    }),
    db.user.findMany({
      where:   { isActive: true, role: { in: ['LINE_INSTRUCTOR', 'GUEST_INSTRUCTOR', 'DEPT_CHAIR', 'ADO', 'DO', 'SYSTEM_ADMIN'] } },
      orderBy: { lastName: 'asc' },
      select:  { id: true, firstName: true, lastName: true },
    }),
  ])

  // Session counts per (classId, eventId)
  const sessionCounts = new Map<string, number>()
  for (const s of schedules) {
    const key = `${s.classId}:${s.syllabusEventId}`
    sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1)
  }

  const toRow = (s: typeof schedules[number]): ScheduledEventRow => ({
    scheduleId:      s.id,
    syllabusEventId: s.syllabusEvent.id,
    classId:         s.classId,
    className:       classNameById.get(s.classId) ?? '',
    classColorIdx:   colorIdxByClass.get(s.classId) ?? 0,
    sessionNumber:   s.sessionNumber,
    sessionCount:    sessionCounts.get(`${s.classId}:${s.syllabusEventId}`) ?? 1,
    courseCode:      s.syllabusEvent.courseCode,
    title:           s.syllabusEvent.title,
    deptCode:        s.syllabusEvent.deptCode,
    phase:           s.syllabusEvent.phase,
    tracks:          s.syllabusEvent.tracks,
    isGraded:        s.syllabusEvent.isGraded,
    hasLessonPage:   !!s.syllabusEvent.lessonPage,
    lessonPublished: s.syllabusEvent.lessonPage?.isPublished ?? false,
    scheduledDate:   s.scheduledDate?.toISOString() ?? null,
    scheduledTime:   s.scheduledTime,
    durationMinutes: s.durationMinutes,
    locationRoom:    s.locationRoom,
    isConfirmed:     s.isConfirmed,
    instructorId:    s.instructor?.id ?? null,
    instructorName:  s.instructor ? `${s.instructor.firstName} ${s.instructor.lastName}`.trim() : null,
    academicWeekId:  s.academicWeekId,
  })

  // Filter for students: only their track's events
  const visibleSchedules = studentTrack
    ? schedules.filter(s => s.syllabusEvent.tracks.includes(studentTrack))
    : schedules

  const scheduled = visibleSchedules.map(toRow)

  const weekRows: WeekRow[] = weeks.map(w => ({
    id:         w.id,
    weekNumber: w.weekNumber,
    label:      w.label,
    theme:      w.theme,
    startDate:  w.startDate.toISOString(),
    endDate:    w.endDate.toISOString(),
    events: scheduled
      .filter(s => s.classId === selectedClass.id && s.academicWeekId === w.id)
      .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '') || (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '')),
  }))

  // Per active class: catalog events that still need scheduling
  const unscheduledByClass: Record<string, CatalogEvent[]> = {}
  for (const cid of calendarClassIds) {
    const scheduledIds = new Set(schedules.filter(s => s.classId === cid).map(s => s.syllabusEventId))
    unscheduledByClass[cid] = catalog
      .filter(e => !scheduledIds.has(e.id))
      .map(e => ({
        id:              e.id,
        courseCode:      e.courseCode,
        title:           e.title,
        deptCode:        e.deptCode,
        phase:           e.phase,
        tracks:          e.tracks,
        isGraded:        e.isGraded,
        defaultDuration: e.defaultDurationMinutes,
      }))
  }

  return {
    classes: classes.map(c => ({ id: c.id, name: c.name, isActive: c.isActive })),
    activeClasses: calendarClassIds.map(id => {
      const cls = classes.find(c => c.id === id)
      return {
        id,
        name:      classNameById.get(id) ?? '',
        colorIdx:  colorIdxByClass.get(id) ?? 0,
        startDate: cls?.startDate?.toISOString().slice(0, 10) ?? null,
      }
    }),
    selectedClassId: selectedClass.id,
    selectedClassName: selectedClass.name,
    classStartDate: selectedClass.startDate?.toISOString().slice(0, 10) ?? null,
    classEndDate:   selectedClass.endDate?.toISOString().slice(0, 10) ?? null,
    weeks: weekRows,
    scheduled,
    unscheduledByClass,
    instructors: instructors.map(i => ({ id: i.id, name: `${i.firstName} ${i.lastName}`.trim() })),
    canEdit,
    studentTrack,
  }
}

// ── Default course length (makes scheduling easy) ────────────────────────────

export async function setDefaultDurationAction(syllabusEventId: string, minutes: number | null) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  await db.syllabusEvent.update({
    where: { id: syllabusEventId },
    data:  { defaultDurationMinutes: minutes },
  })
  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

// ── Week CRUD ─────────────────────────────────────────────────────────────────

export async function createWeekAction(classId: string, data: {
  weekNumber: number
  label:      string
  theme:      string | null
  startDate:  string  // YYYY-MM-DD
  endDate:    string
}) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  const existing = await db.academicWeek.findUnique({
    where: { classId_weekNumber: { classId, weekNumber: data.weekNumber } },
  })
  if (existing) return { error: `Week ${data.weekNumber} already exists for this class.` }

  await db.academicWeek.create({
    data: {
      classId,
      weekNumber: data.weekNumber,
      label:      data.label,
      theme:      data.theme,
      startDate:  new Date(data.startDate),
      endDate:    new Date(data.endDate),
    },
  })

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

export async function updateWeekAction(weekId: string, data: {
  label:     string
  theme:     string | null
  startDate: string
  endDate:   string
}) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  await db.academicWeek.update({
    where: { id: weekId },
    data: {
      label:     data.label,
      theme:     data.theme,
      startDate: new Date(data.startDate),
      endDate:   new Date(data.endDate),
    },
  })

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

export async function deleteWeekAction(weekId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  // Events in this week become unassigned (FK is SetNull)
  await db.academicWeek.delete({ where: { id: weekId } })

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

// ── Auto-generate weeks from class start → grad date ─────────────────────────
// Weeks run Monday–Friday, numbered from 0.

function mondayOf(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date
}

export async function generateWeeksAction(classId: string, startDate: string, gradDate: string) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  const start = new Date(`${startDate}T00:00:00Z`)
  const grad  = new Date(`${gradDate}T00:00:00Z`)
  if (isNaN(start.getTime()) || isNaN(grad.getTime())) return { error: 'Invalid dates.' }
  if (grad <= start) return { error: 'Graduation date must be after the start date.' }

  const totalWeeks = Math.ceil((grad.getTime() - mondayOf(start).getTime()) / (7 * 86400_000))
  if (totalWeeks > 80) return { error: 'That range generates more than 80 weeks — check the dates.' }

  const existing = await db.academicWeek.findMany({
    where:  { classId },
    select: { weekNumber: true },
  })
  const existingNums = new Set(existing.map(w => w.weekNumber))

  const monday0 = mondayOf(start)
  const rows = []
  for (let n = 0; n <= totalWeeks; n++) {
    if (existingNums.has(n)) continue
    const monday = new Date(monday0)
    monday.setUTCDate(monday.getUTCDate() + n * 7)
    if (monday > grad) break
    const friday = new Date(monday)
    friday.setUTCDate(friday.getUTCDate() + 4)
    rows.push({
      classId,
      weekNumber: n,
      label:      `Week ${n}`,
      startDate:  monday,
      endDate:    friday,
    })
  }

  if (rows.length > 0) await db.academicWeek.createMany({ data: rows })

  // Persist class dates while we're at it
  await db.class.update({
    where: { id: classId },
    data:  { startDate: start, endDate: grad },
  })

  revalidatePath('/portal/academic-schedule')
  return { ok: true, created: rows.length }
}

// ── Schedule event CRUD (with overlap detection + override) ──────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export type ScheduleConflict = {
  courseCode: string
  title:      string
  time:       string
}

async function findConflicts(
  classId: string,
  excludeEventId: string,
  dateISO: string,
  time: string,
  durationMinutes: number,
): Promise<ScheduleConflict[]> {
  const dayStart = new Date(`${dateISO}T00:00:00Z`)
  const dayEnd   = new Date(`${dateISO}T23:59:59Z`)

  const sameDay = await db.classSyllabusSchedule.findMany({
    where: {
      classId,
      syllabusEventId: { not: excludeEventId },
      scheduledDate:   { gte: dayStart, lte: dayEnd },
      scheduledTime:   { not: null },
    },
    include: { syllabusEvent: { select: { courseCode: true, title: true } } },
  })

  const startA = toMinutes(time)
  const endA   = startA + durationMinutes

  const conflicts: ScheduleConflict[] = []
  for (const s of sameDay) {
    if (!s.scheduledTime) continue
    const startB = toMinutes(s.scheduledTime)
    const endB   = startB + (s.durationMinutes ?? 60)
    if (startA < endB && startB < endA) {
      conflicts.push({
        courseCode: s.syllabusEvent.courseCode,
        title:      s.syllabusEvent.title,
        time:       `${s.scheduledTime} (${s.durationMinutes ?? 60} min)`,
      })
    }
  }
  return conflicts
}

async function weekForDate(classId: string, dateISO: string): Promise<string | null> {
  const d = new Date(`${dateISO}T12:00:00Z`)
  const week = await db.academicWeek.findFirst({
    where:  { classId, startDate: { lte: d }, endDate: { gte: d } },
    select: { id: true },
  })
  return week?.id ?? null
}

export async function scheduleEventAction(classId: string, syllabusEventId: string, data: {
  academicWeekId:  string | null
  instructorId:    string | null
  scheduledDate:   string | null  // YYYY-MM-DD
  scheduledTime:   string | null  // HH:MM
  durationMinutes: number | null
  locationRoom:    string | null
  override?:       boolean        // schedule despite conflicts
}) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  // Overlap check — same class, same day, overlapping time window
  if (data.scheduledDate && data.scheduledTime && !data.override) {
    const conflicts = await findConflicts(
      classId, syllabusEventId,
      data.scheduledDate, data.scheduledTime,
      data.durationMinutes ?? 60,
    )
    if (conflicts.length > 0) {
      return { conflicts }
    }
  }

  // Auto-assign the week containing the scheduled date if not set
  let academicWeekId = data.academicWeekId
  if (!academicWeekId && data.scheduledDate) {
    academicWeekId = await weekForDate(classId, data.scheduledDate)
  }

  await db.classSyllabusSchedule.upsert({
    where:  { classId_syllabusEventId_sessionNumber: { classId, syllabusEventId, sessionNumber: 1 } },
    update: {
      academicWeekId,
      instructorId:    data.instructorId,
      scheduledDate:   data.scheduledDate ? new Date(data.scheduledDate) : null,
      scheduledTime:   data.scheduledTime,
      durationMinutes: data.durationMinutes,
      locationRoom:    data.locationRoom,
    },
    create: {
      classId,
      syllabusEventId,
      sessionNumber:   1,
      academicWeekId,
      instructorId:    data.instructorId,
      scheduledDate:   data.scheduledDate ? new Date(data.scheduledDate) : null,
      scheduledTime:   data.scheduledTime,
      durationMinutes: data.durationMinutes,
      locationRoom:    data.locationRoom,
    },
  })

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

// ── Multi-day sessions: replace all sessions of an event for a class ─────────

export async function saveEventSessionsAction(
  classId:         string,
  syllabusEventId: string,
  base: {
    instructorId: string | null
    locationRoom: string | null
  },
  sessions: { date: string; time: string; durationMinutes: number }[],
  override = false,
) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }
  if (sessions.length === 0) return { error: 'At least one session is required.' }

  // Conflict-check every session
  if (!override) {
    const allConflicts: ScheduleConflict[] = []
    for (const s of sessions) {
      const conflicts = await findConflicts(classId, syllabusEventId, s.date, s.time, s.durationMinutes)
      allConflicts.push(...conflicts)
    }
    if (allConflicts.length > 0) return { conflicts: allConflicts }
  }

  // Replace sessions
  await db.classSyllabusSchedule.deleteMany({ where: { classId, syllabusEventId } })
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    await db.classSyllabusSchedule.create({
      data: {
        classId,
        syllabusEventId,
        sessionNumber:   i + 1,
        academicWeekId:  await weekForDate(classId, s.date),
        instructorId:    base.instructorId,
        locationRoom:    base.locationRoom,
        scheduledDate:   new Date(s.date),
        scheduledTime:   s.time,
        durationMinutes: s.durationMinutes,
      },
    })
  }

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

// Remove ALL sessions of an event from a class schedule
export async function unscheduleAllSessionsAction(classId: string, syllabusEventId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  await db.classSyllabusSchedule.deleteMany({ where: { classId, syllabusEventId } })
  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

// Quick reschedule used by the visual calendar (drag/resize)
export async function moveScheduledEventAction(scheduleId: string, data: {
  scheduledDate:   string
  scheduledTime:   string
  durationMinutes: number
  override?:       boolean
}) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  const existing = await db.classSyllabusSchedule.findUnique({
    where:  { id: scheduleId },
    select: { classId: true, syllabusEventId: true },
  })
  if (!existing) return { error: 'Scheduled event not found.' }

  if (!data.override) {
    const conflicts = await findConflicts(
      existing.classId, existing.syllabusEventId,
      data.scheduledDate, data.scheduledTime, data.durationMinutes,
    )
    if (conflicts.length > 0) return { conflicts }
  }

  // Keep week assignment in sync with the new date
  const d = new Date(`${data.scheduledDate}T12:00:00Z`)
  const week = await db.academicWeek.findFirst({
    where:  { classId: existing.classId, startDate: { lte: d }, endDate: { gte: d } },
    select: { id: true },
  })

  await db.classSyllabusSchedule.update({
    where: { id: scheduleId },
    data: {
      scheduledDate:   new Date(data.scheduledDate),
      scheduledTime:   data.scheduledTime,
      durationMinutes: data.durationMinutes,
      academicWeekId:  week?.id ?? null,
    },
  })

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

export async function unscheduleEventAction(scheduleId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  await db.classSyllabusSchedule.delete({ where: { id: scheduleId } })

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}

export async function toggleConfirmAction(scheduleId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  const s = await db.classSyllabusSchedule.findUnique({ where: { id: scheduleId }, select: { isConfirmed: true } })
  if (!s) return { error: 'Not found' }

  await db.classSyllabusSchedule.update({
    where: { id: scheduleId },
    data:  { isConfirmed: !s.isConfirmed },
  })

  revalidatePath('/portal/academic-schedule')
  return { ok: true }
}
