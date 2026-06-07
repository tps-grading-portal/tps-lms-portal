'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  changeOwnPasswordAction, createAccessRequestAction,
  cancelAccessRequestAction, reviewAccessRequestAction,
} from './actions'
import type { AccessRequestType, AccessRequestStatus, UserRole, Track } from '@prisma/client'

const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN:     'System Admin',
  DEAN_COMMANDER:   'Dean / Commander',
  A9_STANDARDS:     'A9 Standards',
  DEPT_CHAIR:       'Dept Chair',
  ADO:              'ADO',
  DO:               'DO',
  SCHEDULER:        'Scheduler',
  LINE_INSTRUCTOR:  'Instructor',
  GUEST_INSTRUCTOR: 'Guest Instructor',
  STUDENT:          'Student',
}

const TYPE_LABELS: Record<AccessRequestType, string> = {
  COURSE_OWNER: 'Course Owner',
  PHASE_OWNER:  'Phase Owner',
  DEPARTMENT:   'Department Access',
  ROLE_CHANGE:  'Role Change',
  OTHER:        'Other',
}

const STATUS_STYLES: Record<AccessRequestStatus, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  DENIED:   'bg-red-100 text-red-600',
}

const DEPT_CODES = ['AN', 'CF', 'SO', 'AS', 'PF', 'FQ', 'SY', 'TF', 'TL']

// Roles a user can request (admin is never requestable)
const REQUESTABLE_ROLES: UserRole[] = [
  'DEAN_COMMANDER', 'A9_STANDARDS', 'DEPT_CHAIR', 'ADO', 'DO',
  'SCHEDULER', 'LINE_INSTRUCTOR', 'GUEST_INSTRUCTOR',
]

type Profile = {
  email:       string
  firstName:   string
  lastName:    string
  role:        UserRole
  lastLoginAt: string | null
  createdAt:   string
  className:   string | null
  track:       Track | null
  departments: string[]
  courseOwnerships: { id: string; label: string }[]
}

type MyRequest = {
  id:            string
  type:          AccessRequestType
  targetLabel:   string | null
  justification: string | null
  status:        AccessRequestStatus
  createdAt:     string
  reviewedBy:    string | null
  reviewNote:    string | null
}

type ReviewRequest = {
  id:            string
  type:          AccessRequestType
  targetLabel:   string | null
  justification: string | null
  createdAt:     string
  requester:     string
  requesterRole: UserRole
}

// ── Change password ───────────────────────────────────────────────────────────

function ChangePasswordCard() {
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [pending,  startTx]     = useTransition()
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  function handleSubmit() {
    setError(null)
    setSuccess(false)
    if (next !== confirm) { setError('New passwords do not match.'); return }
    startTx(async () => {
      const result = await changeOwnPasswordAction(current, next)
      if (!result.ok) { setError(result.error ?? 'Failed'); return }
      setSuccess(true)
      setCurrent(''); setNext(''); setConfirm('')
    })
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-bold text-tps-navy">Change Password</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="field-label">Current Password</label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="field-input" disabled={pending} autoComplete="current-password" />
        </div>
        <div>
          <label className="field-label">New Password</label>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} className="field-input" disabled={pending} autoComplete="new-password" />
        </div>
        <div>
          <label className="field-label">Confirm New Password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="field-input" disabled={pending} autoComplete="new-password" />
        </div>
      </div>
      {error   && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Password changed. Use it the next time you sign in.</div>}
      <button
        onClick={handleSubmit}
        disabled={pending || !current || next.length < 8 || !confirm}
        className="btn-primary text-sm px-5 py-2"
      >
        {pending ? 'Saving…' : 'Update Password'}
      </button>
      <p className="text-xs text-gray-400">At least 8 characters.</p>
    </section>
  )
}

// ── Request access ────────────────────────────────────────────────────────────

