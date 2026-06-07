'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import type { ChannelSummary, ChatAttachment } from './actions'
import {
  sendMessageAction, markChannelReadAction,
  createChannelAction, archiveChannelAction, getChatMemberOptionsAction,
} from './actions'
import type { UserRole } from '@prisma/client'

type RawMessage = {
  id:        string
  content:   string
  sentAt:    string
  editedAt?: string | null
  attachments?: ChatAttachment[] | null
  author: {
    id:        string
    firstName: string
    lastName:  string
    role:      UserRole
  }
}

// ── Attachment rendering ──────────────────────────────────────────────────────

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function AttachmentView({ attachments, onDark }: { attachments: ChatAttachment[]; onDark: boolean }) {
  return (
    <div className="space-y-1.5 mt-1">
      {attachments.map((a, i) =>
        a.mimeType.startsWith('image/') ? (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.name}
              className="max-w-full max-h-64 rounded-lg border border-black/10"
            />
          </a>
        ) : (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
              onDark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <span className="text-base">📎</span>
            <span className="truncate flex-1 font-medium">{a.name}</span>
            <span className={onDark ? 'text-white/50' : 'text-gray-400'}>{fmtBytes(a.sizeBytes)}</span>
          </a>
        ),
      )}
    </div>
  )
}

const ROLE_BADGE: Partial<Record<UserRole, string>> = {
  SYSTEM_ADMIN:    'bg-purple-100 text-purple-700',
  DEAN_COMMANDER:  'bg-tps-navy/10 text-tps-navy',
  A9_STANDARDS:    'bg-amber-100 text-amber-700',
  DEPT_CHAIR:      'bg-blue-100 text-blue-700',
  LINE_INSTRUCTOR: 'bg-gray-100 text-gray-600',
}

const ROLE_SHORT: Partial<Record<UserRole, string>> = {
  SYSTEM_ADMIN:    'SysAdmin',
  DEAN_COMMANDER:  'Dean',
  A9_STANDARDS:    'A9',
  DEPT_CHAIR:      'Chair',
  LINE_INSTRUCTOR: 'Instructor',
  STUDENT:         'Student',
}

const TYPE_ICON: Record<string, string> = {
  CLASS:      '🏫',
  TRACK:      '✈',
  DEPARTMENT: '🏢',
  GENERAL:    '💬',
  DIRECT:     '👤',
  COURSE:     '📖',
}

