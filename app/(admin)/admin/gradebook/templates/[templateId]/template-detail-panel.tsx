'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateTemplateAction } from '../../actions'
import { GradesheetPreviewForm } from './gradesheet-preview-form'
import { TemplateEditor } from './template-editor'
import { cn } from '@/lib/utils'
import type { GradesheetTemplate, GradesheetTask } from '@prisma/client'

type FullTemplate = GradesheetTemplate & { tasks: GradesheetTask[]; _count: { entries: number } }

const TRACK_SHORT: Record<string, string> = {
  PILOT: 'Pilot', FTE: 'FTE', CSO_WSO: 'CSO/WSO', ABM: 'ABM', RPA: 'RPA', OPERATOR: 'Operator',
}

const TYPE_LABEL: Record<string, string> = {
  FLIGHT: '✈ Flight', REPORT: '📄 Report', ORAL: '🎤 Oral', SIM: '🖥 Sim', CONTROL_ROOM: '🎛 Control Room',
}

type Tab = 'view' | 'preview' | 'edit'

export function TemplateDetailPanel({
  template, initialTab,
}: {
  template:   FullTemplate
  initialTab: Tab
}) {
  const router = useRouter()
  const [tab,        setTab]        = useState<Tab>(initialTab)
  const [duplicating, setDuplicating] = useState(false)

  const handleDuplicate = async () => {
    setDuplicating(true)
    const res = await duplicateTemplateAction(template.id)
    setDuplicating(false)
    if ('templateId' in res) {
      router.push(`/admin/gradebook/templates/${res.templateId}?tab=edit`)
    }
  }

  // Group tasks by section for view tab
  const sections = new Map<string, GradesheetTask[]>()
  for (const t of template.tasks) {
    const key = t.sectionLabel ?? 'General'
    if (!sections.has(key)) sections.set(key, [])
    sections.get(key)!.push(t)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card border border-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-tps-navy">{template.courseCode}</h1>
            <p className="text-sm text-gray-600 mt-0.5">{template.title}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{TYPE_LABEL[template.type]}</span>
              {template.tracks.map((tr) => (
                <span key={tr} className="text-xs bg-tps-navy text-white px-2 py-0.5 rounded-full font-medium">
                  {TRACK_SHORT[tr] ?? tr}
                </span>
              ))}
              {template.airmanshipPct > 0 && (
                <span className="text-xs bg-orange-100 text-tps-orange px-2 py-0.5 rounded-full font-medium">
                  AM: {(template.airmanshipPct * 100).toFixed(0)}%
                </span>
              )}
              <span className="text-xs text-gray-400">{template.tasks.length} tasks</span>
              <span className="text-xs text-gray-400">{template._count.entries} entries</span>
              {!template.isActive && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Archived</span>}
            </div>
          </div>
          <button onClick={handleDuplicate} disabled={duplicating} className="btn-secondary text-sm flex-shrink-0">
            {duplicating ? '…' : '⎘ Duplicate'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 gap-1">
        {(['view', 'preview', 'edit'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t
                ? 'border-tps-orange text-tps-orange'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            )}>
            {t === 'view' ? '📋 Tasks' : t === 'preview' ? '▶ Preview' : '✏ Edit'}
          </button>
        ))}
      </div>

      {/* View tab — task table */}
      {tab === 'view' && (
        <div className="space-y-4">
          {Array.from(sections.entries()).map(([section, tasks]) => (
            <div key={section} className="card border border-gray-200 overflow-hidden p-0">
              <div className={cn('px-4 py-2 text-xs font-bold uppercase tracking-wide',
                tasks[0]?.isAirmanship ? 'bg-orange-50 text-tps-orange' : 'bg-gray-50 text-gray-500'
              )}>
                {tasks[0]?.isAirmanship ? '✈ ' : ''}{section}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="text-left px-4 py-2 font-medium">Task</th>
                    <th className="text-center px-2 py-2 font-medium w-16">Min</th>
                    <th className="text-center px-2 py-2 font-medium w-16">Desired</th>
                    <th className="text-center px-2 py-2 font-medium w-16">Weight</th>
                    <th className="text-center px-2 py-2 font-medium w-16"># Req</th>
                    <th className="text-center px-2 py-2 font-medium w-16">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className={cn('border-b border-gray-50 last:border-0',
                      t.isBonus ? 'bg-amber-50' : t.isDemo ? 'bg-gray-50' : ''
                    )}>
                      <td className="px-4 py-2 text-gray-800">{t.label}</td>
                      <td className="px-2 py-2 text-center font-mono text-gray-600">
                        {t.isDemo ? '—' : <>{t.minScore ?? '—'}{t.minScoreHard ? <span className="text-red-500">*</span> : ''}</>}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-gray-600">
                        {t.isDemo ? '—' : (t.desiredScore ?? '—')}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-gray-600">
                        {t.weight > 0 ? `${(t.weight * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-gray-600">{t.numberRequired}</td>
                      <td className="px-2 py-2 text-center text-[10px]">
                        {t.isBonus && <span className="bg-amber-200 text-amber-800 px-1 rounded">Bonus</span>}
                        {t.isDemo  && <span className="bg-gray-200 text-gray-600 px-1 rounded">Demo</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {template.tasks.length === 0 && (
            <div className="card border border-dashed border-gray-200 text-center py-8">
              <p className="text-gray-400">No tasks defined yet.</p>
              <button onClick={() => setTab('edit')} className="text-tps-orange text-sm hover:underline mt-2">
                Open editor to add tasks →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview tab */}
      {tab === 'preview' && <GradesheetPreviewForm tasks={template.tasks} />}

      {/* Edit tab */}
      {tab === 'edit' && <TemplateEditor template={template} />}
    </div>
  )
}
