'use client'

import { useActionState, useState } from 'react'
import { updateCriterionAction } from './actions'

type Criterion = {
  id: string
  code: string
  pillar: string
  name: string
  weight: number
  outcomesRefs: string
  description: string
  waaDescriptor: string
  avgDescriptor: string
  failDescriptor: string
}

const PILLAR_COLORS: Record<string, string> = {
  TESTER:  'bg-blue-100 text-blue-800',
  LEADER:  'bg-green-100 text-green-800',
  THINKER: 'bg-purple-100 text-purple-800',
}

export function CriterionEditor({ criterion }: { criterion: Criterion }) {
  const [editing, setEditing] = useState(false)
  const [result, formAction, pending] = useActionState(updateCriterionAction, null)

  if (result?.success && editing) {
    setEditing(false)
  }

  return (
    <div className="card border border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-tps-blue">{criterion.code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${PILLAR_COLORS[criterion.pillar] ?? 'bg-gray-100 text-gray-700'}`}>
              {criterion.pillar}
            </span>
            <span className="text-xs text-gray-400">Outcomes: {criterion.outcomesRefs}</span>
          </div>
          <h3 className="font-semibold text-gray-900 mt-0.5">{criterion.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Weight: <strong>{(criterion.weight * 100).toFixed(1)}%</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="btn-secondary text-sm"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* View mode — show descriptors collapsed */}
      {!editing && (
        <div className="mt-3 text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
          <p className="italic">{criterion.description}</p>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <form action={formAction} className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <input type="hidden" name="id" value={criterion.id} />

          <div>
            <label className="field-label">Criterion Name</label>
            <input name="name" required defaultValue={criterion.name} className="field-input" />
          </div>

          <div>
            <label className="field-label">
              Weight (%){' '}
              <span className="text-gray-400 font-normal">enter as decimal, e.g. 0.15 for 15%</span>
            </label>
            <input
              name="weight"
              type="number"
              step="0.001"
              min="0.001"
              max="1"
              required
              defaultValue={criterion.weight}
              className="field-input font-mono"
            />
          </div>

          <div>
            <label className="field-label">Short Description (shown on grading form)</label>
            <textarea
              name="description"
              required
              rows={2}
              defaultValue={criterion.description}
              className="field-input resize-y"
            />
          </div>

          <div className="grid gap-4">
            <div>
              <label className="field-label text-emerald-700">Well Above Average (1) Descriptor</label>
              <textarea name="waaDescriptor" required rows={3} defaultValue={criterion.waaDescriptor} className="field-input resize-y text-sm" />
            </div>
            <div>
              <label className="field-label text-gray-600">Average (4) Descriptor</label>
              <textarea name="avgDescriptor" required rows={3} defaultValue={criterion.avgDescriptor} className="field-input resize-y text-sm" />
            </div>
            <div>
              <label className="field-label text-red-700">Fail (8) Descriptor</label>
              <textarea name="failDescriptor" required rows={3} defaultValue={criterion.failDescriptor} className="field-input resize-y text-sm" />
            </div>
          </div>

          {result?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {result.error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
