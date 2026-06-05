'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveTemplateAction } from '../../actions'
import { cn } from '@/lib/utils'
import type { GradesheetTemplate, GradesheetTask, Track, GradesheetType } from '@prisma/client'

type FullTemplate = GradesheetTemplate & { tasks: GradesheetTask[] }

const TRACKS: { value: Track; label: string }[] = [
  { value: 'PILOT',    label: 'Pilot' },
  { value: 'FTE',      label: 'FTE' },
  { value: 'CSO_WSO',  label: 'CSO/WSO' },
  { value: 'ABM',      label: 'ABM' },
  { value: 'RPA',      label: 'RPA' },
  { value: 'OPERATOR', label: 'Operator (STC)' },
]

const TYPES: { value: GradesheetType; label: string }[] = [
  { value: 'FLIGHT',       label: 'Flight' },
  { value: 'REPORT',       label: 'Report' },
  { value: 'ORAL',         label: 'Oral' },
  { value: 'SIM',          label: 'Sim' },
  { value: 'CONTROL_ROOM', label: 'Control Room' },
]

interface TaskDraft {
  id?:           string
  label:         string
  section:       string
  isAirmanship:  boolean
  isBonus:       boolean
  isDemo:        boolean
  minScore:      string
  minScoreHard:  boolean
  desiredScore:  string
  weight:        string
  numberRequired: string
}

function taskTosDraft(t: GradesheetTask): TaskDraft {
  return {
    id:            t.id,
    label:         t.label,
    section:       t.sectionLabel ?? '',
    isAirmanship:  t.isAirmanship,
    isBonus:       t.isBonus,
    isDemo:        t.isDemo,
    minScore:      t.minScore !== null ? String(t.minScore) : '',
    minScoreHard:  t.minScoreHard,
    desiredScore:  t.desiredScore !== null ? String(t.desiredScore) : '',
    weight:        t.weight > 0 ? String(parseFloat((t.weight * 100).toFixed(3))) : '0',
    numberRequired: String(t.numberRequired),
  }
}

const emptyTask = (): TaskDraft => ({
  label: '', section: '', isAirmanship: false, isBonus: false, isDemo: false,
  minScore: '2', minScoreHard: true, desiredScore: '3', weight: '0', numberRequired: '1',
})

