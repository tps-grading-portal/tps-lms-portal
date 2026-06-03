'use client'

import { useState } from 'react'
import Link from 'next/link'
import { revokeAndDeleteInviteAction, deleteSandboxFormAction } from './actions'
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
  _count: { submissions: number }
}

interface Props {
  invites:         Invite[]
  standaloneForms: StandaloneForm[]
}

export function SandboxAdminPanel({ invites, standaloneForms }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId,  setConfirmId]  = useState<string | null>(null)

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
                <div className="flex gap-2">
                  {invite.form && (
                    <Link href={`/admin/sandbox/${invite.form.id}`} className="btn-secondary text-xs">
                      Manage Form
                    </Link>
                  )}
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

              {/* Delete confirmation */}
              {confirmId === invite.id && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-red-800">
                    Revoke this invite and delete the form + all {invite.form?._count.submissions ?? 0} submissions?
                  </p>
                  {invite.form && invite.form._count.submissions > 0 && (
                    <p className="text-xs text-red-600">
                      ⚠ Download the results first from{' '}
                      <a href={`/sandbox/${invite.form.resultsSlug}/results`} target="_blank"
                         className="underline">the results page</a> if you need them.
                    </p>
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
                <div className="flex gap-2">
                  <Link href={`/admin/sandbox/${form.id}`} className="btn-secondary text-xs">Manage</Link>
                  <button
                    onClick={() => setConfirmId(form.id)}
                    className="text-xs text-red-400 hover:text-red-600 min-h-[32px] px-2"
                  >
                    Delete
                  </button>
                </div>
                {confirmId === form.id && (
                  <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-semibold text-red-800">
                      Delete this form and all {form._count.submissions} submission{form._count.submissions !== 1 ? 's' : ''}?
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmId(null)} className="btn-secondary text-xs">Cancel</button>
                      <button
                        onClick={() => handleDeleteForm(form.id)}
                        disabled={deletingId === form.id}
                        className="btn-danger text-xs"
                      >
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
    </div>
  )
}
