'use client'

import { useState, useTransition } from 'react'
import {
  adminEditGradeAction,
  adminFinalizeSessionAction,
  reopenSessionAction,
  adminDeleteEmptySessionAction,
  getAdminSessionData,
} from './actions'
import { cn, TRACK_LABELS } from '@/lib/utils'
import { GRADE_LABELS } from '@/lib/constants'

// ── Same 3-state cell coloring as Chair dashboard ─────────────────────────────
function cellClass(gradeValue: number, isDiscontinuity: boolean, rowHasDisc: boolean, sessionStatus: string): string {
  if (sessionStatus === 'OPEN') {
    if (gradeValue === 8)  return 'bg-red-100 text-red-700 font-bold'
    if (gradeValue <= 2)   return 'bg-emerald-100 text-emerald-900'
    if (gradeValue === 4)  return 'bg-gray-100 text-gray-700'
    if (gradeValue <= 6)   return 'bg-amber-100 text-amber-800'
    return 'bg-orange-200 text-orange-900'
  }
  if (sessionStatus === 'PENDING_RESOLUTION') {
    if (rowHasDisc) {
      return isDiscontinuity
        ? 'bg-amber-300 text-amber-900 font-bold'
        : 'bg-gray-100 text-gray-400'
    }
  }
  return gradeValue === 8
    ? 'bg-red-100 text-red-700 font-bold'
    : 'bg-green-100 text-green-800'
}

type SessionData   = Awaited<ReturnType<typeof getAdminSessionData>>
type SessionRow    = SessionData['sessions'][number]
type CriterionRow  = SessionData['criteria'][number]

interface Props {
  initialData: SessionData
  classId:     string
}

// ── Grade cell colours ────────────────────────────────────────────────────────
const gradeBg = (v: number) => {
  if (v === 8)  return 'bg-red-200 text-red-900 font-bold'
  if (v <= 2)   return 'bg-emerald-100 text-emerald-900'
  if (v === 3)  return 'bg-green-100 text-green-800'
  if (v === 4)  return 'bg-gray-100 text-gray-700'
  if (v <= 6)   return 'bg-amber-100 text-amber-800'
  return 'bg-orange-200 text-orange-900'
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'FINALIZED':          return { text: '✓ Finalized',        cls: 'bg-blue-100 text-blue-800' }
    case 'READY_TO_FINALIZE':  return { text: '✓ Ready',            cls: 'bg-green-100 text-green-800 font-semibold' }
    case 'PENDING_RESOLUTION': return { text: '⚠ Discontinuities', cls: 'bg-amber-100 text-amber-800 font-semibold' }
    default:                   return { text: status,               cls: 'bg-gray-100 text-gray-600' }
  }
}

