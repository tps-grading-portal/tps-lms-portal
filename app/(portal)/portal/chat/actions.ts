'use server'

import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server-auth'
import type { Track, ChatChannelType } from '@prisma/client'

// ── Slug helpers ──────────────────────────────────────────────────────────────

const TRACK_SLUGS: Record<Track, string> = {
  PILOT:    'pilot-track',
  RPA:      'rpa-track',
  FTE:      'fte-track',
  OPERATOR: 'stc-track',
  CSO_WSO:  'cso-wso-track',
  ABM:      'abm-track',
}

// ── Provision channels for a class (idempotent) ───────────────────────────────

export async function provisionChannelsAction(classId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAuth()

  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      students:     { select: { track: true }, distinct: ['track'] },
      chatChannels: { select: { name: true } },
    },
  })
  if (!cls) return { ok: false, error: 'Class not found' }

  const existingNames = new Set(cls.chatChannels.map((c) => c.name))
  const uniqueTracks  = [...new Set(cls.students.map((s) => s.track))]

  // 1. CLASS-level general channel
  const generalName = `#${cls.name.toLowerCase()}-general`
  if (!existingNames.has(generalName)) {
    await db.chatChannel.create({
      data: {
        name: generalName,
        type: 'CLASS' as ChatChannelType,
        classId,
        description: `General channel for Class ${cls.name}`,
        isAutoProvisioned: true,
      },
    })
    existingNames.add(generalName)
  }

  // 2. TRACK channels
  for (const track of uniqueTracks) {
    const name = `#${TRACK_SLUGS[track]}`
    if (!existingNames.has(name)) {
      await db.chatChannel.create({
        data: {
          name,
          type: 'TRACK' as ChatChannelType,
          classId,
          trackFilter: track,
          description: `Channel for ${track} track students`,
          isAutoProvisioned: true,
        },
      })
      existingNames.add(name)
    }
  }

  return { ok: true }
}

// ── Fetch channels for a class ────────────────────────────────────────────────

export type ChannelSummary = {
  id:          string
  name:        string
  type:        ChatChannelType
  description: string | null
  trackFilter: Track | null
  lastMessage: { content: string; authorName: string; sentAt: Date } | null
}

export async function getChannelsAction(classId: string): Promise<ChannelSummary[]> {
  await requireAuth()

  const channels = await db.chatChannel.findMany({
    where:   { classId, isArchived: false },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: {
      messages: {
        where:   { isDeleted: false },
        orderBy: { sentAt: 'desc' },
        take:    1,
        include: { author: { select: { firstName: true, lastName: true } } },
      },
    },
  })

  return channels.map((ch) => {
    const last = ch.messages[0]
    return {
      id:          ch.id,
      name:        ch.name,
      type:        ch.type,
      description: ch.description,
      trackFilter: ch.trackFilter,
      lastMessage: last
        ? {
            content:    last.content,
            authorName: `${last.author.firstName} ${last.author.lastName}`.trim(),
            sentAt:     last.sentAt,
          }
        : null,
    }
  })
}

// ── Send a message ────────────────────────────────────────────────────────────

export type ChatAttachment = {
  name:      string
  url:       string
  mimeType:  string
  sizeBytes: number
}

export async function sendMessageAction(
  channelId: string,
  content:   string,
  attachments?: ChatAttachment[],
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth()

  const trimmed = content.trim()
  const hasAttachments = !!attachments && attachments.length > 0
  if (!trimmed && !hasAttachments) return { ok: false, error: 'Message cannot be empty' }
  if (trimmed.length > 4000)       return { ok: false, error: 'Message too long (max 4000 chars)' }

  const channel = await db.chatChannel.findUnique({ where: { id: channelId } })
  if (!channel || channel.isArchived) return { ok: false, error: 'Channel not found' }

  await db.chatMessage.create({
    data: {
      channelId,
      authorId:    user.id,
      content:     trimmed,
      attachments: hasAttachments ? attachments : undefined,
    },
  })

  // Update last-read for sender
  await db.chatChannelMember.upsert({
    where:  { channelId_userId: { channelId, userId: user.id } },
    create: { channelId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  })

  return { ok: true }
}

// ── Upload a chat attachment (image or document) ─────────────────────────────

export async function uploadChatAttachmentAction(formData: FormData): Promise<
  { ok: true; attachment: ChatAttachment } | { ok: false; error: string }
> {
  await requireAuth()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0)      return { ok: false, error: 'No file provided.' }
  if (file.size > 25 * 1024 * 1024)  return { ok: false, error: 'Attachment exceeds 25 MB limit.' }

  const { uploadFile } = await import('@/lib/storage')
  const bytes = Buffer.from(await file.arrayBuffer())
  const uploaded = await uploadFile(file.name, file.type || 'application/octet-stream', bytes, 'chat')

  if (!uploaded.storageUrl) return { ok: false, error: 'Upload failed — no URL returned.' }

  return {
    ok: true,
    attachment: {
      name:      file.name,
      url:       uploaded.storageUrl,
      mimeType:  file.type || 'application/octet-stream',
      sizeBytes: file.size,
    },
  }
}

// ── Fetch active class for current user ───────────────────────────────────────

export async function getActiveClassAction(): Promise<{ id: string; name: string } | null> {
  await requireAuth()

  const cls = await db.class.findFirst({
    where:   { isActive: true },
    select:  { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })

  return cls
}
