'use client'

import { useActionState, useState } from 'react'
import { submitGradesAction } from './actions'
import { cn } from '@/lib/utils'

type Criterion = {
  id: string
  code: string
  name: string
  weight: number
  description: string
  waaDescriptor: string
  avgDescriptor: string
  failDescriptor: string
  sortOrder: number
}

type Student   = { id: string; number: number; track: string }
type Scenario  = { id: string; number: number; label: string }
type Staff     = { id: string; name: string }
type ExistingGrades = Record<string, number> // criterionId → gradeValue

interface GradeFormProps {
  criteria:       Criterion[]
  students:       Student[]
  scenarios:      Scenario[]
  staffMembers:   Staff[]
  existingGrades: ExistingGrades
  className?:               string
  preSelectedStudentId?:    string
  preSelectedScenarioId?:   string
  preSelectedStaffMemberId?: string
}

// Colors per grade value (1-8)
const GRADE_BG: Record<number, string> = {
  1: 'bg-emerald-600 text-white border-emerald-700',
  2: 'bg-emerald-500 text-white border-emerald-600',
  3: 'bg-green-400 text-gray-900 border-green-500',
  4: 'bg-gray-200 text-gray-800 border-gray-400',
  5: 'bg-amber-200 text-gray-800 border-amber-400',
  6: 'bg-orange-300 text-gray-900 border-orange-500',
  7: 'bg-orange-400 text-white border-orange-600',
  8: 'bg-red-500 text-white border-red-700',
}

const GRADE_BG_UNSELECTED: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  2: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100',
  3: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  4: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
  5: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  6: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  7: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  8: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
}

const GRADE_ANCHORS: Record<number, string> = { 1: 'WAA', 4: 'Avg', 8: 'Fail' }

export function GradeForm({
  criteria,
  students,
  scenarios,
  staffMembers,
  existingGrades,
  className,
  preSelectedStudentId,
  preSelectedScenarioId,
  preSelectedStaffMemberId,
}: GradeFormProps) {
  const [result, formAction, pending] = useActionState(submitGradesAction, null)
  const [grades, setGrades] = useState<Record<string, number>>(existingGrades)
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null)

  const gradedCount   = Object.keys(grades).length
  const totalCriteria = criteria.length
  const allGraded     = gradedCount === totalCriteria

  const selectGrade = (criterionId: string, value: number) => {
    setGrades((prev) => ({ ...prev, [criterionId]: value }))
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* When editing a previous submission, carry the original IDs so the
          action can detect changes and remove the stale assessment. */}
      {preSelectedStudentId && preSelectedScenarioId && preSelectedStaffMemberId && (
        <>
          <input type="hidden" name="originalStudentId"     value={preSelectedStudentId} />
          <input type="hidden" name="originalScenarioId"    value={preSelectedScenarioId} />
          <input type="hidden" name="originalStaffMemberId" value={preSelectedStaffMemberId} />
        </>
      )}

      {/* Selection row */}
      <div className="card space-y-3">
        <div>
          <label className="field-label">Student</label>
          <select
            name="studentId"
            required
            defaultValue={preSelectedStudentId ?? ''}
            className="field-select"
          >
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                Student {s.number}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Scenario</label>
          <select
            name="scenarioId"
            required
            defaultValue={preSelectedScenarioId ?? ''}
            className="field-select"
          >
            <option value="">Select scenario…</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Your Name</label>
          <select
            name="staffMemberId"
            required
            defaultValue={preSelectedStaffMemberId ?? ''}
            className="field-select"
          >
            <option value="">Select your name…</option>
            {staffMembers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-tps-blue transition-all duration-300 rounded-full"
            style={{ width: `${(gradedCount / totalCriteria) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-600 whitespace-nowrap">
          {gradedCount}/{totalCriteria} graded
        </span>
      </div>

      {/* Criteria grade inputs */}
      {criteria.map((criterion) => {
        const selected   = grades[criterion.id]
        const isExpanded = expandedCriterion === criterion.id

        return (
          <div
            key={criterion.id}
            className={cn(
              'card border transition-colors',
              selected ? 'border-tps-blue bg-blue-50' : 'border-gray-200',
            )}
          >
            {/* Criterion header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-tps-blue bg-blue-100 px-1.5 py-0.5 rounded">
                    {criterion.code}
                  </span>
                  <span className="text-xs text-gray-400">
                    {(criterion.weight * 100).toFixed(1)}%
                  </span>
                  {selected && (
                    <span
                      className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full border',
                        GRADE_BG[selected],
                      )}
                    >
                      {selected === 8 ? '8. Fail' : selected}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{criterion.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  {criterion.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setExpandedCriterion(isExpanded ? null : criterion.id)
                }
                className="text-gray-400 hover:text-gray-600 text-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Show rubric descriptors"
              >
                ℹ
              </button>
            </div>

            {/* Rubric descriptors (collapsible) */}
            {isExpanded && (
              <div className="mb-3 space-y-2 text-xs rounded-lg bg-gray-50 border border-gray-200 p-3">
                <div>
                  <span className="font-bold text-emerald-700">1 — Well Above Average:</span>{' '}
                  <span className="text-gray-600">{criterion.waaDescriptor}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-600">4 — Average:</span>{' '}
                  <span className="text-gray-600">{criterion.avgDescriptor}</span>
                </div>
                <div>
                  <span className="font-bold text-red-700">8 — Fail:</span>{' '}
                  <span className="text-gray-600">{criterion.failDescriptor}</span>
                </div>
              </div>
            )}

            {/* Grade buttons — 8 touch targets */}
            <div className="grid grid-cols-8 gap-1">
              {([1, 2, 3, 4, 5, 6, 7, 8] as const).map((val) => {
                const isSelected = selected === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectGrade(criterion.id, val)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded border text-center',
                      'min-h-[52px] transition-all duration-100 active:scale-95',
                      isSelected ? GRADE_BG[val] + ' ring-2 ring-offset-1 ring-tps-blue' : GRADE_BG_UNSELECTED[val],
                    )}
                  >
                    <span className="font-bold text-base leading-none">
                      {val}
                    </span>
                    {GRADE_ANCHORS[val] && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-80">
                        {GRADE_ANCHORS[val]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Hidden input carries the grade value for form submission */}
            {selected !== undefined && (
              <input
                type="hidden"
                name={`grade_${criterion.id}`}
                value={selected}
              />
            )}
          </div>
        )
      })}

      {/* Error */}
      {result && 'error' in result && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}

      {/* Submit */}
      <div className="sticky bottom-4 pt-2">
        <button
          type="submit"
          disabled={pending || !allGraded}
          className={cn(
            'btn w-full text-base py-4 shadow-lg',
            allGraded
              ? 'btn-primary'
              : 'bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed min-h-[44px]',
          )}
        >
          {pending
            ? 'Submitting…'
            : allGraded
            ? existingGrades && Object.keys(existingGrades).length > 0
              ? 'Update Grades'
              : 'Submit Grades'
            : `Grade all ${totalCriteria - gradedCount} remaining criteria to submit`}
        </button>
      </div>
    </form>
  )
}
