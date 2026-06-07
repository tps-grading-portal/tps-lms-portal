'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignCourseAction, assignPhaseAction, removeAssignmentAction, setUserDepartmentsAction } from '../actions'
import { MCG_DEPT_ORDER, deptLabel } from '@/lib/mcg-departments'
import type { UserRole } from '@prisma/client'

export type AssignmentRow = {
  id:           string
  courseCode:   string | null   // single course
  courseTitle:  string | null
  deptCode:     string | null   // whole phase
  assignedBy:   string
  assignedAt:   string
}

export type CatalogOption = { id: string; courseCode: string; title: string; deptCode: string }

type Props = {
  userId:      string
  role:        UserRole
  departments: string[]          // UserDepartment codes (chairs)
  assignments: AssignmentRow[]
  catalog:     CatalogOption[]
}

const INSTRUCTOR_ROLES: UserRole[] = ['LINE_INSTRUCTOR', 'GUEST_INSTRUCTOR', 'DEPT_CHAIR', 'ADO', 'DO', 'A9_STANDARDS', 'DEAN_COMMANDER', 'SYSTEM_ADMIN']

export function PrivilegesPanel({ userId, role, departments, assignments, catalog }: Props) {
  const router = useRouter()
  const [pending, startTx]  = useTransition()
  const [error,   setError] = useState<string | null>(null)

  const [addingCourse, setAddingCourse] = useState(false)
  const [addingPhase,  setAddingPhase]  = useState(false)
  const [courseId,     setCourseId]     = useState('')
  const [phaseCode,    setPhaseCode]    = useState('')
  const [chairDepts,   setChairDepts]   = useState<string[]>(departments)

  if (!INSTRUCTOR_ROLES.includes(role)) return null

  const ownedEventIds = new Set(assignments.filter(a => a.courseCode).map(a => a.courseCode))
  const ownedPhases   = new Set(assignments.filter(a => a.deptCode).map(a => a.deptCode))
  const availableCatalog = catalog.filter(c => !ownedEventIds.has(c.courseCode))
  const availablePhases  = MCG_DEPT_ORDER.filter(d => !ownedPhases.has(d))

  function run(fn: () => Promise<{ error?: string } | { ok: boolean }>) {
    setError(null)
    startTx(async () => {
      const result = await fn()
      if ('error' in result && result.error) { setError(result.error); return }
      router.refresh()
    })
  }

  function handleAddCourse() {
    if (!courseId) return
    run(() => assignCourseAction(userId, courseId))
    setCourseId('')
    setAddingCourse(false)
  }

  function handleAddPhase() {
    if (!phaseCode) return
    run(() => assignPhaseAction(userId, phaseCode as never))
    setPhaseCode('')
    setAddingPhase(false)
  }

  function toggleChairDept(code: string) {
    setChairDepts(prev => prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code])
  }

  return (
    <div className="card space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Privileges</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Course/phase ownership grants content authoring and submission rights
          for those events. All changes are audit-logged.
        </p>
      </div>

      {/* Dept Chair departments */}
      {role === 'DEPT_CHAIR' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Chair Departments</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {MCG_DEPT_ORDER.map(d => (
              <label
                key={d}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                  chairDepts.includes(d) ? 'border-tps-orange bg-tps-orange/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={chairDepts.includes(d)}
                  onChange={() => toggleChairDept(d)}
                  className="rounded border-gray-300 text-tps-orange focus:ring-tps-orange"
                  disabled={pending}
                />
                <span className="font-mono font-bold text-xs">{d}</span>
                <span className="text-gray-500 text-xs truncate">{deptLabel(d)}</span>
              </label>
            ))}
          </div>
          {JSON.stringify([...chairDepts].sort()) !== JSON.stringify([...departments].sort()) && (
            <button
              onClick={() => run(() => setUserDepartmentsAction(userId, chairDepts))}
              disabled={pending || chairDepts.length === 0}
              className="btn-primary text-xs px-3 py-1.5"
            >
              Save Departments
            </button>
          )}
        </div>
      )}

      {/* Current assignments */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">Course Owner Assignments</p>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-400">No courses or phases assigned.</p>
        ) : (
          <div className="space-y-1.5">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                {a.deptCode ? (
                  <>
                    <span className="text-xs font-bold bg-tps-navy text-white px-2 py-0.5 rounded font-mono">{a.deptCode}</span>
                    <span className="text-sm text-gray-700 flex-1">
                      Entire phase — {deptLabel(a.deptCode)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono font-bold text-tps-navy w-20 shrink-0">{a.courseCode}</span>
                    <span className="text-sm text-gray-700 truncate flex-1">{a.courseTitle}</span>
                  </>
                )}
                <span className="text-[10px] text-gray-400 shrink-0" title={`Assigned ${new Date(a.assignedAt).toLocaleString()}`}>
                  by {a.assignedBy}
                </span>
                <button
                  onClick={() => run(() => removeAssignmentAction(a.id))}
                  disabled={pending}
                  className="text-gray-300 hover:text-red-500 text-lg leading-none shrink-0"
                  title="Remove assignment"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add course — repeating dropdown */}
        {addingCourse ? (
          <div className="flex gap-2 items-center">
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="field-input flex-1 text-sm"
              autoFocus
            >
              <option value="">Select a course…</option>
              {availableCatalog.map(c => (
                <option key={c.id} value={c.id}>{c.courseCode} — {c.title}</option>
              ))}
            </select>
            <button onClick={handleAddCourse} disabled={pending || !courseId} className="btn-primary text-xs px-3 py-2">
              Add
            </button>
            <button onClick={() => setAddingCourse(false)} className="text-gray-400 text-sm px-1">Cancel</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setAddingCourse(true)} className="btn-secondary text-xs px-3 py-1.5" disabled={pending}>
              + Add Course
            </button>
            {role !== 'DEPT_CHAIR' && (
              addingPhase ? null : (
                <button onClick={() => setAddingPhase(true)} className="btn-secondary text-xs px-3 py-1.5" disabled={pending}>
                  + Add Phase
                </button>
              )
            )}
          </div>
        )}

        {/* Add phase — whole department prefix */}
        {addingPhase && (
          <div className="flex gap-2 items-center">
            <select
              value={phaseCode}
              onChange={e => setPhaseCode(e.target.value)}
              className="field-input flex-1 text-sm"
              autoFocus
            >
              <option value="">Select a phase…</option>
              {availablePhases.map(d => (
                <option key={d} value={d}>{d} — {deptLabel(d)} (all courses)</option>
              ))}
            </select>
            <button onClick={handleAddPhase} disabled={pending || !phaseCode} className="btn-primary text-xs px-3 py-2">
              Add
            </button>
            <button onClick={() => setAddingPhase(false)} className="text-gray-400 text-sm px-1">Cancel</button>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  )
}
