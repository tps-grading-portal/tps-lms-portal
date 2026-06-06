'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

// ── Load lesson page data ─────────────────────────────────────────────────────

export async function getLessonPageAction(courseCode: string) {
  const user = await requireAuth()

  const event = await db.syllabusEvent.findUnique({
    where:   { courseCode },
    include: {
      lessonPage: {
        include: {
          author: { select: { firstName: true, lastName: true } },
          files: {
            include: { contentFile: { select: { id: true, title: true, storageUrl: true, mimeType: true, fileSizeBytes: true, status: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      schedules: {
        where: {
          class: { isActive: true },
        },
        include: {
          instructor: { select: { firstName: true, lastName: true } },
          academicWeek: { select: { weekNumber: true, label: true } },
          class: { select: { name: true } },
        },
        take: 1,
      },
      prerequisites: {
        include: { prerequisite: { select: { courseCode: true, title: true } } },
      },
      gradesheetTemplate: { select: { id: true, courseCode: true, title: true } },
    },
  })

  if (!event) return { event: null, studentContext: null }

  // Student context — their status for this event
  let studentContext: { status: string; score: number | null; completedAt: Date | null; viewedAt: Date | null } | null = null

  if (user.role === 'STUDENT') {
    const student = await db.student.findFirst({ where: { userId: user.id } })
    if (student) {
      const [studentEvent, view] = await Promise.all([
        db.studentSyllabusEvent.findUnique({
          where: { studentId_syllabusEventId: { studentId: student.id, syllabusEventId: event.id } },
        }),
        event.lessonPage
          ? db.studentLessonView.findUnique({
              where: { studentId_lessonPageId: { studentId: student.id, lessonPageId: event.lessonPage.id } },
            })
          : null,
      ])
      studentContext = {
        status:      studentEvent?.status ?? 'LOCKED',
        score:       studentEvent?.score ?? null,
        completedAt: studentEvent?.completedAt ?? null,
        viewedAt:    view?.lastViewedAt ?? null,
      }

      // Record view
      if (event.lessonPage) {
        await db.studentLessonView.upsert({
          where:  { studentId_lessonPageId: { studentId: student.id, lessonPageId: event.lessonPage.id } },
          update: { lastViewedAt: new Date() },
          create: { studentId: student.id, lessonPageId: event.lessonPage.id },
        })
      }
    }
  }

  return { event, studentContext, canAuthor: can(user.role, 'author:lessons'), userId: user.id }
}

// ── Save lesson page content ──────────────────────────────────────────────────

export async function saveLessonPageAction(
  syllabusEventId: string,
  data: {
    overview:           string
    learningObjectives: string[]
    outline:            string
    estimatedMinutes:   number | null
    isPublished:        boolean
  },
) {
  const user = await requireAuth()
  if (!can(user.role, 'author:lessons')) return { error: 'Insufficient permissions' }

  const existing = await db.lessonPage.findUnique({ where: { syllabusEventId } })

  if (existing) {
    await db.lessonPage.update({
      where: { syllabusEventId },
      data: {
        overview:           data.overview || null,
        learningObjectives: data.learningObjectives.filter(Boolean),
        outline:            data.outline || null,
        estimatedMinutes:   data.estimatedMinutes,
        isPublished:        data.isPublished,
        publishedAt:        data.isPublished && !existing.isPublished ? new Date() : existing.publishedAt,
      },
    })
  } else {
    await db.lessonPage.create({
      data: {
        syllabusEventId,
        authorId:           user.id,
        overview:           data.overview || null,
        learningObjectives: data.learningObjectives.filter(Boolean),
        outline:            data.outline || null,
        estimatedMinutes:   data.estimatedMinutes,
        isPublished:        data.isPublished,
        publishedAt:        data.isPublished ? new Date() : null,
      },
    })
  }

  const event = await db.syllabusEvent.findUnique({ where: { id: syllabusEventId }, select: { courseCode: true } })
  if (event) revalidatePath(`/portal/lessons/${event.courseCode}`)
  return { ok: true }
}

// ── Attach / detach vault file from lesson ────────────────────────────────────

export async function attachFilesToLessonAction(lessonPageId: string, contentFileIds: string[]) {
  const user = await requireAuth()
  if (!can(user.role, 'author:lessons')) return { error: 'Insufficient permissions' }

  for (const contentFileId of contentFileIds) {
    const maxOrder = await db.lessonPageFile.aggregate({
      where: { lessonPageId },
      _max:  { sortOrder: true },
    })
    await db.lessonPageFile.upsert({
      where:  { lessonPageId_contentFileId: { lessonPageId, contentFileId } },
      update: {},
      create: { lessonPageId, contentFileId, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
    })
  }

  revalidatePath('/portal/lessons')
  return { ok: true }
}

export async function detachFileFromLessonAction(lessonPageFileId: string) {
  const user = await requireAuth()
  if (!can(user.role, 'author:lessons')) return { error: 'Insufficient permissions' }
  await db.lessonPageFile.delete({ where: { id: lessonPageFileId } })
  return { ok: true }
}

// ── List vault files available to attach ─────────────────────────────────────

export async function getVaultFilesForAttachAction() {
  await requireAuth()
  return db.contentFile.findMany({
    where:   { status: 'VAULT', isLatest: true },
    select:  { id: true, title: true, mimeType: true, fileSizeBytes: true, syllabusEventId: true },
    orderBy: { title: 'asc' },
  })
}
