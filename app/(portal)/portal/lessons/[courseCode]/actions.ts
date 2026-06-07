'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import { can } from '@/lib/permissions'
import { canEditEventContent } from '@/lib/content-authority'
import { revalidatePath } from 'next/cache'

// ── Load lesson page data (per class — cohorts keep separate content) ────────

const PAGE_INCLUDE = {
  author: { select: { firstName: true, lastName: true } },
  files: {
    include: { contentFile: { select: { id: true, title: true, storageUrl: true, mimeType: true, fileSizeBytes: true, status: true, fileName: true } } },
    orderBy: { sortOrder: 'asc' as const },
  },
  lessons: {
    include: {
      files: {
        include: { contentFile: { select: { id: true, title: true, storageUrl: true, mimeType: true, fileSizeBytes: true, status: true, fileName: true } } },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
}

export async function getLessonPageAction(courseCode: string, classIdParam?: string) {
  const user = await requireAuth()

  const event = await db.syllabusEvent.findUnique({
    where:   { courseCode },
    include: {
      prerequisites: {
        include: { prerequisite: { select: { id: true, courseCode: true, title: true } } },
      },
      gradesheetTemplate: { select: { id: true, courseCode: true, title: true } },
    },
  })

  if (!event) return { event: null, studentContext: null }

  // Classes with course sites: active + active-for-planning
  const siteClasses = await db.class.findMany({
    where:   { archivedAt: null, OR: [{ isActive: true }, { isPlanning: true }] },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select:  { id: true, name: true, isActive: true, isPlanning: true },
  })

  // Resolve the viewing class: students always see THEIR class's page;
  // staff pick via tabs (default: first active class).
  let student: { id: string; classId: string } | null = null
  if (user.role === 'STUDENT') {
    student = await db.student.findFirst({
      where:  { userId: user.id },
      select: { id: true, classId: true },
    })
  }
  const viewClassId =
    student?.classId ??
    (classIdParam && siteClasses.some(c => c.id === classIdParam) ? classIdParam : siteClasses[0]?.id ?? null)

  // This class's page for this course
  const lessonPage = viewClassId
    ? await db.lessonPage.findUnique({
        where:   { syllabusEventId_classId: { syllabusEventId: event.id, classId: viewClassId } },
        include: PAGE_INCLUDE,
      })
    : null

  // This class's schedule for this course
  const schedules = viewClassId
    ? await db.classSyllabusSchedule.findMany({
        where:   { syllabusEventId: event.id, classId: viewClassId },
        include: {
          instructor:   { select: { firstName: true, lastName: true } },
          academicWeek: { select: { weekNumber: true, label: true } },
          class:        { select: { name: true } },
        },
        orderBy: { sessionNumber: 'asc' },
      })
    : []

  // Student context — their status for this event
  let studentContext: { status: string; score: number | null; completedAt: Date | null; viewedAt: Date | null } | null = null

  if (student) {
    const [studentEvent, view] = await Promise.all([
      db.studentSyllabusEvent.findUnique({
        where: { studentId_syllabusEventId: { studentId: student.id, syllabusEventId: event.id } },
      }),
      lessonPage
        ? db.studentLessonView.findUnique({
            where: { studentId_lessonPageId: { studentId: student.id, lessonPageId: lessonPage.id } },
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
    if (lessonPage) {
      await db.studentLessonView.upsert({
        where:  { studentId_lessonPageId: { studentId: student.id, lessonPageId: lessonPage.id } },
        update: { lastViewedAt: new Date() },
        create: { studentId: student.id, lessonPageId: lessonPage.id },
      })
    }
  }

  // Scoped editing authority: dept chair of this dept, ADO/DO for AN/CF,
  // course owners, Dean, A9, Admin
  const canEditContent = can(user.role, 'author:lessons')
    ? await canEditEventContent(user.id, user.role, { id: event.id, deptCode: event.deptCode })
    : false

  return {
    event,
    lessonPage,
    schedules,
    viewClassId,
    viewClassName: siteClasses.find(c => c.id === viewClassId)?.name ?? null,
    classOptions: user.role === 'STUDENT' ? [] : siteClasses,
    studentContext,
    canAuthor: canEditContent,
    canUpload: can(user.role, 'submit:content'),
    isStudent: user.role === 'STUDENT',
    userId: user.id,
  }
}

// ── Lesson CRUD (multiple lessons per course, per class) ─────────────────────

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

/** Ensure a LessonPage exists for the event+class; returns its id. */
async function ensureLessonPage(syllabusEventId: string, classId: string, authorId: string): Promise<string> {
  const existing = await db.lessonPage.findUnique({
    where:  { syllabusEventId_classId: { syllabusEventId, classId } },
    select: { id: true },
  })
  if (existing) return existing.id
  const page = await db.lessonPage.create({
    data: { syllabusEventId, classId, authorId },
    select: { id: true },
  })
  return page.id
}

export async function saveLessonAction(syllabusEventId: string, classId: string, data: {
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

  const lessonPageId = await ensureLessonPage(syllabusEventId, classId, auth.user.id)

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

// ── Client-upload registration (files go browser → Blob directly) ────────────
//
// Per workflow policy, uploads enter the approval chain immediately:
// Department review → A9 review → Dean review → visible to students.

export type UploadedBlobMeta = {
  url:         string
  pathname:    string
  contentType: string | null
  sizeBytes:   number
  fileName:    string
}

export async function registerCourseContentAction(data: {
  syllabusEventId: string
  classId:         string
  lessonId:        string | null
  title:           string
  blob:            UploadedBlobMeta
}) {
  try {
    const user = await requireAuth()
    if (!can(user.role, 'submit:content')) return { error: 'Insufficient permissions to submit content.' }

    const event = await db.syllabusEvent.findUnique({
      where:  { id: data.syllabusEventId },
      select: { id: true, courseCode: true, deptCode: true },
    })
    if (!event) return { error: 'Course not found.' }

    const content = await db.contentFile.create({
      data: {
        title:           data.title || data.blob.fileName,
        syllabusEventId: event.id,
        uploadedById:    user.id,
        status:          'PENDING_CHAIR', // auto-routed into the review chain
        storageProvider: 'VERCEL_BLOB',
        storageKey:      data.blob.pathname,
        storageUrl:      data.blob.url,
        fileSizeBytes:   data.blob.sizeBytes,
        mimeType:        data.blob.contentType,
        fileName:        data.blob.fileName,
        isLatest:        true,
        version:         1,
      },
    })

    await db.contentWorkflow.create({
      data: { contentFileId: content.id, submittedById: user.id, currentStatus: 'PENDING_CHAIR' },
    })

    // Attach to this class's course page (and lesson, if given)
    const lessonPageId = await ensureLessonPage(event.id, data.classId, user.id)
    const maxOrder = await db.lessonPageFile.aggregate({
      where: { lessonPageId },
      _max:  { sortOrder: true },
    })
    await db.lessonPageFile.create({
      data: {
        lessonPageId,
        lessonId:      data.lessonId,
        contentFileId: content.id,
        sortOrder:     (maxOrder._max.sortOrder ?? 0) + 1,
      },
    })

    revalidatePath(`/portal/lessons/${event.courseCode}`)
    revalidatePath('/portal/vault')
    return { ok: true }
  } catch (err) {
    console.error('registerCourseContentAction:', err)
    return { error: 'Failed to register the uploaded file.' }
  }
}

// ── Versioned replace (open → modify/sign → resave in place) ─────────────────

export async function replaceContentFileAction(contentFileId: string, blob: UploadedBlobMeta) {
  try {
    const user = await requireAuth()
    if (!can(user.role, 'submit:content')) return { error: 'Insufficient permissions.' }

    const old = await db.contentFile.findUnique({
      where:   { id: contentFileId },
      include: { syllabusEvent: { select: { courseCode: true } } },
    })
    if (!old) return { error: 'Original file not found.' }

    // New version enters review at the department step
    const next = await db.contentFile.create({
      data: {
        title:             old.title,
        description:       old.description,
        syllabusEventId:   old.syllabusEventId,
        uploadedById:      user.id,
        status:            'PENDING_CHAIR',
        storageProvider:   'VERCEL_BLOB',
        storageKey:        blob.pathname,
        storageUrl:        blob.url,
        fileSizeBytes:     blob.sizeBytes,
        mimeType:          blob.contentType,
        fileName:          blob.fileName,
        version:           old.version + 1,
        previousVersionId: old.id,
        isLatest:          true,
      },
    })
    await db.contentFile.update({ where: { id: old.id }, data: { isLatest: false } })

    await db.contentWorkflow.create({
      data: { contentFileId: next.id, submittedById: user.id, currentStatus: 'PENDING_CHAIR' },
    })

    // Keep it "in the same area": repoint course-page links to the new version
    await db.lessonPageFile.updateMany({
      where: { contentFileId: old.id },
      data:  { contentFileId: next.id },
    })

    await db.auditLog.create({
      data: {
        userId:     user.id,
        action:     'REPLACE_CONTENT_VERSION',
        targetId:   next.id,
        targetType: 'ContentFile',
        metadata:   { previousVersionId: old.id, version: next.version, title: old.title },
      },
    })

    if (old.syllabusEvent) revalidatePath(`/portal/lessons/${old.syllabusEvent.courseCode}`)
    revalidatePath('/portal/vault')
    return { ok: true }
  } catch (err) {
    console.error('replaceContentFileAction:', err)
    return { error: 'Failed to save the new version.' }
  }
}

// ── Direct approval — "ready to display to students" ─────────────────────────

const DIRECT_APPROVERS = ['A9_STANDARDS', 'DEAN_COMMANDER', 'SYSTEM_ADMIN']

export async function approveForStudentsAction(contentFileId: string) {
  const user = await requireAuth()
  if (!DIRECT_APPROVERS.includes(user.role)) {
    return { error: 'Only A9, the Dean, or an admin can approve content for student display directly.' }
  }

  const content = await db.contentFile.findUnique({
    where:   { id: contentFileId },
    include: { syllabusEvent: { select: { courseCode: true, title: true, tracks: true } } },
  })
  if (!content) return { error: 'File not found.' }
  if (content.status === 'VAULT') return { error: 'Already approved.' }

  await db.contentFile.update({ where: { id: contentFileId }, data: { status: 'VAULT' } })
  await db.contentWorkflow.updateMany({
    where: { contentFileId },
    data:  { currentStatus: 'VAULT', a9ReviewedById: user.id, a9ReviewedAt: new Date(), a9Notes: 'Direct approval for student display' },
  })

  await db.auditLog.create({
    data: {
      userId:     user.id,
      action:     'DIRECT_APPROVE_CONTENT',
      targetId:   contentFileId,
      targetType: 'ContentFile',
      metadata:   { title: content.title },
    },
  })

  // Notify the class's students
  if (content.syllabusEvent) {
    const students = await db.student.findMany({
      where: {
        userId: { not: null },
        track:  { in: content.syllabusEvent.tracks },
        class:  { isActive: true, archivedAt: null },
      },
      select: { userId: true },
    })
    if (students.length > 0) {
      await db.notification.createMany({
        data: students.map(s => ({
          userId: s.userId!,
          title:  `New content available for ${content.syllabusEvent!.courseCode}`,
          body:   `"${content.title}" is now available on the ${content.syllabusEvent!.courseCode} course page.`,
          href:   `/portal/lessons/${encodeURIComponent(content.syllabusEvent!.courseCode)}`,
        })),
      })
    }
    revalidatePath(`/portal/lessons/${content.syllabusEvent.courseCode}`)
  }

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
  classId: string,
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

  const existing = await db.lessonPage.findUnique({
    where: { syllabusEventId_classId: { syllabusEventId, classId } },
  })

  if (existing) {
    await db.lessonPage.update({
      where: { id: existing.id },
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
        classId,
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

// ── Duplicate course content to another class (course owners) ────────────────
//
// Copies this class's page — overview, objectives, outline, lessons,
// TLO/PLOs, and material links — to the target class as an editable
// template. Target must be active or active-for-planning.

export async function duplicateCourseContentAction(
  syllabusEventId: string,
  fromClassId:     string,
  toClassId:       string,
) {
  const auth = await requireContentAuthority(syllabusEventId)
  if ('error' in auth) return { error: auth.error }
  if (fromClassId === toClassId) return { error: 'Source and target class are the same.' }

  const target = await db.class.findUnique({
    where:  { id: toClassId },
    select: { id: true, name: true, isActive: true, isPlanning: true, archivedAt: true },
  })
  if (!target || target.archivedAt || (!target.isActive && !target.isPlanning)) {
    return { error: 'Target class must be Active or Active for Planning.' }
  }

  const source = await db.lessonPage.findUnique({
    where:   { syllabusEventId_classId: { syllabusEventId, classId: fromClassId } },
    include: {
      lessons: { include: { files: true }, orderBy: { sortOrder: 'asc' } },
      files:   { where: { lessonId: null } },
    },
  })
  if (!source) return { error: 'Nothing to duplicate — this class has no course page yet.' }

  const existing = await db.lessonPage.findUnique({
    where: { syllabusEventId_classId: { syllabusEventId, classId: toClassId } },
    select: { id: true },
  })
  if (existing) return { error: `Class ${target.name} already has a page for this course. Edit it directly instead.` }

  // Copy the page
  const newPage = await db.lessonPage.create({
    data: {
      syllabusEventId,
      classId:            toClassId,
      authorId:           auth.user.id,
      overview:           source.overview,
      learningObjectives: source.learningObjectives ?? undefined,
      outline:            source.outline,
      estimatedMinutes:   source.estimatedMinutes,
      isPublished:        false, // new class's page starts unpublished
    },
  })

  // Copy course-wide material links (same ContentFiles — re-upload to diverge)
  for (const f of source.files) {
    await db.lessonPageFile.create({
      data: {
        lessonPageId:  newPage.id,
        contentFileId: f.contentFileId,
        sortOrder:     f.sortOrder,
        displayLabel:  f.displayLabel,
      },
    })
  }

  // Copy lessons + their material links
  for (const lesson of source.lessons) {
    const newLesson = await db.lesson.create({
      data: {
        lessonPageId: newPage.id,
        title:        lesson.title,
        overview:     lesson.overview,
        outline:      lesson.outline,
        tlos:         lesson.tlos ?? undefined,
        plos:         lesson.plos ?? undefined,
        sortOrder:    lesson.sortOrder,
      },
    })
    for (const f of lesson.files) {
      await db.lessonPageFile.create({
        data: {
          lessonPageId:  newPage.id,
          lessonId:      newLesson.id,
          contentFileId: f.contentFileId,
          sortOrder:     f.sortOrder,
          displayLabel:  f.displayLabel,
        },
      })
    }
  }

  await db.auditLog.create({
    data: {
      userId:     auth.user.id,
      action:     'DUPLICATE_COURSE_CONTENT',
      targetType: 'LessonPage',
      targetId:   newPage.id,
      metadata:   { courseCode: auth.event.courseCode, fromClassId, toClassId, toClassName: target.name },
    },
  })

  revalidatePath(`/portal/lessons/${auth.event.courseCode}`)
  return { ok: true, className: target.name }
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
