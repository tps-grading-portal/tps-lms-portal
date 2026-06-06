'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

type NotificationRow = {
  id:        string
  title:     string
  body:      string | null
  href:      string | null
  readAt:    string | null
  createdAt: string
}

const POLL_MS = 60_000

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [unread, setUnread] = useState(0)
  const [items,  setItems]  = useState<NotificationRow[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setUnread(data.unread)
      setItems(data.notifications)
    } catch { /* network hiccup — retry next poll */ }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-all-read' }),
    })
    load()
  }

  async function openItem(n: NotificationRow) {
    if (!n.readAt) {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-read', id: n.id }),
      })
    }
    setOpen(false)
    load()
    if (n.href) router.push(n.href)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-white/70 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-tps-orange text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
            <p className="text-sm font-bold text-tps-navy">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-tps-blue hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No notifications.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    !n.readAt ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && <span className="w-2 h-2 rounded-full bg-tps-orange shrink-0 mt-1.5" />}
                    <div className="min-w-0">
                      <p className={`text-sm leading-snug ${!n.readAt ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