function RequestAccessCard({
  role, courseOptions,
}: {
  role:          UserRole
  courseOptions: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [type,    setType]    = useState<AccessRequestType>('COURSE_OWNER')
  const [target,  setTarget]  = useState('')
  const [why,     setWhy]     = useState('')
  const [search,  setSearch]  = useState('')
  const [pending, startTx]    = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const filteredCourses = search
    ? courseOptions.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : courseOptions

  function targetLabel(): string | null {
    switch (type) {
      case 'COURSE_OWNER': return courseOptions.find(c => c.id === target)?.label ?? null
      case 'PHASE_OWNER':
      case 'DEPARTMENT':   return target || null
      case 'ROLE_CHANGE':  return target ? ROLE_LABELS[target as UserRole] : null
      default:             return null
    }
  }

  function handleSubmit() {
    setError(null)
    setSuccess(false)
    startTx(async () => {
      const result = await createAccessRequestAction({
        type,
        targetId:      type === 'OTHER' ? null : target || null,
        targetLabel:   targetLabel(),
        justification: why || null,
      })
      if (!result.ok) { setError(result.error ?? 'Failed'); return }
      setSuccess(true)
      setTarget(''); setWhy(''); setSearch('')
      router.refresh()
    })
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-bold text-tps-navy">Request Access</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Requests go to an approver — nothing changes on your account until someone with authority signs off.
        </p>
      </div>

      <div className="flex gap-1 flex-wrap">
        {(Object.keys(TYPE_LABELS) as AccessRequestType[]).map(t => (
          <button
            key={t}
            onClick={() => { setType(t); setTarget(''); setError(null); setSuccess(false) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              type === t ? 'bg-tps-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {type === 'COURSE_OWNER' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="search"
            placeholder="Filter courses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input text-sm"
            disabled={pending}
          />
          <select value={target} onChange={e => setTarget(e.target.value)} className="field-input text-sm" disabled={pending}>
            <option value="">— Pick a course to own —</option>
            {filteredCourses.slice(0, 400).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}

      {(type === 'PHASE_OWNER' || type === 'DEPARTMENT') && (
        <select value={target} onChange={e => setTarget(e.target.value)} className="field-input text-sm w-64" disabled={pending}>
          <option value="">— Pick a phase / department —</option>
          {DEPT_CODES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )}

      {type === 'ROLE_CHANGE' && (
        <select value={target} onChange={e => setTarget(e.target.value)} className="field-input text-sm w-64" disabled={pending}>
          <option value="">— Pick the role you need —</option>
          {REQUESTABLE_ROLES.filter(r => r !== role).map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      )}

      <div>
        <label className="field-label">{type === 'OTHER' ? 'What do you need access to? *' : 'Justification (optional)'}</label>
        <textarea
          value={why}
          onChange={e => setWhy(e.target.value)}
          className="field-input"
          rows={2}
          placeholder={type === 'OTHER' ? 'Describe the access you need and why…' : 'Why do you need this?'}
          disabled={pending}
        />
      </div>

      {error   && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Request submitted — you&apos;ll get a notification when it&apos;s reviewed.</div>}

      <button
        onClick={handleSubmit}
        disabled={pending || (type !== 'OTHER' && !target) || (type === 'OTHER' && !why.trim())}
        className="btn-primary text-sm px-5 py-2"
      >
        {pending ? 'Submitting…' : 'Submit Request'}
      </button>
    </section>
  )
}

// ── Reviewer panel ────────────────────────────────────────────────────────────

function ReviewPanel({ requests }: { requests: ReviewRequest[] }) {
  const router = useRouter()
  const [pending, startTx] = useTransition()
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note,    setNote]    = useState('')

  function review(id: string, approve: boolean) {
    startTx(async () => {
      const result = await reviewAccessRequestAction(id, approve, noteFor === id ? note : undefined)
      if (!result.ok) { alert(result.error ?? 'Failed'); return }
      setNoteFor(null); setNote('')
      router.refresh()
    })
  }

  return (
    <section className="card space-y-3 border-amber-200">
      <h2 className="font-bold text-tps-navy flex items-center gap-2">
        Pending Access Requests
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
          {requests.length}
        </span>
      </h2>

      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="rounded-lg border border-gray-100 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{r.requester}</span>
              <span className="text-[10px] text-gray-400">{ROLE_LABELS[r.requesterRole]}</span>
              <span className="text-xs font-bold bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded">
                {TYPE_LABELS[r.type]}{r.targetLabel ? `: ${r.targetLabel}` : ''}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
            {r.justification && <p className="text-xs text-gray-500">&ldquo;{r.justification}&rdquo;</p>}
            <div className="flex gap-2 items-center flex-wrap">
              <button
                onClick={() => review(r.id, true)}
                disabled={pending}
                className="text-xs px-3 py-1 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve &amp; Apply
              </button>
              <button
                onClick={() => review(r.id, false)}
                disabled={pending}
                className="text-xs px-3 py-1 rounded-lg font-semibold bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
              >
                Deny
              </button>
              {noteFor === r.id ? (
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Note to requester…"
                  className="field-input text-xs flex-1 min-w-[160px] py-1"
                  autoFocus
                />
              ) : (
                <button onClick={() => { setNoteFor(r.id); setNote('') }} className="text-xs text-gray-400 hover:text-tps-navy">
                  + add note
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function AccountView({
  profile, myRequests, courseOptions, pendingForReview, isReviewer,
}: {
  profile:          Profile
  myRequests:       MyRequest[]
  courseOptions:    { id: string; label: string }[]
  pendingForReview: ReviewRequest[]
  isReviewer:       boolean
}) {
  const router = useRouter()
  const [pending, startTx] = useTransition()

  function withdraw(id: string) {
    if (!confirm('Withdraw this request?')) return
    startTx(async () => {
      await cancelAccessRequestAction(id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-tps-navy">My Account</h1>
        <p className="text-gray-500 text-sm">
          Your profile, password, and access — request anything you don&apos;t have
        </p>
      </div>

      {/* Profile + current access */}
      <section className="card">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Profile</p>
            <p className="text-sm font-semibold text-gray-800">{profile.firstName} {profile.lastName}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              {ROLE_LABELS[profile.role]}
              {profile.className && ` · Class ${profile.className}`}
              {profile.track && ` · ${profile.track} track`}
            </p>
            {profile.lastLoginAt && (
              <p className="text-xs text-gray-300 mt-1">
                Last sign-in {new Date(profile.lastLoginAt).toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Current Access</p>
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs font-bold bg-tps-navy/10 text-tps-navy px-2 py-1 rounded-lg">
                {ROLE_LABELS[profile.role]}
              </span>
              {profile.departments.map(d => (
                <span key={d} className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">
                  {d} dept
                </span>
              ))}
            </div>
            {profile.courseOwnerships.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {profile.courseOwnerships.slice(0, 6).map(o => (
                  <p key={o.id} className="text-xs text-gray-500">• Owner — {o.label}</p>
                ))}
                {profile.courseOwnerships.length > 6 && (
                  <p className="text-[10px] text-gray-400">+{profile.courseOwnerships.length - 6} more</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reviewer queue (admins) */}
      {isReviewer && pendingForReview.length > 0 && <ReviewPanel requests={pendingForReview} />}

      <ChangePasswordCard />

      <RequestAccessCard role={profile.role} courseOptions={courseOptions} />

      {/* My requests */}
      {myRequests.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-bold text-tps-navy">My Requests</h2>
          {myRequests.map(r => (
            <div key={r.id} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[r.status]}`}>
                {r.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  {TYPE_LABELS[r.type]}{r.targetLabel ? ` — ${r.targetLabel}` : ''}
                </p>
                {r.justification && <p className="text-xs text-gray-400 truncate">&ldquo;{r.justification}&rdquo;</p>}
                {r.status !== 'PENDING' && (
                  <p className="text-[10px] text-gray-400">
                    {r.reviewedBy && `Reviewed by ${r.reviewedBy}`}{r.reviewNote && ` · ${r.reviewNote}`}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-gray-300 shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
              {r.status === 'PENDING' && (
                <button
                  onClick={() => withdraw(r.id)}
                  disabled={pending}
                  className="text-[10px] text-gray-400 hover:text-red-500 shrink-0"
                >
                  withdraw
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
