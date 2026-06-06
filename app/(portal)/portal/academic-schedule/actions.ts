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
  id:         string
  courseCode: string
  title:      string
  deptCode:   string
  phase:      number
  tracks:     Track[]
  isGraded:   boolean
}

export type InstructorOption = { id: string; name: string }

// ── Load full schedule for a class ───────────────────────────────────────────

export async function getScheduleDataAction(classId?: string) {
  const user = await requireAuth()
  const canEdit = can(user.role, 'schedule:academic')

  const classes = await db.class.findMany({
    where:   { archivedAt: null },
    orderBy: { name: 'desc' },
    select:  { id: true, name: true, isActive: true },
  })

  const selectedClass = classId
    ? classes.find(c => c.id === classId) ?? classes.find(c => c.isActive) ?? classes[0]
    : classes.find(c => c.isActive) ?? classes[0]

  if (!selectedClass) {
    return { classes, selectedClassId: null, weeks: [], unscheduled: [], catalog: [], instructors: [], canEdit, studentTrack: null }
  }

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
      where:   { classId: selectedClass.id },
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
      select:  { id: true, courseCode: true, title: true, deptCode: true, phase: true, tracks: true, isGraded: true },
    }),
    db.user.findMany({
      where:   { isActive: true, role: { in: ['LINE_INSTRUCTOR', 'DEPT_CHAIR', 'SYSTEM_ADMIN'] } },
      orderBy: { lastName: 'asc' },
      select:  { id: true, firstName: true, lastName: true },
    }),
  ])

  const toRow = (s: typeof schedules[number]): ScheduledEventRow => ({
    scheduleId:      s.id,
    syllabusEventId: s.syllabusEvent.id,
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

  const weekRows: WeekRow[] = weeks.map(w => ({
    id:         w.id,
    weekNumber: w.weekNumber,
    label:      w.label,
    theme:      w.theme,
    startDate:  w.startDate.toISOString(),
    endDate:    w.endDate.toISOString(),
    events: visibleSchedules
      .filter(s => s.academicWeekId === w.id)
      .map(toRow)
      .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '') || (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '')),
  }))

  const unscheduled = visibleSchedules.filter(s => !s.academicWeekId).map(toRow)

  // Catalog events not yet scheduled for this class (for the "add" picker)
  const scheduledEventIds = new Set(schedules.map(s => s.syllabusEventId))
  const availableCatalog: CatalogEvent[] = catalog.filter(e => !scheduledEventIds.has(e.id))

  return {
    classes,
    selectedClassId: selectedClass.id,
    selectedClassName: selectedClass.name,
    weeks: weekRows,
    unscheduled,
    catalog: availableCatalog,
    instructors: instructors.map(i => ({ id: i.id, name: `${i.firstName} ${i.lastName}`.trim() })),
    canEdit,
    studentTrack,
  }
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

// ── Schedule event CRUD ───────────────────────────────────────────────────────

export async function scheduleEventAction(classId: string, syllabusEventId: string, data: {
  academicWeekId:  string | null
  instructorId:    string | null
  scheduledDate:   string | null  // YYYY-MM-DD
  scheduledTime:   string | null  // HH:MM
  durationMinutes: number | null
  locationRoom:    string | null
}) {
  const user = await requireAuth()
  if (!can(user.role, 'schedule:academic')) return { error: 'Insufficient permissions' }

  await db.classSyllabusSchedule.upsert({
    where:  { classId_syllabusEventId: { classId, syllabusEventId } },
    update: {
      academicWeekId:  data.academicWeekId,
      instructorId:    data.instructorId,
      scheduledDate:   data.scheduledDate ? new Date(data.scheduledDate) : null,
      scheduledTime:   data.scheduledTime,
      durationMinutes: data.durationMinutes,
      locationRoom:    data.locationRoom,
    },
    create: {
      classId,
      syllabusEventId,
      academicWeekId:  data.academicWeekId,
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
