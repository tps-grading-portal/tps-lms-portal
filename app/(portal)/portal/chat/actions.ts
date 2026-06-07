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
  isPrivate:   boolean
  canManage:   boolean   // admin or channel creator
  lastMessage: { content: string; authorName: string; sentAt: Date } | null
}

export async function getChannelsAction(classId: string): Promise<ChannelSummary[]> {
  const user = await requireAuth()
  const isAdmin = user.role === 'SYSTEM_ADMIN'

  const channels = await db.chatChannel.findMany({
    // Class channels + school-wide custom channels (classId null)
    where:   { OR: [{ classId }, { classId: null }], isArchived: false },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: {
      messages: {
        where:   { isDeleted: false },
        orderBy: { sentAt: 'desc' },
        take:    1,
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      members: { select: { userId: true } },
    },
  })

  return channels
    // Private channels: members only — admins always see everything
    .filter(ch => !ch.isPrivate || isAdmin || ch.members.some(m => m.userId === user.id))
    .map((ch) => {
      const last = ch.messages[0]
      return {
        id:          ch.id,
        name:        ch.name,
        type:        ch.type,
        description: ch.description,
        trackFilter: ch.trackFilter,
        isPrivate:   ch.isPrivate,
        canManage:   isAdmin || ch.createdById === user.id,
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

// ── Custom channels (public or private) ───────────────────────────────────────

export async function createChannelAction(data: {
  classId:       string | null   // null = school-wide
  name:          string
  description:   string | null
  isPrivate:     boolean
  memberUserIds: string[]        // additional members for private channels
}) {
  const user = await requireAuth()

  let name = data.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!name) return { error: 'Channel name is required.' }
  if (!name.startsWith('#')) name = `#${name}`

  const existing = await db.chatChannel.findFirst({
    where: { name, classId: data.classId, isArchived: false },
  })
  if (existing) return { error: `Channel ${name} already exists.` }

  const channel = await db.chatChannel.create({
    data: {
      name,
      description: data.description,
      type:        'GENERAL',
      classId:     data.classId,
      isPrivate:   data.isPrivate,
      createdById: user.id,
    },
  })

  // Creator + selected members join (membership matters for private visibility)
  const memberIds = [...new Set([user.id, ...data.memberUserIds])]
  await db.chatChannelMember.createMany({
    data: memberIds.map(userId => ({ channelId: channel.id, userId })),
    skipDuplicates: true,
  })

  return { ok: true, channelId: channel.id }
}

export async function archiveChannelAction(channelId: string) {
  const user = await requireAuth()

  const channel = await db.chatChannel.findUnique({
    where:  { id: channelId },
    select: { createdById: true, isAutoProvisioned: true },
  })
  if (!channel) return { error: 'Channel not found.' }

  // Admin has full authority over all channels; creators manage their own
  const allowed = user.role === 'SYSTEM_ADMIN' || channel.createdById === user.id
  if (!allowed) return { error: 'Only the channel creator or a system admin can archive this channel.' }
  if (channel.isAutoProvisioned && user.role !== 'SYSTEM_ADMIN') {
    return { error: 'Auto-provisioned channels can only be archived by a system admin.' }
  }

  await db.chatChannel.update({ where: { id: channelId }, data: { isArchived: true } })
  return { ok: true }
}

export async function getChatMemberOptionsAction(): Promise<{ id: string; name: string; role: string }[]> {
  await requireAuth()
  const users = await db.user.findMany({
    where:   { isActive: true },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    select:  { id: true, firstName: true, lastName: true, role: true },
  })
  return users.map(u => ({ id: u.id, name: `${u.lastName}, ${u.firstName}`.trim(), role: u.role }))
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
  try {
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
  } catch (err) {
    console.error('uploadChatAttachmentAction:', err)
    return { ok: false, error: 'Attachment upload failed — file storage is unavailable.' }
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
