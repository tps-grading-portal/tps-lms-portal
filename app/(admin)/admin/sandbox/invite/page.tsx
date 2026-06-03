'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createCreatorInviteAction } from '../actions'

interface InviteSuccess {
  linkToken:      string
  pin:            string
  recipientName:  string
  recipientEmail: string
  formSubject:    string
}

export default function SendInvitePage() {
  const [result,  setResult]  = useState<InviteSuccess | null>(null)
  const [error,   setError]   = useState('')
  const [sending, setSending] = useState(false)
  const [copied,  setCopied]  = useState<'link' | 'pin' | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSending(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await createCreatorInviteAction(fd)
    if ('success' in res && res.success) {
      setResult({
        linkToken:      res.linkToken,
        pin:            res.pin,
        recipientName:  fd.get('recipientName')?.toString() ?? '',
        recipientEmail: fd.get('recipientEmail')?.toString() ?? '',
        formSubject:    fd.get('formSubject')?.toString() ?? '',
      })
    } else {
      setError('error' in res ? res.error : 'Unknown error')
    }
    setSending(false)
  }

  const copy = (text: string, type: 'link' | 'pin') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type); setTimeout(() => setCopied(null), 2000)
    })
  }

  const printSheet = (creatorUrl: string) => {
    if (!result) return
    const issued = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const win = window.open('', '_blank', 'width=700,height=900')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>TPS Sandbox Invite — ${result.recipientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1B2A4A; background: #fff; padding: 48px; }
    .header { border-bottom: 3px solid #F26522; padding-bottom: 16px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #6B7280; }
    .header-org { font-size: 18px; font-weight: 700; color: #1B2A4A; margin-top: 4px; }
    .header-date { font-size: 11px; color: #6B7280; text-align: right; }
    h1 { font-size: 22px; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #6B7280; margin-bottom: 32px; }
    .section { background: #FFF7ED; border: 2px solid #F26522; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    .section-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #F26522; margin-bottom: 16px; }
    .field { margin-bottom: 16px; }
    .field:last-child { margin-bottom: 0; }
    .field-name { font-size: 11px; color: #6B7280; margin-bottom: 4px; }
    .field-value { font-size: 14px; font-weight: 600; color: #1B2A4A; word-break: break-all; }
    .pin { font-family: monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1B2A4A; }
    .instructions { border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .instructions h2 { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
    .instructions ol { padding-left: 18px; }
    .instructions li { font-size: 13px; color: #374151; line-height: 1.8; }
    .footer { font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 16px; }
    .warning { background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #92400E; }
    @media print { body { padding: 32px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">USAF Test Pilot School</div>
      <div class="header-org">TPS Test Foundations — Sandbox Invite</div>
    </div>
    <div class="header-date">Issued: ${issued}</div>
  </div>

  <h1>Form Builder Access</h1>
  <p class="subtitle">For: <strong>${result.recipientName}</strong> &lt;${result.recipientEmail}&gt;</p>

  <div class="warning">
    ⚠ Keep this document confidential. The PIN below grants access to build and manage a survey form.
  </div>

  <div class="section">
    <div class="section-label">Access Details — Save These</div>
    <div class="field">
      <div class="field-name">Form Subject</div>
      <div class="field-value">${result.formSubject}</div>
    </div>
    <div class="field">
      <div class="field-name">Your Builder URL</div>
      <div class="field-value">${creatorUrl}</div>
    </div>
    <div class="field">
      <div class="field-name">Your PIN</div>
      <div class="pin">${result.pin}</div>
    </div>
  </div>

  <div class="instructions">
    <h2>How to get started</h2>
    <ol>
      <li>Open the Builder URL above in your web browser</li>
      <li>Enter your PIN when prompted</li>
      <li>Build your form questions using the builder interface</li>
      <li>Return any time using the same URL and PIN</li>
    </ol>
  </div>

  <div class="footer">
    TPS Test Foundations · USAF Test Pilot School · Invite issued ${issued} · This link and PIN are permanent until revoked by an administrator.
  </div>

  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`)
    win.document.close()
  }

  if (result) {
    const creatorUrl = `${baseUrl}/creator/${result.linkToken}`
    return (
      <div className="max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/sandbox" className="text-sm text-gray-400 hover:text-tps-orange">← The Sandbox</Link>
        </div>

        <div className="card border border-green-300 bg-green-50 space-y-4">
          <h2 className="font-bold text-green-800">Invite Generated for {result.recipientName}</h2>

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
                <button onClick={() => copy(result.pin, 'pin')} className="btn-secondary text-xs">
                  {copied === 'pin' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => printSheet(creatorUrl)}
            className="btn-primary w-full"
          >
            ↓ Download Invite Sheet (PDF)
          </button>
          <p className="text-xs text-gray-500 text-center">
            Opens a print dialog — choose &quot;Save as PDF&quot; to download, then attach to your email.
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
          <p className="text-xs text-gray-400 mt-1">Your internal tracking label for this invite.</p>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? 'Generating…' : 'Generate Invite'}
        </button>
      </form>
    </div>
  )
}