function MessageBubble({ msg, isOwn }: { msg: RawMessage; isOwn: boolean }) {
  const time    = new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const name    = `${msg.author.firstName} ${msg.author.lastName}`.trim()
  const badge   = ROLE_BADGE[msg.author.role]
  const roleStr = ROLE_SHORT[msg.author.role] ?? msg.author.role

  const atts = msg.attachments ?? []

  if (isOwn) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="max-w-[80%] bg-tps-navy text-white rounded-2xl rounded-br-sm px-3.5 py-2 shadow-sm">
          {msg.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
          )}
          {atts.length > 0 && <AttachmentView attachments={atts} onDark />}
        </div>
        <span className="text-[10px] text-gray-400 px-1">{time}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-xs font-semibold text-gray-700">{name}</span>
        {badge && (
          <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${badge}`}>
            {roleStr}
          </span>
        )}
      </div>
      <div className="max-w-[80%] bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3.5 py-2 shadow-sm">
        {msg.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-800">{msg.content}</p>
        )}
        {atts.length > 0 && <AttachmentView attachments={atts} onDark={false} />}
      </div>
      <span className="text-[10px] text-gray-400 px-1">{time}</span>
    </div>
  )
}

function MessageList({
  messages,
  currentUserId,
  bottomRef,
}: {
  messages: RawMessage[]
  currentUserId: string
  bottomRef: React.RefObject<HTMLDivElement | null>
}) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4">
        No messages yet. Be the first to say something.
      </div>
    )
  }

  // Group consecutive messages by author into blocks
  const blocks: { authorId: string; msgs: RawMessage[] }[] = []
  for (const m of messages) {
    const last = blocks[blocks.length - 1]
    if (last && last.authorId === m.author.id) {
      last.msgs.push(m)
    } else {
      blocks.push({ authorId: m.author.id, msgs: [m] })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {blocks.map((block, bi) => {
        const isOwn = block.authorId === currentUserId
        return (
          <div key={bi} className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
            {block.msgs.map((m) => (
              <MessageBubble key={m.id} msg={m} isOwn={isOwn} />
            ))}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (text: string, attachments: ChatAttachment[]) => void
  disabled: boolean
}) {
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if ((!trimmed && pendingFiles.length === 0) || disabled || uploading) return
    onSend(trimmed, pendingFiles)
    setText('')
    setPendingFiles([])
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        if (file.size > 25 * 1024 * 1024) {
          setUploadError(`${file.name} exceeds the 25 MB limit.`)
          continue
        }
        // Direct browser → Blob upload (no serverless body-size cap)
        const blob = await upload(file.name, file, {
          access:          'public',
          handleUploadUrl: '/api/blob-upload',
          clientPayload:   JSON.stringify({ purpose: 'chat' }),
        })
        setPendingFiles(prev => [...prev, {
          name:      file.name,
          url:       blob.url,
          mimeType:  blob.contentType ?? file.type ?? 'application/octet-stream',
          sizeBytes: file.size,
        }])
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Attachment upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 space-y-2">
      {/* Pending attachments */}
      {(pendingFiles.length > 0 || uploadError) && (
        <div className="flex flex-wrap gap-2 items-center">
          {pendingFiles.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 rounded-lg px-2.5 py-1.5">
              {f.mimeType.startsWith('image/') ? '🖼' : '📎'} {f.name}
              <button
                onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-500 leading-none"
              >×</button>
            </span>
          ))}
          {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attach */}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.ppt,.pptx,.xls,.xlsx,.doc,.docx,.txt,.csv,.zip,.mp4"
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-gray-300 text-gray-500 flex items-center justify-center
                     hover:border-tps-navy hover:text-tps-navy disabled:opacity-40 transition-colors"
          aria-label="Attach file"
          title="Attach image or file"
        >
          {uploading ? (
            <span className="text-xs">…</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
            </svg>
          )}
        </button>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-tps-navy/30 focus:border-tps-navy
                     disabled:bg-gray-50 disabled:text-gray-400
                     max-h-32 overflow-y-auto"
          style={{ minHeight: '44px' }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || uploading || (!text.trim() && pendingFiles.length === 0)}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-tps-navy text-white flex items-center justify-center
                     hover:bg-tps-navy/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── New channel modal ─────────────────────────────────────────────────────────

function NewChannelModal({ classId, onClose }: { classId: string; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate,   setIsPrivate]   = useState(false)
  const [scope,       setScope]       = useState<'class' | 'school'>('class')
  const [memberOptions, setMemberOptions] = useState<{ id: string; name: string; role: string }[] | null>(null)
  const [members,     setMembers]     = useState<Set<string>>(new Set())
  const [memberSearch, setMemberSearch] = useState('')

  useEffect(() => {
    if (isPrivate && !memberOptions) {
      getChatMemberOptionsAction().then(setMemberOptions)
    }
  }, [isPrivate, memberOptions])

  function toggleMember(id: string) {
    setMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function handleCreate() {
    setError(null)
    startTx(async () => {
      const result = await createChannelAction({
        classId:       scope === 'class' ? classId : null,
        name,
        description:   description || null,
        isPrivate,
        memberUserIds: [...members],
      })
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  const filteredOptions = (memberOptions ?? []).filter(m =>
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[85vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-tps-navy">New Channel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div>
          <label className="field-label">Channel Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="field-input"
            placeholder="e.g. flight-test-tips"
            disabled={pending}
            autoFocus
          />
        </div>

        <div>
          <label className="field-label">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="field-input" disabled={pending} />
        </div>

        <div className="flex gap-2">
          {(['class', 'school'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                scope === s ? 'border-tps-orange bg-tps-orange/5 text-tps-navy' : 'border-gray-200 text-gray-500'
              }`}
              disabled={pending}
            >
              {s === 'class' ? 'This class only' : 'School-wide'}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={e => setIsPrivate(e.target.checked)}
            className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
            disabled={pending}
          />
          <span className="text-sm text-gray-700">Private channel <span className="text-gray-400">(members only — admins always have access)</span></span>
        </label>

        {/* Member picker for private channels */}
        {isPrivate && (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <input
              type="search"
              placeholder="Search people…"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="field-input text-sm"
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {!memberOptions ? (
                <p className="text-xs text-gray-400 py-2">Loading…</p>
              ) : filteredOptions.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={members.has(m.id)}
                    onChange={() => toggleMember(m.id)}
                    className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
                  />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="text-[10px] text-gray-400">{m.role.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-gray-400">{members.size} member{members.size === 1 ? '' : 's'} selected (you are added automatically)</p>
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button onClick={handleCreate} disabled={pending || !name.trim()} className="btn-primary w-full text-sm py-2.5">
          {pending ? 'Creating…' : `Create ${isPrivate ? 'Private ' : ''}Channel`}
        </button>
      </div>
    </div>
  )
}

// ── Main Shell ────────────────────────────────────────────────────────────────

type Props = {
  channels:      ChannelSummary[]
  currentUserId: string
  className:     string
  classId:       string
}

const POLL_INTERVAL_MS = 3000

export function ChatShell({ channels, currentUserId, className, classId }: Props) {
  const router = useRouter()
  const [activeChannelId, setActiveChannelId] = useState<string>(channels[0]?.id ?? '')
  const [messages,        setMessages]         = useState<RawMessage[]>([])
  const [sidebarOpen,     setSidebarOpen]       = useState(false)
  const [sendPending,     startSend]            = useTransition()
  const [sendError,       setSendError]         = useState<string | null>(null)
  const [newChannelOpen,  setNewChannelOpen]    = useState(false)

  async function handleArchiveChannel(ch: ChannelSummary) {
    if (!confirm(`Archive ${ch.name}? Messages are preserved but the channel is hidden.`)) return
    const result = await archiveChannelAction(ch.id)
    if ('error' in result && result.error) { alert(result.error); return }
    router.refresh()
  }

  const bottomRef   = useRef<HTMLDivElement>(null)
  const latestSince = useRef<string | null>(null)
  const pollerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeChannel = channels.find(c => c.id === activeChannelId)

  // ── Initial load + polling ────────────────────────────────────────────────

  const fetchMessages = useCallback(async (channelId: string, since: string | null) => {
    try {
      const url = `/api/chat/messages?channelId=${channelId}${since ? `&since=${encodeURIComponent(since)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json() as { messages: RawMessage[] }
      if (data.messages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const newOnes = data.messages.filter(m => !existingIds.has(m.id))
          return since ? [...prev, ...newOnes] : data.messages
        })
        latestSince.current = data.messages[data.messages.length - 1].sentAt
      }
    } catch {
      // network error — poll will retry
    }
  }, [])

  // Switch channel: load fresh
  useEffect(() => {
    if (!activeChannelId) return

    setMessages([])
    latestSince.current = null

    // Viewing a channel clears its unread state
    markChannelReadAction(activeChannelId)

    // Load last ~50 messages (no `since` = full initial load)
    fetchMessages(activeChannelId, null)

    // Start polling
    if (pollerRef.current) clearInterval(pollerRef.current)
    pollerRef.current = setInterval(() => {
      fetchMessages(activeChannelId, latestSince.current)
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current)
    }
  }, [activeChannelId, fetchMessages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ──────────────────────────────────────────────────────────

  function handleSend(text: string, attachments: ChatAttachment[]) {
    setSendError(null)
    startSend(async () => {
      const result = await sendMessageAction(activeChannelId, text, attachments)
      if (!result.ok) {
        setSendError(result.error ?? 'Failed to send')
        return
      }
      // Immediately refetch (don't wait for next poll cycle)
      await fetchMessages(activeChannelId, latestSince.current)
    })
  }

  if (channels.length === 0) {
    return (
      <div className="card text-center py-16 text-gray-400">
        No channels found for this class. Channels are auto-provisioned when the class has students.
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-sm">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={`
        flex-shrink-0 w-64 bg-tps-navy text-white flex flex-col
        md:relative md:translate-x-0
        absolute inset-y-0 left-0 z-20 transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Digital Squadron</p>
          <p className="text-sm font-semibold">Class {className}</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className={`group flex items-start gap-2 transition-colors
                ${activeChannelId === ch.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
            >
              <button
                onClick={() => { setActiveChannelId(ch.id); setSidebarOpen(false) }}
                className="flex-1 min-w-0 text-left px-4 py-2.5 flex items-start gap-2"
              >
                <span className="text-sm mt-0.5 shrink-0">{ch.isPrivate ? '🔒' : (TYPE_ICON[ch.type] ?? '💬')}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{ch.name}</p>
                  {ch.lastMessage && (
                    <p className="text-[10px] text-white/50 truncate">
                      {ch.lastMessage.authorName}: {ch.lastMessage.content || '📎 attachment'}
                    </p>
                  )}
                </div>
              </button>
              {ch.canManage && (
                <button
                  onClick={() => handleArchiveChannel(ch)}
                  className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-300 text-xs px-2 py-3 shrink-0 transition-opacity"
                  title="Archive channel"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="px-3 py-2 border-t border-white/10 space-y-1.5">
          <button
            onClick={() => setNewChannelOpen(true)}
            className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            + New Channel
          </button>
          <p className="px-2 text-[10px] text-white/40">
            Track/class channels are auto-provisioned
          </p>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 bg-black/30 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Channel header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-gray-500 hover:text-tps-navy"
            aria-label="Toggle channels"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-tps-navy truncate">{activeChannel?.name ?? '—'}</p>
            {activeChannel?.description && (
              <p className="text-xs text-gray-400 truncate">{activeChannel.description}</p>
            )}
          </div>

          <span className="text-xs text-gray-400 hidden sm:block">
            {messages.length} messages
          </span>
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          bottomRef={bottomRef}
        />

        {/* Error toast */}
        {sendError && (
          <div className="mx-4 mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700 flex justify-between">
            {sendError}
            <button onClick={() => setSendError(null)} className="ml-2 text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {/* Input */}
        <MessageInput onSend={handleSend} disabled={sendPending} />
      </div>

      {newChannelOpen && <NewChannelModal classId={classId} onClose={() => setNewChannelOpen(false)} />}
    </div>
  )
}
