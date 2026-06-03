'use client'

import { useState } from 'react'
import Link from 'next/link'
import { adminCreateFormAction } from '../actions'

export default function NewSandboxFormPage() {
  const [title,   setTitle]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [created, setCreated] = useState<{ formId: string; pin: string } | null>(null)
  const [copied,  setCopied]  = useState(false)

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title required.'); return }
    setSaving(true)
    setError('')
    const res = await adminCreateFormAction(title)
    setSaving(false)
    if (res.formId && res.pin) {
      setCreated({ formId: res.formId, pin: res.pin })
    } else {
      setError(res.error ?? 'Error creating form.')
    }
  }

  if (created) {
    return (
      <div className="max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/sandbox" className="text-sm text-gray-400 hover:text-tps-orange">← The Sandbox</Link>
        </div>

        <div className="card border border-green-300 bg-green-50 space-y-2">
          <h2 className="font-bold text-green-800">Form created!</h2>
          <p className="text-sm text-green-700">
            The same PIN currently protects both the submission form and the results view.
            You can set different PINs in the form builder.
          </p>
        </div>

        <div className="card border border-amber-300 bg-amber-50 space-y-3">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
            ⚠️ Save this PIN — it won&apos;t be shown again
          </p>
          <div>
            <p className="text-xs text-gray-500 mb-1">
              PIN (currently used for both submission form and results view)
            </p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-bold text-gray-900 tracking-widest">
                {created.pin}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(created.pin); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="btn-secondary text-sm"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              ⚠ Same PIN for both — change them separately in the form builder if needed.
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link href={`/admin/sandbox/${created.formId}/builder`} className="btn-primary">
            Build Form Questions →
          </Link>
          <Link href={`/admin/sandbox/${created.formId}`} className="btn-secondary">
            View Form Detail
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/sandbox" className="text-sm text-gray-400 hover:text-tps-orange">← The Sandbox</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-tps-navy">Create Form (Admin)</h1>
      </div>

      <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800">
        Creates a form directly under your admin account. After creating, you&apos;ll be
        shown the auto-generated PIN and taken to the builder to add questions.
      </div>

      <div className="card space-y-4">
        <div>
          <label className="field-label">Form Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="e.g. Flight Eval Rubric 2026"
            className="field-input"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={handleCreate} disabled={saving || !title.trim()} className="btn-primary">
          {saving ? 'Creating…' : 'Create Form'}
        </button>
      </div>
    </div>
  )
}