export function TemplateEditor({ template }: { template: FullTemplate }) {
  const router = useRouter()

  const [courseCode,    setCourseCode]    = useState(template.courseCode)
  const [title,         setTitle]         = useState(template.title)
  const [type,          setType]          = useState<GradesheetType>(template.type)
  const [tracks,        setTracks]        = useState<Track[]>(template.tracks)
  const [airmanshipPct, setAirmanshipPct] = useState(String(parseFloat((template.airmanshipPct * 100).toFixed(1))))
  const [tasks,         setTasks]         = useState<TaskDraft[]>(template.tasks.map(taskTosDraft))
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  const toggleTrack = (t: Track) =>
    setTracks((ts) => ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t])

  const addTask    = () => setTasks((ts) => [...ts, emptyTask()])
  const removeTask = (i: number) => setTasks((ts) => ts.filter((_, idx) => idx !== i))
  const updateTask = (i: number, patch: Partial<TaskDraft>) =>
    setTasks((ts) => ts.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  const moveTask   = (i: number, dir: -1 | 1) => setTasks((ts) => {
    const next = [...ts]; const j = i + dir
    if (j < 0 || j >= next.length) return ts
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  const totalWeight = tasks.reduce((s, t) => s + (parseFloat(t.weight) || 0), 0)
  const weightsOk   = Math.abs(totalWeight - 100) < 0.5

  const handleSave = async () => {
    if (!courseCode.trim()) { setError('Course code required.'); return }
    if (!title.trim())      { setError('Title required.'); return }
    if (tracks.length === 0){ setError('Select at least one track.'); return }
    setSaving(true); setError('')
    const res = await saveTemplateAction({
      templateId:   template.id,
      courseCode:   courseCode.trim(),
      title:        title.trim(),
      type,
      tracks,
      airmanshipPct: parseFloat(airmanshipPct) / 100 || 0,
      tasks: tasks.map((t, i) => ({
        id:            t.id,
        sortOrder:     i,
        label:         t.label,
        sectionLabel:  t.section || null,
        isAirmanship:  t.isAirmanship,
        isBonus:       t.isBonus,
        isDemo:        t.isDemo,
        minScore:      t.isDemo ? null : (parseInt(t.minScore) ?? null),
        minScoreHard:  t.minScoreHard,
        desiredScore:  t.isDemo ? null : (parseInt(t.desiredScore) ?? null),
        weight:        parseFloat(t.weight) / 100 || 0,
        numberRequired: parseInt(t.numberRequired) || 1,
      })),
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    router.refresh()
    router.push(`/admin/gradebook/templates/${template.id}`)
  }

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="card border border-gray-200 space-y-4">
        <h3 className="font-semibold text-gray-800">Template Settings</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Course Code</label>
            <input value={courseCode} onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g. PF 6121F" className="field-input font-mono" />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as GradesheetType)} className="field-select">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. T-38 Low L/D Flight" className="field-input" />
        </div>
        <div>
          <label className="field-label">Applicable Tracks</label>
          <div className="flex flex-wrap gap-2">
            {TRACKS.map((t) => (
              <button key={t.value} type="button"
                onClick={() => toggleTrack(t.value)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  tracks.includes(t.value)
                    ? 'bg-tps-navy text-white border-tps-navy'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-w-xs">
          <label className="field-label">Airmanship % of total</label>
          <input type="number" value={airmanshipPct} onChange={(e) => setAirmanshipPct(e.target.value)}
            min={0} max={100} className="field-input w-24 font-mono" placeholder="20" />
        </div>
      </div>

      {/* Tasks */}
      <div className="card border border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Tasks ({tasks.length})</h3>
            <p className={cn('text-xs mt-0.5', weightsOk ? 'text-green-600' : 'text-red-600')}>
              Weights total: {totalWeight.toFixed(1)}% {weightsOk ? '✓' : '⚠ should equal 100%'}
            </p>
          </div>
          <button onClick={addTask} className="btn-primary text-xs">+ Add Task</button>
        </div>

        <div className="space-y-2">
          {tasks.map((t, i) => (
            <div key={i} className={cn('rounded-xl border p-3 space-y-3',
              t.isAirmanship ? 'border-orange-200 bg-orange-50' :
              t.isBonus      ? 'border-amber-100 bg-amber-50' :
              t.isDemo       ? 'border-gray-100 bg-gray-50' :
              'border-gray-200'
            )}>
              {/* Row 1: label + flags */}
              <div className="flex gap-2 items-start">
                <div className="flex gap-1 flex-col flex-shrink-0 mt-1">
                  <button onClick={() => moveTask(i, -1)} disabled={i === 0}
                    className="text-[10px] text-gray-300 hover:text-gray-500 leading-none">▲</button>
                  <button onClick={() => moveTask(i, 1)} disabled={i === tasks.length - 1}
                    className="text-[10px] text-gray-300 hover:text-gray-500 leading-none">▼</button>
                </div>
                <input value={t.label} onChange={(e) => updateTask(i, { label: e.target.value })}
                  placeholder="Task label *" className="field-input flex-1 text-sm" />
                <input value={t.section} onChange={(e) => updateTask(i, { section: e.target.value })}
                  placeholder="Section header" className="field-input w-36 text-xs flex-shrink-0" />
                <button onClick={() => removeTask(i)} className="text-red-400 hover:text-red-600 px-1 flex-shrink-0">×</button>
              </div>

              {/* Row 2: flags + scoring */}
              <div className="flex flex-wrap gap-3 items-center pl-6">
                {/* Flag toggles */}
                {(['isAirmanship', 'isBonus', 'isDemo'] as const).map((flag) => (
                  <label key={flag} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={t[flag]}
                      onChange={(e) => updateTask(i, { [flag]: e.target.checked })}
                      className="h-3 w-3" />
                    {flag === 'isAirmanship' ? 'Airmanship' : flag === 'isBonus' ? 'Bonus' : 'Demo (not graded)'}
                  </label>
                ))}

                {!t.isDemo && (
                  <>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Min:</label>
                      <input type="number" value={t.minScore}
                        onChange={(e) => updateTask(i, { minScore: e.target.value })}
                        min={0} max={4} className="field-input w-12 text-center text-xs font-mono" />
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={t.minScoreHard}
                          onChange={(e) => updateTask(i, { minScoreHard: e.target.checked })}
                          className="h-3 w-3" />
                        *
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Desired:</label>
                      <input type="number" value={t.desiredScore}
                        onChange={(e) => updateTask(i, { desiredScore: e.target.value })}
                        min={0} max={4} className="field-input w-12 text-center text-xs font-mono" />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Weight %:</label>
                      <input type="number" value={t.weight}
                        onChange={(e) => updateTask(i, { weight: e.target.value })}
                        min={0} max={100} step={0.1} className="field-input w-16 text-center text-xs font-mono" />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500"># Req:</label>
                      <input type="number" value={t.numberRequired}
                        onChange={(e) => updateTask(i, { numberRequired: e.target.value })}
                        min={0} max={99} className="field-input w-12 text-center text-xs font-mono" />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No tasks yet. Click &quot;+ Add Task&quot;.</p>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="sticky bottom-4">
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-4 text-base shadow-lg">
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}
