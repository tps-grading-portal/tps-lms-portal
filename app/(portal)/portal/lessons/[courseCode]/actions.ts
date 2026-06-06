'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { canEditEventContent } from '@/lib/content-authority'
import { uploadFile, hashFile } from '@/lib/storage'
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
            include: { contentFile: { select: { id: true, title: true, storageUrl: true, mimeType: true, fileSizeBytes: true, status: true, fileName: true } } },
            orderBy: { sortOrder: 'asc' },
          },
          lessons: {
            include: {
              files: {
                include: { contentFile: { select: { id: true, title: true, storageUrl: true, mimeType: true, fileSizeBytes: true, status: true, fileName: true } } },
                orderBy: { sortOrder: 'asc' },
              },
            },
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
        include: { prerequisite: { select: { id: true, courseCode: true, title: true } } },
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

  // Scoped editing authority: dept chair of this dept, ADO/DO for AN/CF,
  // course owners, Dean, A9, Admin
  const canEditContent = can(user.role, 'author:lessons')
    ? await canEditEventContent(user.id, user.role, { id: event.id, deptCode: event.deptCode })
    : false

  return {
    event,
    studentContext,
    canAuthor: canEditContent,
    canUpload: can(user.role, 'submit:content'),
    isStudent: user.role === 'STUDENT',
    userId: user.id,
  }
}

// ── Lesson CRUD (multiple lessons per course) ─────────────────────────────────

async function requireContentAuthority(syllabusEventId: string) {
  const user = await requireAuth()
  const event = await db.syllabusEvent.findUnique({
    where:  { id: syllabusEventId },
    select: { id: true, deptCode: true, courseCode: true },
  })
  if (!event) return { error: 'Course not found.' as const }
  const allowed = await canEditEventContent(user.id, user.role, event)
  if (!allowed) return { error: 'You do not have content authority for this course.' as const }
  return { user, event }
}

/** Ensure a LessonPage exists for the event; returns its id. */
async function ensureLessonPage(syllabusEventId: string, authorId: string): Promise<string> {
  const existing = await db.lessonPage.findUnique({ where: { syllabusEventId }, select: { id: true } })
  if (existing) return existing.id
  const page = await db.lessonPage.create({
    data: { syllabusEventId, authorId },
    select: { id: true },
  })
  return page.id
}

