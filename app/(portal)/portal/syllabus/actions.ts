'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { getContentScope, scopeCoversEvent } from '@/lib/content-authority'
import { revalidatePath } from 'next/cache'
import type { SyllabusEventStatus, DepartmentCode, Track, EventSuffix } from '@prisma/client'

export type RoadmapEvent = {
  id: string
  courseCode: string
  title: string
  deptCode: DepartmentCode
  eventSuffix: string
  phase: number
  creditHours: number
  description: string | null
  isGraded: boolean
  tracks: Track[]
  status: SyllabusEventStatus | null  // null = no student context
  score: number | null
  completedAt: Date | null
  prerequisiteIds: string[]
}

export type RoadmapData = {
  events: RoadmapEvent[]
  studentId: string | null
  studentName: string | null
  // FTC (Pilot/CSO/RPA/FTE/ABM) or STC (Operator), derived from the
  // student's crew position — dictates which courses apply to them
  studentConcentration: 'FTC' | 'STC' | null
  // Course add/remove authority: 'all', or the list of dept codes the user controls
  editScope: { all: boolean; depts: DepartmentCode[] }
}

export async function getRoadmapData(): Promise<RoadmapData> {
  const user = await requireAuth()

  let studentId: string | null = null
  let studentName: string | null = null
  let studentTrack: Track | null = null

  if (user.role === 'STUDENT') {
    const student = await db.student.findFirst({
      where: { userId: user.id },
      select: { id: true, firstName: true, lastName: true, track: true },
    })
    if (student) {
      studentId = student.id
      studentName = `${student.firstName} ${student.lastName}`.trim() || `Student`
      studentTrack = student.track
    }
  }

  // Crew position → concentration designation
  const studentConcentration: 'FTC' | 'STC' | null =
    studentTrack === null ? null : studentTrack === 'OPERATOR' ? 'STC' : 'FTC'

  // Students see only the courses that apply to their track (per MCG);
  // staff see the full catalog.
  const raw = await db.syllabusEvent.findMany({
    where: {
      isActive: true,
      ...(studentTrack ? { tracks: { has: studentTrack } } : {}),
    },
    include: {
      prerequisites: { select: { prerequisiteId: true } },
      studentEvents: studentId
        ? { where: { studentId }, select: { status: true, score: true, completedAt: true } }
        : false,
    },
    orderBy: [{ phase: 'asc' }, { deptCode: 'asc' }, { sortOrder: 'asc' }],
  })

  const events: RoadmapEvent[] = raw.map((e) => {
    const se = (e.studentEvents as { status: SyllabusEventStatus; score: number | null; completedAt: Date | null }[] | undefined)?.[0] ?? null
    return {
      id:             e.id,
      courseCode:     e.courseCode,
      title:          e.title,
      deptCode:       e.deptCode,
      eventSuffix:    e.eventSuffix,
      phase:          e.phase,
      creditHours:    e.creditHours,
      description:    e.description,
      isGraded:       e.isGraded,
      tracks:         e.tracks,
      status:         se?.status ?? null,
      score:          se?.score ?? null,
      completedAt:    se?.completedAt ?? null,
      prerequisiteIds: e.prerequisites.map((p) => p.prerequisiteId),
    }
  })

  // Add/remove authority — scoped instructors in the proper academic phase
  let editScope: RoadmapData['editScope'] = { all: false, depts: [] }
  if (can(user.role, 'author:lessons')) {
    const scope = await getContentScope(user.id, user.role)
    editScope = { all: scope.all, depts: scope.depts }
  }

  return { events, studentId, studentName, studentConcentration, editScope }
}

// ── Add a course to the syllabus (scoped to dept authority) ───────────────────

export async function createSyllabusEventAction(data: {
  courseCode:  string
  title:       string
  deptCode:    DepartmentCode
  eventSuffix: EventSuffix
  phase:       number
  tracks:      Track[]
  description: string | null
}) {
  const user = await requireAuth()
  if (!can(user.role, 'author:lessons')) return { error: 'Insufficient permissions' }

  const scope = await getContentScope(user.id, user.role)
  if (!scope.all && !scope.depts.includes(data.deptCode)) {
    return { error: `You do not have authority over the ${data.deptCode} phase.` }
  }

  const courseCode = data.courseCode.trim().toUpperCase()
  if (!/^[A-Z]{2} \d{4}[A-Z]$/.test(courseCode)) {
    return { error: 'Course code must match the MCG format, e.g. "TF 6241F".' }
  }
  if (!data.title.trim())       return { error: 'Title is required.' }
  if (data.tracks.length === 0) return { error: 'Select at least one track.' }

  const existing = await db.syllabusEvent.findUnique({ where: { courseCode } })
  if (existing) {
    if (existing.isActive) return { error: `${courseCode} already exists on the syllabus.` }
    // Reactivate a previously removed course
    await db.syllabusEvent.update({
      where: { id: existing.id },
      data:  { isActive: true, title: data.title.trim(), tracks: data.tracks, description: data.description },
    })
  } else {
    const max = await db.syllabusEvent.aggregate({ _max: { sortOrder: true } })
    await db.syllabusEvent.create({
      data: {
        courseCode,
        title:       data.title.trim(),
        deptCode:    data.deptCode,
        eventSuffix: data.eventSuffix,
        phase:       data.phase,
        tracks:      data.tracks,
        description: data.description,
        isActive:    true,
        sortOrder:   (max._max.sortOrder ?? 0) + 1,
      },
    })
  }

  await db.auditLog.create({
    data: {
      userId:     user.id,
      action:     'ADD_SYLLABUS_COURSE',
      targetType: 'SyllabusEvent',
      metadata:   { courseCode, deptCode: data.deptCode },
    },
  })

  revalidatePath('/portal/syllabus')
  return { ok: true }
}

// ── Remove (deactivate) a course from the syllabus ────────────────────────────

export async function removeSyllabusEventAction(eventId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'author:lessons')) return { error: 'Insufficient permissions' }

  const event = await db.syllabusEvent.findUnique({
    where:  { id: eventId },
    select: { id: true, courseCode: true, deptCode: true, isGraded: true },
  })
  if (!event) return { error: 'Course not found.' }

  const scope = await getContentScope(user.id, user.role)
  if (!scopeCoversEvent(scope, event)) {
    return { error: `You do not have authority over the ${event.deptCode} phase.` }
  }
  if (event.isGraded) {
    return { error: 'This course is in the weighting matrix. Remove it from the weighting first.' }
  }

  await db.syllabusEvent.update({ where: { id: eventId }, data: { isActive: false } })

  await db.auditLog.create({
    data: {
      userId:     user.id,
      action:     'REMOVE_SYLLABUS_COURSE',
      targetId:   eventId,
      targetType: 'SyllabusEvent',
      metadata:   { courseCode: event.courseCode },
    },
  })

  revalidatePath('/portal/syllabus')
  return { ok: true }
}
