'use client'

import { useState } from 'react'
import Link from 'next/link'
import { revokeAndDeleteInviteAction, deleteSandboxFormAction, duplicateSandboxFormAction, resetSandboxPinAction, resetCreatorInvitePinAction } from './actions'
import { cn } from '@/lib/utils'

type Invite = {
  id:            string
  recipientName: string
  recipientEmail: string
  formSubject:   string
  linkToken:     string
  sentAt:        Date
  isActive:      boolean
  form: {
    id:          string
    title:       string
    submitSlug:  string
    resultsSlug: string
    isActive:    boolean
    createdAt:   Date
    _count: { submissions: number }
  } | null
}

type StandaloneForm = {
  id:          string
  title:       string
  submitSlug:  string
  resultsSlug: string
  isActive:    boolean
  createdAt:   Date
  _count:      { submissions: number }
}

interface Props {
  invites:         Invite[]
  standaloneForms: StandaloneForm[]
}

export function SandboxAdminPanel({ invites, standaloneForms }: Props) {
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [duplicating,  setDuplicating]  = useState<string | null>(null)
  const [dupResult,    setDupResult]    = useState<{ formId: string; pin: string } | null>(null)
  const [pinPanelId,   setPinPanelId]   = useState<string | null>(null)
  const [pinInput,     setPinInput]     = useState('')
  const [pinBusy,      setPinBusy]      = useState(false)
  const [pinResult,    setPinResult]    = useState<{ id: string; type: string; newPin: string } | null>(null)

  const handleResetPin = async (formId: string, type: 'submit' | 'results') => {
    setPinBusy(true)
    const res = await resetSandboxPinAction(formId, type, pinInput || undefined)
    setPinBusy(false)
    if ('success' in res && res.success) {
      setPinResult({ id: formId, type, newPin: res.newPin })
      setPinInput('')
    }
  }

  const handleResetCreatorPin = async (inviteId: string) => {
    setPinBusy(true)
    const res = await resetCreatorInvitePinAction(inviteId, pinInput || undefined)
    setPinBusy(false)
    if ('success' in res && res.success) {
      setPinResult({ id: inviteId, type: 'creator', newPin: res.newPin })
      setPinInput('')
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setDeletingId(inviteId)
    await revokeAndDeleteInviteAction(inviteId)
    setDeletingId(null)
    setConfirmId(null)
  }

  const handleDeleteForm = async (formId: string) => {
    setDeletingId(formId)
    await deleteSandboxFormAction(formId)
    setDeletingId(null)
    setConfirmId(null)
  }

  const handleDuplicate = async (formId: string, title: string) => {
    setDuplicating(formId)
    const res = await duplicateSandboxFormAction(formId, `${title} (copy)`)
    setDuplicating(null)
    if (res.formId && res.pin) setDupResult({ formId: res.formId, pin: res.pin })
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-8">
      {/* Creator Invites */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Creator Invites ({invites.length})
        </h2>

        {invites.length === 0 && (
          <div className="card border border-gray-200 text-center py-8 text-gray-400">
            <p>No creator invites yet.</p>
            <p className="text-sm mt-1">
              <Link href="/admin/sandbox/invite" className="text-tps-orange hover:underline">
                Send the first one →
              </Link>
            </p>
          </div>
        )}

        <div className="space-y-4">
          {invites.map((invite) => (
            <div key={invite.id} className="card border border-gray-200 space-y-3">
              {/* Invite header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-tps-navy">{invite.formSubject}</p>
                  <p className="text-sm text-gray-500">
                    {invite.recipientName} &lt;{invite.recipientEmail}&gt; · Sent {new Date(invite.sentAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {invite.form && (
                    <Link href={`/admin/sandbox/${invite.form.id}`} className="btn-secondary text-xs">
                      Manage Form
                    </Link>
                  )}
                  <button
                    onClick={() => { setPinPanelId(pinPanelId === invite.id ? null : invite.id); setPinResult(null); setPinInput('') }}
                    className="btn-secondary text-xs"
                  >
                    🔑 Reset PIN
                  </button>
                  <button
                    onClick={() => setConfirmId(invite.id)}
                    className="text-xs text-red-400 hover:text-red-600 min-h-[32px] px-2"
                  >
                    Revoke & Delete
                  </button>
                </div>
              </div>

              {/* Creator access info */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <p className="text-gray-500">Creator link:</p>
                <code className="text-gray-700 break-all">{baseUrl}/creator/{invite.linkToken}</code>
              </div>

              {/* Form status */}
              {invite.form ? (
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Form created: {invite.form.title}
                  </span>
                  <span>{invite.form._count.submissions} submission{invite.form._count.submissions !== 1 ? 's' : ''}</span>
                  <span>
                    Submit: <code className="text-gray-500">/sandbox/{invite.form.submitSlug}/submit</code>
                  </span>
                  <span>
                    Results: <code className="text-gray-500">/sandbox/{invite.form.resultsSlug}/results</code>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-amber-600">Awaiting creator — form not yet built</p>
              )}

              {/* PIN reset panel */}
              {pinPanelId === invite.id && (
                <InvitePinResetPanel
                  inviteId={invite.id}
                  formId={invite.form?.id ?? null}
                  pinBusy={pinBusy}
                  pinInput={pinInput}
                  setPinInput={setPinInput}
                  pinResult={pinResult}
                  onResetCreator={handleResetCreatorPin}
                  onResetForm={handleResetPin}
                  onClose={() => { setPinPanelId(null); setPinResult(null) }}
                />
              )}

              {/* Delete confirmation — two-step with download */}
              {confirmId === invite.id && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
                  <p className="text-sm font-semibold text-red-800">
                    Revoke this invite and delete the form + all {invite.form?._count.submissions ?? 0} submissions?
                  </p>
                  {invite.form && invite.form._count.submissions > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-red-700 font-medium">Download results before deleting:</p>
                      <a
                        href={`/api/sandbox/export/${invite.form.resultsSlug}`}
                        className="btn-secondary text-xs inline-flex"
                        target="_blank"
                      >
                        ↓ Download Results (Excel)
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmId(null)} className="btn-secondary text-xs">Cancel</button>
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      disabled={deletingId === invite.id}
                      className="btn-danger text-xs"
                    >
                      {deletingId === invite.id ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Admin-created forms */}
      {standaloneForms.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Admin-Created Forms ({standaloneForms.length})
          </h2>
          <div className="space-y-3">
            {standaloneForms.map((form) => (
              <div key={form.id} className="card border border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-tps-navy">{form.title}</p>
                  <p className="text-xs text-gray-500">
                    {form._count.submissions} submission{form._count.submissions !== 1 ? 's' : ''} ·
                    Created {new Date(form.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/admin/sandbox/${form.id}`} className="btn-secondary text-xs">Manage</Link>
                  <button
                    onClick={() => { setPinPanelId(pinPanelId === form.id ? null : form.id); setPinResult(null); setPinInput('') }}
                    className="btn-secondary text-xs"
                  >
                    🔑 Reset PIN
                  </button>
                  <button onClick={() => handleDuplicate(form.id, form.title)} disabled={duplicating === form.id}
                    className="btn-secondary text-xs">
                    {duplicating === form.id ? '…' : '⎘ Duplicate'}
                  </button>
                  <button onClick={() => setConfirmId(form.id)} className="text-xs text-red-400 hover:text-red-600 min-h-[32px] px-2">
                    Delete
                  </button>
                </div>
                {pinPanelId === form.id && (
                  <div className="w-full">
                    <PinResetPanel
                      formId={form.id}
                      pinBusy={pinBusy}
                      pinInput={pinInput}
                      setPinInput={setPinInput}
                      pinResult={pinResult}
                      onReset={handleResetPin}
                      onClose={() => { setPinPanelId(null); setPinResult(null) }}
                    />
                  </div>
                )}
                {confirmId === form.id && (
                  <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
                    <p className="text-sm font-semibold text-red-800">
                      Delete this form and all {form._count.submissions} submission{form._count.submissions !== 1 ? 's' : ''}?
                    </p>
                    {form._count.submissions > 0 && (
                      <div>
                        <p className="text-xs text-red-700 font-medium mb-1">Download results before deleting:</p>
                        <a href={`/api/sandbox/export/${(form as { resultsSlug?: string }).resultsSlug ?? ''}`}
                           className="btn-secondary text-xs inline-flex" target="_blank">
                          ↓ Download Results (Excel)
                        </a>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmId(null)} className="btn-secondary text-xs">Cancel</button>
                      <button onClick={() => handleDeleteForm(form.id)} disabled={deletingId === form.id} className="btn-danger text-xs">
                        {deletingId === form.id ? 'Deleting…' : 'Confirm Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Duplicate result */}
      {dupResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDupResult(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-tps-navy">Form Duplicated</h2>
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-amber-800">⚠️ Save this PIN — it won&apos;t be shown again</p>
              <p className="font-mono text-2xl font-bold tracking-widest">{dupResult.pin}</p>
              <p className="text-xs text-amber-700">Same PIN for both submission and results. Change in the builder.</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/sandbox/${dupResult.formId}/builder`} className="btn-primary text-sm flex-1" onClick={() => setDupResult(null)}>
                Build Questions →
              </Link>
              <button onClick={() => setDupResult(null)} className="btn-secondary text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline PIN reset panel ────────────────────────────────────────────────────

function PinResetPanel({
  formId, pinBusy, pinInput, setPinInput, pinResult, onReset, onClose,
}: {
  formId:      string
  pinBusy:     boolean
  pinInput:    string
  setPinInput: (v: string) => void
  pinResult:   { id: string; type: string; newPin: string } | null
  onReset:     (formId: string, type: 'submit' | 'results') => void
  onClose:     () => void
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">🔑 Reset Access PIN</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
      </div>
      <input
        value={pinInput}
        onChange={(e) => setPinInput(e.target.value)}
        placeholder="Leave blank to auto-generate"
        className="field-input text-sm font-mono tracking-widest w-full"
        maxLength={20}
      />
      <div className="flex gap-2">
        <button onClick={() => onReset(formId, 'submit')} disabled={pinBusy} className="btn-secondary text-xs flex-1">
          {pinBusy ? '…' : 'Reset Submit PIN'}
        </button>
        <button onClick={() => onReset(formId, 'results')} disabled={pinBusy} className="btn-secondary text-xs flex-1">
          {pinBusy ? '…' : 'Reset Results PIN'}
        </button>
      </div>
      {pinResult && pinResult.id === formId && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
            ⚠ New {pinResult.type} PIN — save this now
          </p>
          <p className="font-mono text-2xl font-bold tracking-widest text-tps-navy">{pinResult.newPin}</p>
        </div>
      )}
    </div>
  )
}

function InvitePinResetPanel({
  inviteId, formId, pinBusy, pinInput, setPinInput, pinResult, onResetCreator, onResetForm, onClose,
}: {
  inviteId:        string
  formId:          string | null
  pinBusy:         boolean
  pinInput:        string
  setPinInput:     (v: string) => void
  pinResult:       { id: string; type: string; newPin: string } | null
  onResetCreator:  (inviteId: string) => void
  onResetForm:     (formId: string, type: 'submit' | 'results') => void
  onClose:         () => void
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">🔑 Reset Access PIN</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
      </div>
      <input
        value={pinInput}
        onChange={(e) => setPinInput(e.target.value)}
        placeholder="Leave blank to auto-generate"
        className="field-input text-sm font-mono tracking-widest w-full"
        maxLength={20}
      />
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">Creator builder access</p>
        <button onClick={() => onResetCreator(inviteId)} disabled={pinBusy} className="btn-secondary text-xs w-full">
          {pinBusy ? '…' : 'Reset Creator Builder PIN'}
        </button>
      </div>
      {formId && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium">Survey access</p>
          <div className="flex gap-2">
            <button onClick={() => onResetForm(formId, 'submit')} disabled={pinBusy} className="btn-secondary text-xs flex-1">
              {pinBusy ? '…' : 'Reset Submit PIN'}
            </button>
            <button onClick={() => onResetForm(formId, 'results')} disabled={pinBusy} className="btn-secondary text-xs flex-1">
              {pinBusy ? '…' : 'Reset Results PIN'}
            </button>
          </div>
        </div>
      )}
      {pinResult && (pinResult.id === inviteId || pinResult.id === formId) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
            ⚠ New {pinResult.type} PIN — save this now
          </p>
          <p className="font-mono text-2xl font-bold tracking-widest text-tps-navy">{pinResult.newPin}</p>
        </div>
      )}
    </div>
  )
}
