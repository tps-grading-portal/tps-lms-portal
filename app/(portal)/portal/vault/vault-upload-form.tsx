'use client'

import { useState, useRef } from 'react'
import { submitContentAction } from './actions'

type SyllabusEventOption = { id: string; courseCode: string; title: string }

export function VaultUploadForm({ events }: { events: SyllabusEventOption[] }) {
  const [open,    setOpen]    = useState(false)
  const [pending, setPending] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setSuccess(false)

    const fd = new FormData(e.currentTarget)
    const result = await submitContentAction(fd)
    setPending(false)

    if (result.ok) {
      setSuccess(true)
      formRef.current?.reset()
      setTimeout(() => { setOpen(false); setSuccess(false) }, 1500)
    } else {
      setError(result.error ?? 'Upload failed.')
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Submit Content
      </button>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-tps-navy text-base">Submit Course Content</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="field-label">Title *</label>
          <input name="title" required className="field-input" placeholder="e.g. PF 6121F Pre-Brief Slides" />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea
            name="description"
            rows={3}
            className="field-input resize-none"
            placeholder="Optional notes for the reviewer..."
          />
        </div>

        <div>
          <label className="field-label">Associated Event (optional)</label>
          <select name="syllabusEventId" className="field-select">
            <option value="">— None —</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>
                {e.courseCode} — {e.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">File * (max 100 MB)</label>
          <input
            type="file"
            name="file"
            required
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg
                       file:border-0 file:text-sm file:font-semibold file:bg-tps-orange/10
                       file:text-tps-orange hover:file:bg-tps-orange/20 cursor-pointer"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            Submitted for review.
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Uploading…' : 'Submit for Review'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
