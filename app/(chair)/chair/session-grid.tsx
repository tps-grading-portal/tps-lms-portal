'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { chairEditGradeAction, finalizeSessionAction, deleteAssessmentAction } from './actions'
import type { SessionDisplayData } from '@/lib/session-processor'
import { cn, TRACK_LABELS } from '@/lib/utils'
import { GRADE_LABELS } from '@/lib/constants'

interface SessionGridProps {
  initialData: SessionDisplayData
  classId:     string
}

// ── 3-state cell color logic (session-status gated) ──────────────────────────
// OPEN (< 4 graders): plain grade colors — session not ready for analysis
// PENDING_RESOLUTION:
//   row has disc + isDiscontinuity=true  → amber  — needs fixing
//   row has disc + isDiscontinuity=false → grey   — fine, leave it
//   row has no disc                      → green/red per grade value
// READY_TO_FINALIZE / FINALIZED: all cells green/red
function gradePlainBg(v: number): string {
  if (v === 8)  return 'bg-red-100 text-red-700 font-bold'
  if (v <= 2)   return 'bg-emerald-100 text-emerald-900'
  if (v === 3)  return 'bg-green-100 text-green-800'
  if (v === 4)  return 'bg-gray-100 text-gray-700'
  if (v <= 6)   return 'bg-amber-100 text-amber-800'
  return 'bg-orange-200 text-orange-900'
}

function cellClass(
  gradeValue: number,
  isDiscontinuity: boolean,
  rowHasDisc: boolean,
  sessionStatus: string,
): string {
  // OPEN: not enough graders — plain grade scale, no green/amber/grey
  if (sessionStatus === 'OPEN') return gradePlainBg(gradeValue)

  // PENDING_RESOLUTION: row-level coloring
  if (sessionStatus === 'PENDING_RESOLUTION') {
    if (rowHasDisc) {
      return isDiscontinuity
        ? 'bg-amber-300 text-amber-900 font-bold'  // this cell needs fixing
        : 'bg-gray-100 text-gray-400'              // fine, leave it
    }
    // This row has no splits — show resolved state
    return gradeValue === 8
      ? 'bg-red-100 text-red-700 font-bold'
      : 'bg-green-100 text-green-800'
  }

  // READY_TO_FINALIZE / FINALIZED: whole card is clean
  return gradeValue === 8
    ? 'bg-red-100 text-red-700 font-bold'
    : 'bg-green-100 text-green-800'
}

// ── Card-level coloring ───────────────────────────────────────────────────────
function cardBorder(status: string, hasFail: boolean): string {
  if (status === 'READY_TO_FINALIZE') return hasFail ? 'border-red-300'  : 'border-green-400'
  if (status === 'PENDING_RESOLUTION') return 'border-amber-300'
  return 'border-gray-200'
}

function headerBg(status: string, hasFail: boolean): string {
  if (status === 'READY_TO_FINALIZE') return hasFail
    ? 'bg-red-50 border-red-200'
    : 'bg-green-50 border-green-200'
  if (status === 'PENDING_RESOLUTION') return 'bg-amber-50 border-amber-200'
  return 'bg-gray-50 border-gray-200'
}

function criterionCellBg(rowHasDisc: boolean, hasFail: boolean): string {
  if (rowHasDisc) return 'bg-white'
  return hasFail ? 'bg-red-50' : 'bg-green-50'
}

const statusBadge = (status: string, hasFail: boolean) => {
  if (status === 'READY_TO_FINALIZE') return hasFail
    ? 'bg-red-100 text-red-800 font-semibold'
    : 'bg-green-100 text-green-800 font-semibold'
  if (status === 'PENDING_RESOLUTION') return 'bg-amber-100 text-amber-800 font-semibold'
  if (status === 'FINALIZED')          return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-600'
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'OPEN':               return 'Waiting for graders'
    case 'PENDING_RESOLUTION': return '⚠ Resolve splits'
    case 'READY_TO_FINALIZE':  return '✓ Ready to Finalize'
    case 'FINALIZED':          return '✓ Finalized'
    default:                   return status
  }
}

