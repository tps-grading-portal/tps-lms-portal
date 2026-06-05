'use client'

import { useState } from 'react'
import Link from 'next/link'
import { setupGradebookForClassAction } from './actions'
import { studentLabel } from '@/lib/student-display'
import { cn } from '@/lib/utils'

interface Student {
  id:      string
  number:  number
  track:   string
  entries: { status: string; overallPass: boolean | null }[]
}

interface Cls {
  id:       string
  name:     string
  isActive: boolean
  students: Student[]
}

export function GradebookClassPanel({ cls }: { cls: Cls }) {
  const [setting, setSetting] = useState(false)
  const [done,    setDone]    = useState(false)

  const totalStudents = cls.students.length
  const hasEntries    = cls.students.some((s) => s.entries.length > 0)
  const submitted     = cls.students.reduce((sum, s) => sum + s.entries.filter((e) => e.status === 'SUBMITTED').length, 0)
  const totalEntries  = cls.students.reduce((sum, s) => sum + s.entries.length, 0)
  const fails         = cls.students.reduce((sum, s) => sum + s.entries.filter((e) => e.overallPass === false).length, 0)

  const handleSetup = async () => {
    setSetting(true)
    await setupGradebookForClassAction(cls.id)
    setSetting(false)
    setDone(true)
    window.location.reload()
  }

  return (
    <div className="card border border-gray-200 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-tps-navy">{cls.name}</h2>
          <div className="flex gap-3 text-xs text-gray-500 mt-1">
            <span>{totalStudents} student{totalStudents !== 1 ? 's' : ''}</span>
            {hasEntries && <><span>·</span><span>{submitted}/{totalEntries} gradesheets submitted</span></>}
            {fails > 0  && <><span>·</span><span className="text-red-600 font-medium">{fails} fail{fails !== 1 ? 's' : ''}</span></>}
          </div>
        </div>
        <div className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
          cls.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        )}>
          {cls.isActive ? 'Active' : 'Inactive'}
        </div>
      </div>

      {!hasEntries ? (
        /* Class exists but gradebook not set up yet */
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center space-y-3">
          <p className="text-sm text-gray-500">Gradebook not set up for this class.</p>
          <p className="text-xs text-gray-400">
            Clicking below will generate gradesheet entries for all {totalStudents} student{totalStudents !== 1 ? 's' : ''} based on their tracks and active templates.
          </p>
          <button onClick={handleSetup} disabled={setting || done} className="btn-primary text-sm">
            {setting ? 'Setting up…' : done ? 'Done — refresh to see' : 'Set Up Gradebook'}
          </button>
        </div>
      ) : (
        /* Gradebook is live — show student grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {cls.students.map((student) => {
            const done    = student.entries.filter((e) => e.status === 'SUBMITTED').length
            const total   = student.entries.length
            const hasFail = student.entries.some((e) => e.overallPass === false)
            return (
              <Link
                key={student.id}
                href={`/admin/gradebook/classes/${cls.id}/${student.id}`}
                className={cn(
                  'rounded-lg border px-3 py-2 hover:border-tps-orange transition-colors',
                  hasFail ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white',
                )}
              >
                <p className="font-semibold text-sm text-tps-navy">{studentLabel(cls.name, student.number)}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{student.track.replace('_', '/')}</p>
                <p className={cn('text-xs mt-1 font-medium', done === total && total > 0 ? 'text-green-600' : 'text-gray-500')}>
                  {total === 0 ? 'No entries' : `${done}/${total} done`}{hasFail ? ' !' : ''}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
