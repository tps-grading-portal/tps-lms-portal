'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import type { SyllabusEventStatus, DepartmentCode, Track } from '@prisma/client'

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
}

export async function getRoadmapData(): Promise<RoadmapData> {
  const user = await requireAuth()

  let studentId: string | null = null
  let studentName: string | null = null

  if (user.role === 'STUDENT') {
    const student = await db.student.findFirst({
      where: { userId: user.id },
      select: { id: true, firstName: true, lastName: true, track: true },
    })
    if (student) {
      studentId = student.id
      studentName = `${student.firstName} ${student.lastName}`.trim() || `Student`
    }
  }

  // Fetch all active syllabus events
  const raw = await db.syllabusEvent.findMany({
    where: { isActive: true },
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

  return { events, studentId, studentName }
}