// ── Inline grade editor (bottom sheet) ───────────────────────────────────────
function GradeEditor({
  criterionGradeId, currentValue, criterionCode, graderName, onSave, onClose,
}: {
  criterionGradeId: string
  currentValue:     number
  criterionCode:    string
  graderName:       string
  onSave:           (id: string, val: number) => Promise<void>
  onClose:          () => void
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-gray-800">Adjust Grade</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">×</button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {criterionCode} · {graderName}
        </p>

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
            {saving ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          Adjustment logged with original value preserved
        </p>
      </div>
    </div>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────
export function AdminSessionGrid({ initialData, classId }: Props) {
  const [data,        setData]        = useState<SessionData>(initialData)
  const [editTarget,  setEditTarget]  = useState<{
    criterionGradeId: string
    currentValue:     number
    criterionCode:    string
    graderName:       string
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [,            startT]         = useTransition()

  const { sessions, criteria } = data

  const refresh = (newData: SessionData) =>
    startT(() => setData(newData))

  const handleEdit = async (criterionGradeId: string, newValue: number) => {
    const result = await adminEditGradeAction(criterionGradeId, newValue, classId)
    if ('success' in result) refresh(result.data)
    else setActionError(result.error)
  }

  const handleReopen = async (sessionId: string) => {
    const result = await reopenSessionAction(sessionId)
    if (result.error) { setActionError(result.error); return }
    // Use the already-imported function — not a dynamic import (which was unreliable)
    const fresh = await getAdminSessionData(classId)
    refresh(fresh)
  }

  const handleFinalize = async (sessionId: string) => {
    const result = await adminFinalizeSessionAction(sessionId, classId)
    if ('success' in result) refresh(result.data)
    else setActionError(result.error)
  }

  const [deleteEmptyTarget, setDeleteEmptyTarget] = useState<string | null>(null)
  const [deletingEmpty,     setDeletingEmpty]     = useState(false)

  const handleDeleteEmptySession = async () => {
    if (!deleteEmptyTarget) return
    setDeletingEmpty(true)
    const result = await adminDeleteEmptySessionAction(deleteEmptyTarget, classId)
    if ('success' in result) refresh(result.data)
    else setActionError(result.error)
    setDeletingEmpty(false)
    setDeleteEmptyTarget(null)
  }

  if (sessions.length === 0) {
    return (
      <div className="card text-center py-16 text-gray-400">
        <p className="text-lg font-medium">No sessions yet for this class</p>
        <p className="text-sm mt-1">Sessions appear here once graders have submitted grades.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="card border border-red-300 bg-red-50 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 font-bold">×</button>
        </div>
      )}

      {sessions.map((session) => {
        const badge    = statusLabel(session.status)
        const hasDisc  = session.status === 'PENDING_RESOLUTION'
        const isLocked = session.status === 'FINALIZED'
        const isReady  = session.status === 'READY_TO_FINALIZE'

        return (
          <div key={session.id}
            className={cn(
              'card border overflow-hidden p-0',
              hasDisc  ? 'border-amber-300' :
              isReady  ? 'border-green-300' :
              isLocked ? 'border-blue-200'  :
              'border-gray-200',
            )}>

            {/* Session header */}
            <div className={cn(
              'px-4 py-3 border-b flex items-start justify-between gap-3 flex-wrap',
              hasDisc  ? 'bg-amber-50  border-amber-200'  :
              isReady  ? 'bg-green-50  border-green-200'  :
              isLocked ? 'bg-blue-50   border-blue-100'   :
              'bg-gray-50 border-gray-200',
            )}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-tps-navy font-mono">Student {session.student.number}</span>
                  <span className="text-xs text-gray-500">
                    {TRACK_LABELS[session.student.track] ?? session.student.track}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{session.scenario.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', badge.cls)}>
                    {badge.text}
                  </span>
                  {session.finalScore !== null && (
                    <span className={cn('text-sm font-bold',
                      session.hasFail ? 'text-red-600' : 'text-green-700'
                    )}>
                      {session.hasFail ? '⚠ FAIL (69)' : session.finalScore.toFixed(2)}
                    </span>
                  )}
                  {session.finalizedAt && (
                    <span className="text-xs text-gray-400">
                      Finalized {new Date(session.finalizedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action button */}
              <div className="flex gap-2 flex-shrink-0">
                {/* Empty session — no grader assessments — offer to delete */}
                {session.assessments.length === 0 && (
                  <button
                    onClick={() => setDeleteEmptyTarget(session.id)}
                    className="text-sm py-2 px-3 rounded-lg font-semibold min-h-[44px] bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
                  >
                    Remove empty card
                  </button>
                )}
                {isLocked && session.assessments.length > 0 && (
                  <button
                    onClick={() => handleReopen(session.id)}
                    className="btn-secondary text-sm border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    Adjust
                  </button>
                )}
                {isReady && (
                  <button
                    onClick={() => handleFinalize(session.id)}
                    className="btn-primary text-sm"
                  >
                    Re-finalize
                  </button>
                )}
                {hasDisc && (
                  <span className="text-xs text-amber-700 self-center">
                    Resolve splits to re-finalize
                  </span>
                )}
              </div>
            </div>

            {/* Grade grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[130px] sticky left-0 bg-gray-50 z-10">
                      Criterion
                    </th>
                    {session.assessments.map((a) => (
                      <th key={a.id} className="px-2 py-2 font-semibold text-gray-600 border-b border-gray-200 text-center min-w-[60px]">
                        <span className="block truncate max-w-[70px]">{a.staffMember.name}</span>
                        {a.weightedSum !== null && (
                          <span className={cn('block text-[10px] font-normal mt-0.5',
                            a.hasFail ? 'text-red-600' : 'text-gray-500'
                          )}>
                            {a.hasFail ? 'FAIL' : a.weightedSum.toFixed(1)}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((criterion, rowIndex) => {
                    const rowGrades = session.assessments.map((a) => ({
                      assessmentId: a.id,
                      graderName:   a.staffMember.name,
                      grade:        a.grades.find((g) => g.criterionId === criterion.id),
                    }))
                    const rowHasDisc = rowGrades.some((r) => r.grade?.isDiscontinuity)

                    const rowHasFail = rowGrades.some((r) => r.grade?.gradeValue === 8)

                    return (
                      <tr key={criterion.id} className="bg-white">
                        {/* Criterion label — sticky, full name */}
                        <td className={cn(
                          'px-3 py-2 border-r border-gray-100 sticky left-0 z-10 transition-colors',
                          rowHasDisc ? 'bg-white' : rowHasFail ? 'bg-red-50' : 'bg-green-50',
                        )}>
                          <span className="font-bold text-tps-blue text-xs">{criterion.code}</span>
                          <span className="text-gray-600 ml-1.5 text-xs leading-snug">{criterion.name}</span>
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

                          const isDisc    = grade.isDiscontinuity
                          const wasEdited = grade.editedBy === 'PANEL_CHAIR'
                          const canEdit   = !isLocked

                          return (
                            <td key={assessmentId}
                              className={cn(
                                'px-1 py-1 text-center border border-gray-100 transition-colors',
                                cellClass(grade.gradeValue, isDisc, rowHasDisc, session.status),
                              )}>
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => canEdit && setEditTarget({
                                  criterionGradeId: grade.id,
                                  currentValue:     grade.gradeValue,
                                  criterionCode:    criterion.code,
                                  graderName,
                                })}
                                className={cn(
                                  'w-full rounded text-sm font-bold min-h-[36px] transition-all relative',
                                  canEdit ? 'hover:opacity-75 active:scale-95 cursor-pointer' : 'cursor-default',
                                )}
                                title={canEdit
                                  ? `${GRADE_LABELS[grade.gradeValue]} — click to adjust`
                                  : `${GRADE_LABELS[grade.gradeValue]} — click Adjust to unlock`
                                }
                              >
                                {grade.gradeValue}
                                {/* Dot indicator if this grade was manually edited */}
                                {wasEdited && (
                                  <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-purple-500 rounded-full"
                                        title="Manually adjusted" />
                                )}
                                {/* Show original value tooltip if changed */}
                                {grade.originalValue !== null &&
                                 grade.originalValue !== undefined &&
                                 grade.originalValue !== grade.gradeValue && (
                                  <span className="absolute bottom-0 left-0 text-[8px] text-gray-500 leading-none px-0.5"
                                        title={`Original: ${grade.originalValue}`}>
                                    was {grade.originalValue}
                                  </span>
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

            {/* Discontinuity legend */}
            {hasDisc && (
              <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
                ⚠ Highlighted cells differ by more than 2 points. Adjust grades to resolve, then Re-finalize.
              </div>
            )}

            {/* Locked hint */}
            {isLocked && (
              <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 text-xs text-blue-600">
                Click <strong>Adjust</strong> to unlock this session for grade editing.
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
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete empty session confirmation */}
      {deleteEmptyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
             onClick={() => setDeleteEmptyTarget(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4"
               onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-semibold text-gray-800">Remove this empty grade card?</p>
              <p className="text-sm text-gray-500 mt-1">
                This session has no grader scores. Removing it will permanently delete the card.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteEmptyTarget(null)} className="btn-secondary flex-1 text-sm">
                Cancel
              </button>
              <button onClick={handleDeleteEmptySession} disabled={deletingEmpty} className="btn-danger flex-1 text-sm">
                {deletingEmpty ? 'Removing…' : 'Remove Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