export async function saveLessonAction(syllabusEventId: string, data: {
  lessonId: string | null   // null = create new
  title:    string
  overview: string
  outline:  string
  tlos:     string[]
  plos:     string[]
}) {
  const auth = await requireContentAuthority(syllabusEventId)
  if ('error' in auth) return { error: auth.error }
  if (!data.title.trim()) return { error: 'Lesson title is required.' }

  const lessonPageId = await ensureLessonPage(syllabusEventId, auth.user.id)

  if (data.lessonId) {
    await db.lesson.update({
      where: { id: data.lessonId },
      data: {
        title:    data.title.trim(),
        overview: data.overview || null,
        outline:  data.outline || null,
        tlos:     data.tlos.filter(Boolean),
        plos:     data.plos.filter(Boolean),
      },
    })
  } else {
    const max = await db.lesson.aggregate({ where: { lessonPageId }, _max: { sortOrder: true } })
    await db.lesson.create({
      data: {
        lessonPageId,
        title:     data.title.trim(),
        overview:  data.overview || null,
        outline:   data.outline || null,
        tlos:      data.tlos.filter(Boolean),
        plos:      data.plos.filter(Boolean),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    })
  }

  revalidatePath(`/portal/lessons/${auth.event.courseCode}`)
  return { ok: true }
}

export async function deleteLessonAction(syllabusEventId: string, lessonId: string) {
  const auth = await requireContentAuthority(syllabusEventId)
  if ('error' in auth) return { error: auth.error }

  await db.lesson.delete({ where: { id: lessonId } })
  revalidatePath(`/portal/lessons/${auth.event.courseCode}`)
  return { ok: true }
}

// ── Direct upload to a course/lesson (enters the A9 vault pipeline) ──────────
//
// Content uploaded here is SANDBOX until the Chair → A9 chain approves it.
// Staff see it on the page with a "Pending Approval" badge; students only
// see VAULT-approved files.

export async function uploadCourseContentAction(formData: FormData) {
  const user = await requireAuth()
  if (!can(user.role, 'submit:content')) return { error: 'Insufficient permissions to submit content.' }

  const syllabusEventId = formData.get('syllabusEventId')?.toString() ?? ''
  const lessonId        = formData.get('lessonId')?.toString() || null
  const title           = formData.get('title')?.toString().trim() ?? ''
  const file            = formData.get('file') as File | null

  const event = await db.syllabusEvent.findUnique({
    where:  { id: syllabusEventId },
    select: { id: true, courseCode: true, deptCode: true },
  })
  if (!event)                 return { error: 'Course not found.' }
  if (!file || file.size === 0) return { error: 'A file is required.' }
  if (file.size > 100 * 1024 * 1024) return { error: 'File exceeds 100 MB limit.' }

  const bytes    = Buffer.from(await file.arrayBuffer())
  const fileHash = hashFile(bytes)

  const duplicate = await db.contentFile.findFirst({
    where: { fileHash, status: { in: ['VAULT', 'PENDING_A9', 'PENDING_CHAIR', 'SANDBOX'] }, isLatest: true },
  })
  if (duplicate) return { error: 'An identical file has already been submitted.' }

  const uploaded = await uploadFile(file.name, file.type || 'application/octet-stream', bytes, 'vault')

  const content = await db.contentFile.create({
    data: {
      title:           title || file.name,
      syllabusEventId: event.id,
      uploadedById:    user.id,
      status:          'SANDBOX',
      storageProvider: (process.env.STORAGE_PROVIDER as 'VERCEL_BLOB' | 'AZURE_BLOB' | 'LOCAL') ?? 'VERCEL_BLOB',
      storageKey:      uploaded.storageKey,
      storageUrl:      uploaded.storageUrl,
      fileHash:        uploaded.fileHash,
      fileSizeBytes:   uploaded.fileSizeBytes,
      mimeType:        uploaded.mimeType,
      fileName:        uploaded.fileName,
      isLatest:        true,
      version:         1,
    },
  })

  await db.contentWorkflow.create({
    data: { contentFileId: content.id, submittedById: user.id, currentStatus: 'SANDBOX' },
  })

  // Attach to the course page (and lesson, if given) so it appears in place
  const lessonPageId = await ensureLessonPage(event.id, user.id)
  const maxOrder = await db.lessonPageFile.aggregate({
    where: { lessonPageId },
    _max:  { sortOrder: true },
  })
  await db.lessonPageFile.create({
    data: {
      lessonPageId,
      lessonId,
      contentFileId: content.id,
      sortOrder:     (maxOrder._max.sortOrder ?? 0) + 1,
    },
  })

  revalidatePath(`/portal/lessons/${event.courseCode}`)
  revalidatePath('/portal/vault')
  return { ok: true }
}

// ── Prerequisite editing (scoped to content authority) ───────────────────────

export async function addPrerequisiteAction(syllabusEventId: string, prerequisiteId: string, isHard: boolean) {
  const auth = await requireContentAuthority(syllabusEventId)
  if ('error' in auth) return { error: auth.error }
  if (syllabusEventId === prerequisiteId) return { error: 'An event cannot be its own prerequisite.' }

  await db.syllabusEventPrerequisite.upsert({
    where:  { eventId_prerequisiteId: { eventId: syllabusEventId, prerequisiteId } },
    update: { isHard },
    create: { eventId: syllabusEventId, prerequisiteId, isHard },
  })

  await db.auditLog.create({
    data: {
      userId:     auth.user.id,
      action:     'ADD_PREREQUISITE',
      targetId:   syllabusEventId,
      targetType: 'SyllabusEvent',
      metadata:   { prerequisiteId, isHard },
    },
  })

  revalidatePath(`/portal/lessons/${auth.event.courseCode}`)
  return { ok: true }
}

export async function removePrerequisiteAction(syllabusEventId: string, prerequisiteId: string) {
  const auth = await requireContentAuthority(syllabusEventId)
  if ('error' in auth) return { error: auth.error }

  await db.syllabusEventPrerequisite.deleteMany({
    where: { eventId: syllabusEventId, prerequisiteId },
  })

  await db.auditLog.create({
    data: {
      userId:     auth.user.id,
      action:     'REMOVE_PREREQUISITE',
      targetId:   syllabusEventId,
      targetType: 'SyllabusEvent',
      metadata:   { prerequisiteId },
    },
  })

  revalidatePath(`/portal/lessons/${auth.event.courseCode}`)
  return { ok: true }
}

export async function getCatalogForPrereqsAction() {
  await requireAuth()
  return db.syllabusEvent.findMany({
    where:   { isActive: true },
    orderBy: { courseCode: 'asc' },
    select:  { id: true, courseCode: true, title: true },
  })
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
