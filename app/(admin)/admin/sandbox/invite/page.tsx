'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createCreatorInviteAction } from '../actions'

export default function SendInvitePage() {
  const [result,    setResult]    = useState<{ linkToken?: string; pin?: string; error?: string } | null>(null)
  const [sending,   setSending]   = useState(false)
  const [copied,    setCopied]    = useState<'link' | 'pin' | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSending(true)
    const fd = new FormData(e.currentTarget)
    const res = await createCreatorInviteAction(fd)
    setResult('success' in res && res.success ? { linkToken: res.linkToken, pin: res.pin } : { error: 'error' in res ? res.error : 'Unknown error' })
    setSending(false)
  }

  const copy = (text: string, type: 'link' | 'pin') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type); setTimeout(() => setCopied(null), 2000)
    })
  }

  if (result?.linkToken) {
    const creatorUrl = `${baseUrl}/creator/${result.linkToken}`
    return (
      <div className="max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/sandbox" className="text-sm text-gray-400 hover:text-tps-orange">← The Sandbox</Link>
        </div>

        <div className="card border border-green-300 bg-green-50 space-y-4">
          <h2 className="font-bold text-green-800">Creator Invite Generated</h2>
          <div className="card border border-amber-300 bg-amber-50 space-y-3">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              ⚠️ Save these — they won&apos;t be shown again
            </p>
            <div>
              <p className="text-xs text-gray-500 mb-1">Creator URL</p>
              <div className="flex gap-2 items-center">
                <code className="text-xs bg-white border border-gray-200 rounded px-2 py-1.5 break-all flex-1">{creatorUrl}</code>
                <button onClick={() => copy(creatorUrl, 'link')} className="btn-secondary text-xs flex-shrink-0">
                  {copied === 'link' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Creator PIN</p>
              <div className="flex gap-2 items-center">
                <span className="font-mono text-xl font-bold tracking-widest">{result.pin}</span>
                <button onClick={() => copy(result.pin!, 'pin')} className="btn-secondary text-xs">
                  {copied === 'pin' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          <p className="text-sm text-green-700">
            Email the URL and PIN to the recipient. They use the URL to access the form builder and the PIN to authenticate.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Note: Automated email is not yet configured. Please share the URL and PIN manually.
          </p>
        </div>

        <Link href="/admin/sandbox" className="btn-secondary text-sm inline-flex">← Back to Sandbox</Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/sandbox" className="text-sm text-gray-400 hover:text-tps-orange">← The Sandbox</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-tps-navy">Send Creator Invite</h1>
      </div>

      <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800">
        Generates a unique link + PIN for someone to build one form in The Sandbox.
        The link and PIN are permanent until you revoke them. One invite = one form.
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="field-label">Recipient Name</label>
          <input name="recipientName" required placeholder="Maj. Smith" className="field-input" />
        </div>
        <div>
          <label className="field-label">Recipient Email</label>
          <input name="recipientEmail" type="email" required placeholder="smith@usaf.mil" className="field-input" />
        </div>
        <div>
          <label className="field-label">Form Subject / Label</label>
          <input name="formSubject" required placeholder="Mission Systems Feedback — Class 26A" className="field-input" />
          <p className="text-xs text-gray-400 mt-1">Your internal tracking label. The recipient sees this in their email.</p>
        </div>
        {result?.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{result.error}</div>
        )}
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? 'Generating…' : 'Generate Invite'}
        </button>
      </form>
    </div>
  )
}