// ── Grade editor bottom sheet ─────────────────────────────────────────────────
function GradeEditor({
  criterionGradeId, currentValue, criterionCode, graderName, onSave, onClose,
}: {
  criterionGradeId: string
  currentValue:     number
  criterionCode:    string
  graderName:       string
  onSave:  (id: string, val: number) => Promise<void>
  onClose: () => void
}) {
  const [selected, setSelected] = useState(currentValue)
  const [saving,   setSaving]   = useState(false)

  const handleSave = async () => {
    if (selected === currentValue) { onClose(); return }
    setSaving(true)
    await onSave(criterionGradeId, selected)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-gray-800">Adjust Grade</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">×</button>
        </div>
        <p className="text-xs text-gray-400 mb-3">{criterionCode} · {graderName}</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {([1,2,3,4,5,6,7,8] as const).map((val) => (
            <button key={val} type="button" onClick={() => setSelected(val)}
              className={cn(
                'rounded-lg border-2 p-2 flex flex-col items-center min-h-[52px] transition-all active:scale-95',
                selected === val
                  ? 'border-tps-blue bg-tps-blue text-white ring-2 ring-tps-blue ring-offset-1'
                  : 'border-gray-200 text-gray-700 hover:border-gray-400',
              )}>
              <span className="font-bold text-lg leading-none">{val}</span>
              {val === 8 && <span className="text-[9px] leading-none mt-0.5">Fail</span>}
              {val === 1 && <span className="text-[9px] leading-none mt-0.5">WAA</span>}
              {val === 4 && <span className="text-[9px] leading-none mt-0.5">Avg</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}   className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 text-sm">
            {saving ? 'Saving…' : 'Save Grade'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete assessment confirmation ────────────────────────────────────────────
function DeleteAssessmentConfirm({
  graderName, onConfirm, onClose, deleting,
}: {
  graderName: string
  onConfirm:  () => void
  onClose:    () => void
  deleting:   boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="font-semibold text-gray-800">Delete submission by {graderName}?</p>
          <p className="text-sm text-gray-500 mt-1">
            All 7 criterion grades submitted by this grader for this student will be permanently removed.
            The grader can resubmit fresh grades afterwards.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}   className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="btn-danger flex-1 text-sm">
            {deleting ? 'Deleting…' : 'Delete Submission'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main session grid ─────────────────────────────────────────────────────────
export function SessionGrid({ initialData, classId }: SessionGridProps) {
  const [data,         setData]         = useState<SessionDisplayData>(initialData)
  const [editTarget,   setEditTarget]   = useState<{
    criterionGradeId: string; currentValue: number; criterionCode: string; graderName: string
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ assessmentId: string; graderName: string } | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [, startTransition] = useTransition()
  const eventSourceRef = useRef<EventSource | null>(null)

  // ── SSE connection ────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`/api/events?classId=${classId}`)
      eventSourceRef.current = es
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as SessionDisplayData
          if (parsed.sessions && parsed.criteria) setData(parsed)
        } catch { /* skip malformed */ }
      }
      es.onerror = () => { es.close(); setTimeout(connect, 5000) }
    }
    connect()
    return () => { eventSourceRef.current?.close() }
  }, [classId])

  const handleGradeEdit = async (criterionGradeId: string, newValue: number) => {
    const result = await chairEditGradeAction(criterionGradeId, newValue)
    if ('success' in result && result.success) startTransition(() => setData(result.data))
  }

  const handleDeleteAssessment = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteAssessmentAction(deleteTarget.assessmentId)
    if ('success' in result && result.success) startTransition(() => setData(result.data))
    setDeleting(false)
    setDeleteTarget(null)
  }

  const { sessions, criteria } = data

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">No active sessions</p>
        <p className="text-sm mt-1">Grades will appear here as graders submit.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sessions.map((session) => {
        const graders   = session.assessments
        const isReady   = session.status === 'READY_TO_FINALIZE'
        const hasPending = session.status === 'PENDING_RESOLUTION'

        return (
          <div
            key={session.id}
            className={cn('card border overflow-hidden p-0 transition-colors', cardBorder(session.status, session.hasFail))}
          >
            {/* Card header */}
            <div className={cn(
              'px-4 py-3 border-b flex items-start justify-between gap-3',
              headerBg(session.status, session.hasFail),
            )}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-tps-navy">Student {session.student.number}</span>
                  <span className="text-xs text-gray-500">
                    {TRACK_LABELS[session.student.track] ?? session.student.track}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{session.scenario.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusBadge(session.status, session.hasFail))}>
                    {statusLabel(session.status)}
                  </span>
                  {session.finalScore !== null && (
                    <span className={cn('text-sm font-bold', session.hasFail ? 'text-red-600' : 'text-green-700')}>
                      {session.hasFail ? '⚠ FAIL' : session.finalScore.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-start">
                {isReady && (
                  <button
                    onClick={async () => { await finalizeSessionAction(session.id) }}
                    className={cn('text-xs py-2 px-3 rounded-lg font-semibold min-h-[44px]',
                      session.hasFail
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    )}
                  >
                    Finalize
                  </button>
                )}
              </div>
            </div>

            {/* Grade grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[180px] sticky left-0 bg-gray-50 z-10">
                      Criterion
                    </th>
                    {graders.map((a) => (
                      <th key={a.id} className="px-2 py-2 font-semibold text-gray-600 border-b border-gray-200 text-center min-w-[64px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="truncate max-w-[60px] block">{a.staffMember.name}</span>
                          {/* Delete grader column — trash icon */}
                          <button
                            type="button"
                            title={`Delete ${a.staffMember.name}'s submission`}
                            onClick={() => setDeleteTarget({ assessmentId: a.id, graderName: a.staffMember.name })}
                            className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        {a.weightedSum !== null && (
                          <span className={cn('block text-[10px] font-normal mt-0.5', a.hasFail ? 'text-red-600' : 'text-gray-500')}>
                            {a.hasFail ? 'FAIL' : a.weightedSum.toFixed(1)}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((criterion) => {
                    const rowGrades = graders.map((a) => ({
                      assessmentId: a.id,
                      graderName:   a.staffMember.name,
                      grade:        a.grades.find((g) => g.criterionId === criterion.id),
                    }))
                    const rowHasDisc = rowGrades.some((r) => r.grade?.isDiscontinuity)
                    // A row "has fail" if any submitted grade is 8
                    const rowHasFail = rowGrades.some((r) => r.grade?.gradeValue === 8)

                    return (
                      <tr key={criterion.id} className="bg-white">
                        {/* Criterion label — sticky left, color-coded by row state */}
                        <td className={cn(
                          'px-3 py-2 border-r border-gray-100 sticky left-0 z-10 transition-colors',
                          criterionCellBg(rowHasDisc, rowHasFail),
                        )}>
                          <span className="font-bold text-tps-blue text-xs">{criterion.code}</span>
                          {/* FULL name — no truncation */}
                          <span className="text-gray-600 ml-1.5 text-xs leading-snug">
                            {criterion.name}
                          </span>
                        </td>

                        {/* Grade cells */}
                        {rowGrades.map(({ assessmentId, graderName, grade }) => {
                          if (!grade) {
                            return (
                              <td key={assessmentId} className="px-2 py-1 text-center border border-gray-100">
                                <span className="text-gray-300">—</span>
                              </td>
                            )
                          }

                          const wasEdited = grade.editedBy === 'PANEL_CHAIR'

                          return (
                            <td
                              key={assessmentId}
                              className={cn(
                                'px-1 py-1 text-center border border-gray-100 transition-colors',
                                cellClass(grade.gradeValue, grade.isDiscontinuity, rowHasDisc, session.status),
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => setEditTarget({
                                  criterionGradeId: grade.id,
                                  currentValue:     grade.gradeValue,
                                  criterionCode:    criterion.code,
                                  graderName,
                                })}
                                className="w-full rounded text-sm font-bold min-h-[36px] relative hover:opacity-75 active:scale-95 transition-all"
                                title={`${GRADE_LABELS[grade.gradeValue]} — tap to adjust`}
                              >
                                {grade.gradeValue}
                                {wasEdited && (
                                  <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-purple-500 rounded-full" title="Chair-edited" />
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Row legend — only shown when splits exist */}
            {hasPending && (
              <div className="px-4 py-2 border-t border-amber-200 bg-amber-50 flex flex-wrap gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-amber-300 border border-amber-400 inline-block" />
                  Needs adjustment
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-gray-100 border border-gray-300 inline-block" />
                  Within range — leave as is
                </span>
              </div>
            )}
          </div>
        )
      })}

      {/* Grade editor modal */}
      {editTarget && (
        <GradeEditor
          criterionGradeId={editTarget.criterionGradeId}
          currentValue={editTarget.currentValue}
          criterionCode={editTarget.criterionCode}
          graderName={editTarget.graderName}
          onSave={handleGradeEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete assessment confirmation */}
      {deleteTarget && (
        <DeleteAssessmentConfirm
          graderName={deleteTarget.graderName}
          onConfirm={handleDeleteAssessment}
          onClose={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
