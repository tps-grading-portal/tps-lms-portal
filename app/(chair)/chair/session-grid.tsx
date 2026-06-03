'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { chairEditGradeAction, finalizeSessionAction } from './actions'
import type { SessionDisplayData } from '@/lib/session-processor'
import { cn, TRACK_LABELS } from '@/lib/utils'
import { GRADE_LABELS } from '@/lib/constants'

interface SessionGridProps {
  initialData: SessionDisplayData
  classId: string
}

// ── Grade cell color by value ─────────────────────────────────────────────────
const gradeBg = (v: number) => {
  if (v === 8) return 'bg-red-200 text-red-900 font-bold'
  if (v <= 2)  return 'bg-emerald-100 text-emerald-900'
  if (v === 3) return 'bg-green-100 text-green-800'
  if (v === 4) return 'bg-gray-100 text-gray-700'
  if (v <= 6)  return 'bg-amber-100 text-amber-800'
  return 'bg-orange-200 text-orange-900'
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'OPEN':               return 'bg-gray-100 text-gray-600'
    case 'PENDING_RESOLUTION': return 'bg-amber-100 text-amber-800 font-semibold'
    case 'READY_TO_FINALIZE':  return 'bg-green-100 text-green-800 font-semibold'
    case 'FINALIZED':          return 'bg-blue-100 text-blue-800'
    default:                   return 'bg-gray-100 text-gray-600'
  }
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'OPEN':               return 'Waiting for graders'
    case 'PENDING_RESOLUTION': return '⚠ Discontinuities'
    case 'READY_TO_FINALIZE':  return '✓ Ready to Finalize'
    case 'FINALIZED':          return '✓ Finalized'
    default:                   return status
  }
}

