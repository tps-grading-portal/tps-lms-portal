'use client'

import { useActionState } from 'react'
import {
  addStudentAction,
  removeStudentAction,
  addScenarioAction,
  removeScenarioAction,
  addStaffMemberAction,
  toggleStaffMemberAction,
} from './roster-actions'
import { TRACK_LABELS } from '@/lib/utils'

type Student  = { id: string; number: number; track: string }
type Scenario = { id: string; number: number; label: string }
type Staff    = { id: string; name: string; isActive: boolean }

interface RosterPanelProps {
  classId:      string
  className:    string
  students:     Student[]
  staffMembers: Staff[]
}

export function RosterPanel({ classId, className, students, staffMembers }: RosterPanelProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <StudentManager classId={classId} className={className} students={students} />
      <StaffManager staffMembers={staffMembers} />
    </div>
  )
}

// ── Students ──────────────────────────────────────────────────────────────────
function StudentManager({ classId, className, students }: { classId: string; className: string; students: Student[] }) {
  const [result, formAction, pending] = useActionState(addStudentAction, null)

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-sm text-gray-700">
        Students — Class {className}{' '}
        <span className="text-gray-400 font-normal">({students.length})</span>
      </h3>

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="classId" value={classId} />
        <input name="number" type="number" min="1" required placeholder="Student number (e.g. 5)" className="field-input text-sm" />
        <select name="track" required className="field-select text-sm">
          <option value="">Select track…</option>
          {Object.entries(TRACK_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
        <button type="submit" disabled={pending} className="btn-secondary w-full text-sm">
          {pending ? 'Adding…' : '+ Add Student'}
        </button>
      </form>

      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {students.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
            <span className="truncate">
              <span className="font-medium font-mono">#{s.number}</span>{' '}
              <span className="text-gray-400 text-xs">{TRACK_LABELS[s.track] ?? s.track}</span>
            </span>
            <form action={async () => { await removeStudentAction(s.id) }}>
              <button type="submit" className="text-xs text-red-400 hover:text-red-600 min-h-[32px] px-1">
                ×
              </button>
            </form>
          </li>
        ))}
        {students.length === 0 && (
          <li className="text-xs text-gray-400 text-center py-2">No students yet</li>
        )}
      </ul>
    </div>
  )
}

// ── Scenarios ─────────────────────────────────────────────────────────────────
function ScenarioManager({ classId, className, scenarios }: { classId: string; className: string; scenarios: Scenario[] }) {
  const [result, formAction, pending] = useActionState(addScenarioAction, null)

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-sm text-gray-700">
        Scenarios — Class {className}{' '}
        <span className="text-gray-400 font-normal">({scenarios.length})</span>
      </h3>

      <form action={formAction} className="space-y-2">
        <input name="number" type="number" min="1" required placeholder="Number (e.g. 12)" className="field-input text-sm" />
        <input name="label" required placeholder="Label (e.g. Scenario 4)" className="field-input text-sm" />
        {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
        <button type="submit" disabled={pending} className="btn-secondary w-full text-sm">
          {pending ? 'Adding…' : '+ Add Scenario'}
        </button>
      </form>

      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {scenarios.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
            <span className="font-medium">#{s.number} — {s.label}</span>
            <form action={async () => { await removeScenarioAction(s.id) }}>
              <button type="submit" className="text-xs text-red-400 hover:text-red-600 min-h-[32px] px-1">
                ×
              </button>
            </form>
          </li>
        ))}
        {scenarios.length === 0 && (
          <li className="text-xs text-gray-400 text-center py-2">No scenarios yet</li>
        )}
      </ul>
    </div>
  )
}

// ── Staff Members ─────────────────────────────────────────────────────────────
function StaffManager({ staffMembers }: { staffMembers: Staff[] }) {
  const [result, formAction, pending] = useActionState(addStaffMemberAction, null)

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-sm text-gray-700">
        Staff Members{' '}
        <span className="text-gray-400 font-normal">(global — all classes)</span>
      </h3>

      <form action={formAction} className="space-y-2">
        <input name="name" required placeholder="Last name or full name" className="field-input text-sm" />
        {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
        <button type="submit" disabled={pending} className="btn-secondary w-full text-sm">
          {pending ? 'Adding…' : '+ Add Staff Member'}
        </button>
      </form>

      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {staffMembers.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
            <span className={s.isActive ? 'font-medium' : 'text-gray-400 line-through'}>
              {s.name}
            </span>
            <form action={async () => { await toggleStaffMemberAction(s.id, !s.isActive) }}>
              <button type="submit" className="text-xs text-gray-400 hover:text-gray-600 min-h-[32px] px-1">
                {s.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </form>
          </li>
        ))}
        {staffMembers.length === 0 && (
          <li className="text-xs text-gray-400 text-center py-2">No staff members yet</li>
        )}
      </ul>
    </div>
  )
}
