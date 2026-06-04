'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createGradebookClassAction } from '../../actions'
import type { Track } from '@prisma/client'
import { cn } from '@/lib/utils'

const TRACKS: { value: Track; label: string }[] = [
  { value: 'PILOT',   label: 'Pilot' },
  { value: 'FTE',     label: 'FTE' },
  { value: 'CSO_WSO', label: 'CSO/WSO' },
  { value: 'ABM',     label: 'ABM' },
  { value: 'RPA',     label: 'RPA' },
  { value: 'OPERATOR',label: 'Operator (STC)' },
]

interface StudentRow { name: string; track: Track }

export default function NewGradebookClassPage() {
  const router = useRouter()
  const [className, setClassName] = useState<string>('')
  const [students, setStudents] = useState<StudentRow[]>([{ name: '', track: 'PILOT' }])
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addStudent = () => setStudents((s) => [...s, { name: '', track: 'PILOT' }])
  const removeStudent = (i: number) => setStudents((s) => s.filter((_, idx) => idx !== i))
  const updateStudent = (i: number, patch: Partial<StudentRow>) =>
    setStudents((s) => s.map((st, idx) => idx === i ? { ...st, ...patch } : st))

  const parseBulk = () => {
    const rows = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed: StudentRow[] = rows.map((row) => {
      const parts = row.split(/[\t,]/).map((p) => p.trim())
      const name  = parts[0] ?? ''
      const trackRaw = (parts[1] ?? '').toUpperCase()
      const track = TRACKS.find((t) => t.value === trackRaw || t.label.toUpperCase() === trackRaw)?.value ?? 'PILOT'
      return { name, track }
    }).filter((r) => r.name)
    if (parsed.length > 0) { setStudents(parsed); setShowBulk(false) }
  }

  const handleSave = async () => {
    if (!className.trim()) { setError('Class name required.'); return }
    const valid = students.filter((s) => s.name.trim())
    if (valid.length === 0) { setError('At least one student with a name required.'); return }
    setSaving(true); setError('')
    const fd = new FormData()
    fd.append('name', className.trim())
    fd.append('students', JSON.stringify(valid))
    const res = await createGradebookClassAction(fd)
    setSaving(false)
    if ('error' in res) { setError(res.error ?? 'Unknown error'); return }
    router.push(`/admin/gradebook/classes/${res.classId}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/gradebook" className="hover:text-tps-orange">Gradebook</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">New Class</span>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-800">Class Setup</h2>
        <div>
          <label className="field-label">Class Name</label>
          <input value={className} onChange={(e) => setClassName(e.target.value)}
            placeholder="e.g. Class 26A" className="field-input" autoFocus />
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Students</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowBulk(!showBulk)} className="btn-secondary text-xs">
              {showBulk ? 'Manual entry' : '📋 Paste list'}
            </button>
            <button onClick={addStudent} className="btn-primary text-xs">+ Add Student</button>
          </div>
        </div>

        {showBulk ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              One student per line: <code className="bg-gray-100 px-1 rounded">Name, TRACK</code>
              &nbsp;— track values: PILOT, FTE, CSO_WSO, ABM, RPA, OPERATOR
            </p>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
              rows={8} placeholder={"Smith, PILOT\nJones, FTE\nDavis, CSO_WSO"}
              className="field-input font-mono text-sm resize-y" />
            <button onClick={parseBulk} disabled={!bulkText.trim()} className="btn-primary text-sm">
              Import Students
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={s.name} onChange={(e) => updateStudent(i, { name: e.target.value })}
                  placeholder="Student name or number" className="field-input flex-1 text-sm" />
                <select value={s.track} onChange={(e) => updateStudent(i, { track: e.target.value as Track })}
                  className="field-select text-sm w-36 flex-shrink-0">
                  {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {students.length > 1 && (
                  <button onClick={() => removeStudent(i)} className="text-red-400 hover:text-red-600 px-2 min-h-[44px]">×</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          {students.filter((s) => s.name.trim()).length} student{students.filter((s) => s.name.trim()).length !== 1 ? 's' : ''} —
          gradebook will be auto-generated from all active gradesheet templates matching each student&apos;s track.
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-4 text-base">
        {saving ? 'Creating class & generating gradebooks…' : 'Create Class'}
      </button>
    </div>
  )
}
