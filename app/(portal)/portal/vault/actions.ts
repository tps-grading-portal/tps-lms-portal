'use server'

import { db } from '@/lib/db'
import { requirePermission, requireAnyPermission } from '@/lib/server-auth'
import { uploadFile, hashFile } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ContentStatus } from '@prisma/client'

// ── Upload / Submit ─────────────────────────────────────────────────────────

const SubmitSchema = z.object({
  title:           z.string().min(1).max(200),
  description:     z.string().max(2000).optional(),
  syllabusEventId: z.string().optional(),
})

export async function submitContentAction(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const user = await requireAnyPermission(['submit:content'])

    const title           = formData.get('title')?.toString() ?? ''
    const description     = formData.get('description')?.toString()
    const syllabusEventId = formData.get('syllabusEventId')?.toString() || null
    const file            = formData.get('file') as File | null

    const parsed = SubmitSchema.parse({ title, description, syllabusEventId: syllabusEventId ?? undefined })

    if (!file || file.size === 0) return { ok: false, error: 'A file is required.' }
    if (file.size > 100 * 1024 * 1024) return { ok: false, error: 'File exceeds 100 MB limit.' }

    const bytes    = Buffer.from(await file.arrayBuffer())
    const fileHash = hashFile(bytes)

    const existing = await db.contentFile.findFirst({
      where: { fileHash, status: { in: ['VAULT', 'PENDING_A9', 'PENDING_CHAIR'] }, isLatest: true },
    })
    if (existing) {
      return { ok: false, error: 'An identical file is already in the content vault.' }
    }

    const uploaded = await uploadFile(file.name, file.type || 'application/octet-stream', bytes, 'vault')

    const content = await db.contentFile.create({
      data: {
        title:           parsed.title,
        description:     parsed.description,
        syllabusEventId: parsed.syllabusEventId ?? null,
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

    // Create workflow record (one per file, tracks full approval chain)
    await db.contentWorkflow.create({
      data: {
        contentFileId:  content.id,
        submittedById:  user.id,
        currentStatus:  'SANDBOX',
      },
    })

    revalidatePath('/portal/vault')
    return { ok: true, id: content.id }
  } catch (err) {
    console.error('submitContentAction:', err)
    return { ok: false, error: 'Upload failed. Please try again.' }
  }
}

// ── Workflow Transitions ────────────────────────────────────────────────────

export async function advanceContentAction(
  contentId: string,
  notes?:    string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireAnyPermission(['review:content', 'manage:content_vault'])

    const content = await db.contentFile.findUniqueOrThrow({
      where:   { id: contentId },
      include: { syllabusEvent: { select: { deptCode: true } } },
    })

    // Review chain: Department → A9 → Dean → visible to students
    const TRANSITIONS: Record<ContentStatus, ContentStatus | null> = {
      SANDBOX:        'PENDING_CHAIR',   // legacy drafts enter the chain
      PENDING_CHAIR:  'PENDING_A9',
      PENDING_A9:     'PENDING_DEAN',
      PENDING_DEAN:   'VAULT',
      VAULT:          null,
      ARCHIVED:       null,
    }

    const { role } = user
    const isAnCfContent = content.syllabusEvent?.deptCode === 'AN' || content.syllabusEvent?.deptCode === 'CF'
    const isAdmin = role === 'SYSTEM_ADMIN'
    const canAdvance =
      isAdmin ||
      // Department review step
      ((content.status === 'SANDBOX' || content.status === 'PENDING_CHAIR') &&
        (role === 'DEPT_CHAIR' || role === 'A9_STANDARDS' ||
         ((role === 'ADO' || role === 'DO') && isAnCfContent))) ||
      // A9 review step
      (content.status === 'PENDING_A9' && role === 'A9_STANDARDS') ||
      // Dean review step — final approval
      (content.status === 'PENDING_DEAN' && role === 'DEAN_COMMANDER')
    if (!canAdvance) return { ok: false, error: 'Insufficient permissions for this transition.' }

    const nextStatus = TRANSITIONS[content.status]
    if (!nextStatus) return { ok: false, error: `Content in ${content.status} cannot advance.` }

    const now = new Date()

    // Update file status
    await db.contentFile.update({ where: { id: contentId }, data: { status: nextStatus } })

    // Update workflow record with reviewer info
    const updateData: Record<string, unknown> = { currentStatus: nextStatus, updatedAt: now }
    if (nextStatus === 'PENDING_A9') {
      updateData.chairReviewedById = user.id
      updateData.chairReviewedAt   = now
      updateData.chairNotes        = notes ?? null
    }
    if (nextStatus === 'VAULT') {
      updateData.a9ReviewedById = user.id
      updateData.a9ReviewedAt   = now
      updateData.a9Notes        = notes ?? null
    }

    await db.contentWorkflow.update({
      where: { contentFileId: contentId },
      data:  updateData,
    })

    // Final approval → the source document is vaulted. Release is per class:
    // if the file is attached to exactly ONE class's course page, release it
    // there and notify that class. If it's linked to multiple classes (e.g.
    // after duplication), each class must be released individually from its
    // own course page — approval for one class never exposes another.
    if (nextStatus === 'VAULT' && content.syllabusEventId) {
      const event = await db.syllabusEvent.findUnique({
        where:  { id: content.syllabusEventId },
        select: { courseCode: true, title: true, tracks: true },
      })
      const links = await db.lessonPageFile.findMany({
        where:   { contentFileId: contentId, approvedForClassAt: null },
        include: { lessonPage: { select: { classId: true } } },
      })
      const classIds = [...new Set(links.map(l => l.lessonPage.classId).filter(Boolean))] as string[]

      if (event && classIds.length === 1) {
        await db.lessonPageFile.updateMany({
          where: { contentFileId: contentId, lessonPage: { classId: classIds[0] } },
          data:  { approvedForClassAt: now, approvedForClassById: user.id },
        })
        const students = await db.student.findMany({
          where: {
            userId:  { not: null },
            classId: classIds[0],
            track:   { in: event.tracks },
          },
          select: { userId: true },
        })
        if (students.length > 0) {
          await db.notification.createMany({
            data: students.map(s => ({
              userId: s.userId!,
              title:  `New content available for ${event.courseCode}`,
              body:   `"${content.title}" has been approved and is now available on the ${event.courseCode} — ${event.title} course page.`,
              href:   `/portal/lessons/${encodeURIComponent(event.courseCode)}`,
            })),
          })
        }
      }
      if (event) revalidatePath(`/portal/lessons/${event.courseCode}`)
    }

    revalidatePath('/portal/vault')
    return { ok: true }
  } catch (err) {
    console.error('advanceContentAction:', err)
    return { ok: false, error: 'Failed to update status.' }
  }
}

export async function archiveContentAction(
  contentId: string,
  notes?:    string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requirePermission('manage:content_vault')

    await db.contentFile.update({
      where: { id: contentId },
      data:  { status: 'ARCHIVED', archivedAt: new Date(), isLatest: false },
    })
    await db.contentWorkflow.update({
      where: { contentFileId: contentId },
      data:  { currentStatus: 'ARCHIVED', a9Notes: notes ?? `Archived by ${user.firstName} ${user.lastName}` },
    })

    revalidatePath('/portal/vault')
    return { ok: true }
  } catch (err) {
    console.error('archiveContentAction:', err)
    return { ok: false, error: 'Failed to archive.' }
  }
}

// ── Auto-publish check (3-class expiration clock) ──────────────────────────

export async function checkAutoPublishEligibility(contentId: string): Promise<boolean> {
  const content = await db.contentFile.findUnique({
    where:   { id: contentId },
    include: {
      verifications: {
        orderBy: { verifiedAt: 'desc' },
        take:    1,
      },
    },
  })
  if (!content) return false
  const latest = content.verifications[0]
  return latest?.status === 'VERIFIED_NO_CHANGES'
}

// ── Data fetching ───────────────────────────────────────────────────────────

export async function getVaultContents(filter?: { status?: ContentStatus }) {
  const user = await requireAnyPermission(['submit:content'])

  const where = {
    isLatest: true,
    status:   { not: 'ARCHIVED' as ContentStatus },
    ...(filter?.status ? { status: filter.status } : {}),
    // LINE_INSTRUCTOR only sees their own submissions
    ...(user.role === 'LINE_INSTRUCTOR' ? { uploadedById: user.id } : {}),
  }

  return db.contentFile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy:    { select: { firstName: true, lastName: true } },
      syllabusEvent: { select: { courseCode: true, title: true } },
      workflow:      { select: { currentStatus: true } },
    },
  })
}