// ── Grade Editor popover ──────────────────────────────────────────────────────
function GradeEditor({
  criterionGradeId,
  currentValue,
  onSave,
  onClose,
}: {
  criterionGradeId: string
  currentValue: number
  onSave: (id: string, val: number) => Promise<void>
  onClose: () => void
}) {
  const [selected, setSelected] = useState(currentValue)
  const [saving, setSaving] = useState(false)

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
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-800">Adjust Grade</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl min-h-[44px] min-w-[44px] flex items-center justify-center">×</button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {([1,2,3,4,5,6,7,8] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setSelected(val)}
              className={cn(
                'rounded-lg border-2 p-2 flex flex-col items-center min-h-[52px] transition-all active:scale-95',
                selected === val
                  ? 'border-tps-blue bg-tps-blue text-white ring-2 ring-tps-blue ring-offset-1'
                  : 'border-gray-200 text-gray-700 hover:border-gray-400',
              )}
            >
              <span className="font-bold text-lg leading-none">{val}</span>
              {val === 8 && <span className="text-[9px] leading-none mt-0.5">Fail</span>}
              {val === 1 && <span className="text-[9px] leading-none mt-0.5">WAA</span>}
              {val === 4 && <span className="text-[9px] leading-none mt-0.5">Avg</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 text-sm"
          >
            {saving ? 'Saving…' : 'Save Grade'}
          </button>
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-2">
          Edit will be logged as Panel Chair adjustment
        </p>
      </div>
    </div>
  )
}

// ── Main session grid ─────────────────────────────────────────────────────────
export function SessionGrid({ initialData, classId }: SessionGridProps) {
  const [data, setData] = useState<SessionDisplayData>(initialData)
  const [editTarget, setEditTarget] = useState<{
    criterionGradeId: string
    currentValue: number
    criterionCode: string
    graderName: string
  } | null>(null)
  const [, startTransition] = useTransition()
  const eventSourceRef = useRef<EventSource | null>(null)

  // ── SSE connection ────────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`/api/events?classId=${classId}`)
      eventSourceRef.current = es

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as SessionDisplayData
          if (parsed.sessions && parsed.criteria) {
            setData(parsed)
          }
        } catch {
          // Skip malformed events
        }
      }

      es.onerror = () => {
        es.close()
        // Reconnect after 5s
        setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [classId])

  // ── Grade edit handler ────────────────────────────────────────────────────────
  const handleGradeEdit = async (criterionGradeId: string, newValue: number) => {
    const result = await chairEditGradeAction(criterionGradeId, newValue)
    if ('success' in result && result.success) {
      // Optimistic update — don't wait for next SSE poll
      startTransition(() => setData(result.data))
    }
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
        const graders = session.assessments
        const hasDisc = session.status === 'PENDING_RESOLUTION'

        // No workaround needed — getSessionDisplayData now includes grade.id

        return (
          <div key={session.id} className="card border border-gray-200 overflow-hidden p-0">
            {/* Session header */}
            <div className={cn(
              'px-4 py-3 border-b flex items-start justify-between gap-3',
              hasDisc ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200',
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
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusBadge(session.status))}>
                    {statusLabel(session.status)}
                  </span>
                  {session.finalScore !== null && (
                    <span className={cn(
                      'text-sm font-bold',
                      session.hasFail ? 'text-red-600' : 'text-green-700',
                    )}>
                      {session.hasFail ? '⚠ FAIL' : `${session.finalScore.toFixed(2)}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 items-start">
                {session.status === 'READY_TO_FINALIZE' && (
                  <button
                    onClick={async () => {
                      await finalizeSessionAction(session.id)
                    }}
                    className="btn-primary text-xs py-2"
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
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[130px] sticky left-0 bg-gray-50 z-10">
                      Criterion
                    </th>
                    {graders.map((a) => (
                      <th key={a.id} className="px-2 py-2 font-semibold text-gray-600 border-b border-gray-200 text-center min-w-[60px]">
                        <span className="truncate block max-w-[70px]">{a.staffMember.name}</span>
                        {a.weightedSum !== null && (
                          <span className={cn(
                            'block text-[10px] font-normal mt-0.5',
                            a.hasFail ? 'text-red-600' : 'text-gray-500',
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
                    const rowGrades = graders.map((a) => {
                      const g = a.grades.find((g) => g.criterionId === criterion.id)
                      return { assessmentId: a.id, graderName: a.staffMember.name, grade: g }
                    })
                    const rowHasDisc = rowGrades.some((r) => r.grade?.isDiscontinuity)

                    return (
                      <tr
                        key={criterion.id}
                        className={cn(
                          rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                          rowHasDisc && 'bg-amber-50',
                        )}
                      >
                        {/* Criterion label — sticky left */}
                        <td className={cn(
                          'px-3 py-2 border-r border-gray-200 sticky left-0 z-10',
                          rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                          rowHasDisc && 'bg-amber-50',
                        )}>
                          <span className="font-bold text-tps-blue">{criterion.code}</span>
                          <span className="text-gray-500 ml-1 hidden sm:inline">
                            {criterion.name.split(' ').slice(0, 2).join(' ')}
                          </span>
                          {rowHasDisc && (
                            <span className="ml-1 text-amber-600">⚠</span>
                          )}
                        </td>

                        {/* Grade cells */}
                        {rowGrades.map(({ assessmentId, graderName, grade }) => {
                          if (!grade) {
                            return (
                              <td key={assessmentId}
                                  className="px-2 py-2 text-center border-gray-100 border">
                                <span className="text-gray-300">—</span>
                              </td>
                            )
                          }

                          const isDisc = grade.isDiscontinuity
                          const wasEdited = grade.editedBy === 'PANEL_CHAIR'

                          return (
                            <td
                              key={assessmentId}
                              className={cn(
                                'px-1 py-1 text-center border border-gray-100',
                                isDisc ? 'bg-grade-discontinuity' : gradeBg(grade.gradeValue),
                              )}
                            >
                              <GradeCellButton
                                value={grade.gradeValue}
                                isDiscontinuity={isDisc}
                                wasEdited={wasEdited}
                                onClick={() =>
                                  setEditTarget({
                                    criterionGradeId: grade.id,
                                    currentValue: grade.gradeValue,
                                    criterionCode: criterion.code,
                                    graderName,
                                  })
                                }
                              />
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
                ⚠ Highlighted cells differ by more than 2 points. Discuss with panel to resolve.
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
          onSave={handleGradeEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}

function GradeCellButton({
  value,
  isDiscontinuity,
  wasEdited,
  onClick,
}: {
  value: number
  isDiscontinuity: boolean
  wasEdited: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded text-sm font-bold min-h-[36px] transition-all active:scale-95 relative',
        isDiscontinuity
          ? 'text-amber-900 hover:bg-amber-300'
          : value === 8
          ? 'text-red-700 hover:bg-red-300'
          : 'hover:opacity-75',
      )}
      title={`${GRADE_LABELS[value]} — tap to edit`}
    >
      {value}
      {wasEdited && (
        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-purple-500 rounded-full" title="Chair edited" />
      )}
    </button>
  )
}
