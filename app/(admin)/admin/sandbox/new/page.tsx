'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminCreateFormAction } from '../actions'

export default function NewSandboxFormPage() {
  const [title,   setTitle]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const router = useRouter()

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title required.'); return }
    setSaving(true)
    const res = await adminCreateFormAction(title)
    if (res.formId) {
      router.push(`/admin/sandbox/${res.formId}`)
    } else {
      setError(res.error ?? 'Error creating form.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/sandbox" className="text-sm text-gray-400 hover:text-tps-orange">← The Sandbox</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-tps-navy">Create Form (Admin)</h1>
      </div>

      <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800">
        Creates a form directly under your admin account without a creator invite.
        You will build the form from the form detail page.
        Default PINs are auto-generated — change them on the detail page.
      </div>

      <div className="card space-y-4">
        <div>
          <label className="field-label">Form Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flight Eval Rubric 2026" className="field-input" autoFocus />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={handleCreate} disabled={saving || !title.trim()} className="btn-primary">
          {saving ? 'Creating…' : 'Create Form'}
        </button>
      </div>
    </div>
  )
}
