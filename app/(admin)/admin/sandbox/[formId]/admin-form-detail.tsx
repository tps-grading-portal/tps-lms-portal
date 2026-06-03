'use client'

import { useState } from 'react'
import { resetSandboxPinAction, adminGrantAccessAction, adminRevokeAccessAction } from '../actions'
import { cn } from '@/lib/utils'

interface Props {
  form: {
    id:             string
    title:          string
    description:    string | null
    mode:           string
    scoringEnabled: boolean
    samePinWarning: boolean
    isActive:       boolean
    createdAt:      Date
    _count:         { submissions: number }
    questions: { id: string; label: string; questionType: string; weight: number | null }[]
    invite: { recipientName: string; recipientEmail: string; formSubject: string } | null
  }
  submitUrl:          string
  resultsUrl:         string
  allForms:           { id: string; title: string }[]
  grantedToFormIds:   string[]   // forms that can read THIS form's results
}

export function AdminFormDetail({ form, submitUrl, resultsUrl, allForms, grantedToFormIds }: Props) {
  const [pinResult, setPinResult] = useState<{ type: string; newPin: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [newPinInput, setNewPinInput] = useState('')
  const [expandPin, setExpandPin]    = useState<'submit' | 'results' | null>(null)
  const [accessList, setAccessList]  = useState<string[]>(grantedToFormIds)
  const [accessBusy, setAccessBusy]  = useState(false)
  const [accessError, setAccessError] = useState('')

  const handlePinReset = async (type: 'submit' | 'results') => {
    setResetting(true)
    const res = await resetSandboxPinAction(form.id, type, newPinInput || undefined)
    if ('success' in res && res.success) {
      setPinResult({ type, newPin: res.newPin })
      setExpandPin(null)
      setNewPinInput('')
    }
    setResetting(false)
  }

  const copy = (text: string) => navigator.clipboard.writeText(text)

  const printDistributionSheet = async () => {
    // Fetch QR SVGs as data URLs so they embed correctly in the print window
    const toDataUrl = async (url: string) => {
      const res  = await fetch(`/api/qr?url=${encodeURIComponent(url)}`)
      const blob = await res.blob()
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    }
    const [submitQr, resultsQr] = await Promise.all([toDataUrl(submitUrl), toDataUrl(resultsUrl)])

    const win = window.open('', '_blank', 'width=750,height=1000')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>TPS Sandbox — ${form.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1B2A4A; background: #fff; padding: 48px; }
    .header { border-bottom: 3px solid #F26522; padding-bottom: 16px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-sub { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #6B7280; }
    .header-org { font-size: 18px; font-weight: 700; color: #1B2A4A; margin-top: 4px; }
    .header-date { font-size: 11px; color: #6B7280; text-align: right; }
    h1 { font-size: 22px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .card { border: 2px solid #F26522; border-radius: 8px; padding: 20px; text-align: center; }
    .card-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #F26522; margin-bottom: 12px; }
    .card img { width: 180px; height: 180px; display: block; margin: 0 auto 16px; }
    .card-url { font-size: 10px; color: #374151; word-break: break-all; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px; padding: 8px; text-align: left; }
    .pin-row { border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 24px; }
    .pin-label { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0; }
    .pin-note { font-size: 11px; color: #9CA3AF; }
    .footer { font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 8px; }
    @media print { body { padding: 32px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-sub">USAF Test Pilot School — Test Foundations</div>
      <div class="header-org">The Sandbox — Form Distribution Sheet</div>
    </div>
    <div class="header-date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <h1>${form.title}</h1>

  <div class="grid">
    <div class="card">
      <div class="card-label">📋 Submit a Response</div>
      <img src="${submitQr}" alt="Submit QR"/>
      <div class="card-url">${submitUrl}</div>
    </div>
    <div class="card">
      <div class="card-label">📊 View Results</div>
      <img src="${resultsQr}" alt="Results QR"/>
      <div class="card-url">${resultsUrl}</div>
    </div>
  </div>

  <div class="pin-row">
    <div>
      <div class="pin-label">Access PINs</div>
      <div class="pin-note" style="margin-top:4px">Each link above is protected by a separate PIN set by the administrator. Contact your administrator for the PIN.</div>
    </div>
  </div>

  <div class="footer">
    TPS Test Foundations · USAF Test Pilot School · ${form.title} · Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>
  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`)
    win.document.close()
  }

  const weightedQs  = form.questions.filter((q) => q.weight !== null && q.weight > 0)
  const totalWeight = weightedQs.reduce((s, q) => s + (q.weight ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">{form.title}</h1>
          {form.description && <p className="text-sm text-gray-500 mt-0.5">{form.description}</p>}
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            <span>{form._count.submissions} submission{form._count.submissions !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{form.mode === 'GRADER' ? 'Grader mode' : 'Survey mode'}</span>
            {form.scoringEnabled && <><span>·</span><span>Scoring enabled</span></>}
          </div>
        </div>
        <button onClick={printDistributionSheet} className="btn-secondary text-sm flex-shrink-0">
          ↓ Print Distribution Sheet
        </button>
      </div>

      {form.invite && (
        <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800">
          Creator: {form.invite.recipientName} &lt;{form.invite.recipientEmail}&gt; · {form.invite.formSubject}
        </div>
      )}

      {/* QR codes & URLs */}
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { label: 'Submission Form', url: submitUrl,  slug: form.id + '_submit',  type: 'submit'  as const },
          { label: 'Results View',    url: resultsUrl, slug: form.id + '_results', type: 'results' as const },
        ].map(({ label, url, type }) => (
          <div key={type} className="card border border-gray-200 space-y-3">
            <p className="font-semibold text-sm text-gray-700">{label}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?url=${encodeURIComponent(url)}`}
              alt={`QR for ${label}`}
              width={160} height={160}
              className="rounded mx-auto"
            />
            <div className="flex gap-2 items-center">
              <code className="text-xs text-gray-500 break-all flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                {url}
              </code>
              <button onClick={() => copy(url)} className="btn-secondary text-xs flex-shrink-0">Copy</button>
            </div>
            <a href={`/api/qr?url=${encodeURIComponent(url)}`} download={`qr-${type}.svg`}
               className="text-xs text-tps-orange hover:underline">
              Download QR
            </a>

            {/* PIN reset */}
            {pinResult?.type === type && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                New PIN: <strong className="font-mono text-base">{pinResult.newPin}</strong> — save this!
              </div>
            )}
            {form.samePinWarning && type === 'results' && (
              <p className="text-xs text-amber-600">⚠ Same PIN as submission form</p>
            )}
            <button onClick={() => setExpandPin(expandPin === type ? null : type)}
                    className="text-xs text-gray-400 hover:text-tps-orange">
              {expandPin === type ? 'Cancel PIN reset' : 'Rotate PIN'}
            </button>
            {expandPin === type && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <input
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="Auto-generate"
                    className="field-input font-mono text-sm tracking-widest"
                    maxLength={20}
                  />
                </div>
                <button onClick={() => handlePinReset(type)} disabled={resetting} className="btn-primary text-sm">
                  {resetting ? '…' : 'Set'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cross-survey read access */}
      {allForms.length > 0 && (
        <div className="card border border-gray-200 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">Cross-Form Results Access</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Grant another form&apos;s results-PIN-holders read access to <strong>this form&apos;s</strong> results.
            </p>
          </div>
          {accessError && <p className="text-xs text-red-600">{accessError}</p>}

          {/* Currently granted */}
          {accessList.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Currently granted to:</p>
              {accessList.map((grantedId) => {
                const grantedForm = allForms.find((f) => f.id === grantedId)
                return (
                  <div key={grantedId} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-sm flex-1 text-green-800">{grantedForm?.title ?? grantedId}</span>
                    <button
                      disabled={accessBusy}
                      className="text-xs text-red-400 hover:text-red-600"
                      onClick={async () => {
                        setAccessBusy(true); setAccessError('')
                        const res = await adminRevokeAccessAction(grantedId, form.id)
                        if (res.error) setAccessError(res.error)
                        else setAccessList((l) => l.filter((id) => id !== grantedId))
                        setAccessBusy(false)
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Grant new access */}
          {allForms.filter((f) => !accessList.includes(f.id)).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Grant access to:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allForms.filter((f) => !accessList.includes(f.id)).map((f) => (
                  <div key={f.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-sm flex-1 text-gray-700">{f.title}</span>
                    <button
                      disabled={accessBusy}
                      className="text-xs text-tps-orange hover:underline"
                      onClick={async () => {
                        setAccessBusy(true); setAccessError('')
                        const res = await adminGrantAccessAction(f.id, form.id)
                        if (res.error) setAccessError(res.error)
                        else setAccessList((l) => [...l, f.id])
                        setAccessBusy(false)
                      }}
                    >
                      Grant
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allForms.filter((f) => !accessList.includes(f.id)).length === 0 && accessList.length === allForms.length && (
            <p className="text-xs text-gray-400">All other forms have been granted access.</p>
          )}
        </div>
      )}

      {/* Questions summary */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">
          Questions ({form.questions.length})
          {form.scoringEnabled && (
            <span className={cn('ml-2 text-xs px-2 py-0.5 rounded-full',
              Math.abs(totalWeight - 1) < 0.001 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              Weight total: {(totalWeight * 100).toFixed(0)}%
            </span>
          )}
        </h2>
        <div className="space-y-1">
          {form.questions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0 text-sm">
              <span className="text-gray-400 w-5 text-xs">{i + 1}.</span>
              <span className="flex-1 text-gray-700">{q.label}</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.questionType}</span>
              {q.weight !== null && (
                <span className="text-xs text-tps-orange font-medium">{(q.weight * 100).toFixed(0)}%</span>
              )}
            </div>
          ))}
          {form.questions.length === 0 && (
            <p className="text-sm text-gray-400">No questions yet — creator needs to build the form.</p>
          )}
        </div>
      </div>
    </div>
  )
}
