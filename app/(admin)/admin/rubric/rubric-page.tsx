import { db } from '@/lib/db'
import { CriterionEditor } from './criterion-editor'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rubric' }

export async function RubricPage() {
  // ── Template criteria (classId = null) — the live editable version ────────
  const templateCriteria = await db.criterion.findMany({
    where:   { classId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  // ── Class snapshots — read-only history, one per class ────────────────────
  const classSnapshots = await db.class.findMany({
    where:   { criteria: { some: {} } },  // only classes that have a snapshot
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select: {
      id:        true,
      name:      true,
      isActive:  true,
      createdAt: true,
      criteria: {
        where:   { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select:  { id: true, code: true, name: true, weight: true, pillar: true },
      },
    },
  })

  const totalWeight = templateCriteria.reduce((s, c) => s + c.weight, 0)

  return (
    <div className="space-y-10">
      {/* ── Live editable template ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-tps-navy">Rubric</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              The <strong>global template</strong> — edit here to update the criteria for all
              future classes. Changes do not affect classes that have already been created.
            </p>
          </div>
          <div className={`card border text-sm px-4 py-2 flex-shrink-0 ${
            Math.abs(totalWeight - 1.0) < 0.001
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-red-300 bg-red-50 text-red-700'
          }`}>
            Total: <strong>{(totalWeight * 100).toFixed(1)}%</strong>
            {Math.abs(totalWeight - 1.0) < 0.001 ? ' ✓' : ' ⚠ Must equal 100%'}
          </div>
        </div>

        <div className="space-y-4">
          {templateCriteria.map((criterion) => (
            <CriterionEditor key={criterion.id} criterion={criterion} />
          ))}
        </div>

        <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <strong>Note:</strong> Weight changes apply to new grade submissions only.
          Each class uses the criteria snapshot that was frozen at the time of class creation.
        </div>
      </section>

      {/* ── Class snapshot history — read-only ─────────────────────────────── */}
      {classSnapshots.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Class Criteria History</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Read-only record of the criteria frozen for each class at creation. Expand to verify
              what weighting was used for any historical class.
            </p>
          </div>

          <div className="space-y-3">
            {classSnapshots.map((cls) => {
              const total = cls.criteria.reduce((s, c) => s + c.weight, 0)
              return (
                <details key={cls.id} className="card border border-gray-200 p-0 group">
                  <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between select-none hover:bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-tps-navy">Class {cls.name}</span>
                      {cls.isActive && (
                        <span className="text-xs bg-tps-orange text-white px-2 py-0.5 rounded-full">ACTIVE</span>
                      )}
                      <span className="text-xs text-gray-400">
                        Created {new Date(cls.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">
                        {cls.criteria.length} criteria · {(total * 100).toFixed(1)}% total
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                  </summary>

                  <div className="px-4 pb-4 border-t border-gray-100 mt-0">
                    <table className="w-full text-sm mt-3">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left pb-2 font-medium">Code</th>
                          <th className="text-left pb-2 font-medium">Criterion</th>
                          <th className="text-left pb-2 font-medium">Pillar</th>
                          <th className="text-right pb-2 font-medium">Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cls.criteria.map((c) => (
                          <tr key={c.id}>
                            <td className="py-1.5 font-mono text-xs font-bold text-tps-orange">{c.code}</td>
                            <td className="py-1.5 text-gray-700">{c.name}</td>
                            <td className="py-1.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                c.pillar === 'TESTER'  ? 'bg-blue-50 text-blue-700' :
                                c.pillar === 'LEADER'  ? 'bg-green-50 text-green-700' :
                                'bg-purple-50 text-purple-700'
                              }`}>{c.pillar}</span>
                            </td>
                            <td className="py-1.5 text-right font-semibold text-gray-700">
                              {(c.weight * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
