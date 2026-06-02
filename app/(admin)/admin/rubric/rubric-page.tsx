import { db } from '@/lib/db'
import { CriterionEditor } from './criterion-editor'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rubric' }

export async function RubricPage() {
  const criteria = await db.criterion.findMany({ orderBy: { sortOrder: 'asc' } })

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Rubric</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Edit criterion names, descriptions, and weights. Changes apply to new sessions immediately.
          </p>
        </div>
        <div className={`card border text-sm px-4 py-2 ${
          Math.abs(totalWeight - 1.0) < 0.001
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-red-300 bg-red-50 text-red-700'
        }`}>
          Total weight: <strong>{(totalWeight * 100).toFixed(1)}%</strong>
          {Math.abs(totalWeight - 1.0) < 0.001 ? ' ✓' : ' ⚠ Must equal 100%'}
        </div>
      </div>

      <div className="space-y-4">
        {criteria.map((criterion) => (
          <CriterionEditor key={criterion.id} criterion={criterion} />
        ))}
      </div>

      <div className="card border border-amber-200 bg-amber-50 text-sm text-amber-800">
        <strong>Note:</strong> Changing criterion weights affects how final scores are calculated for{' '}
        <em>new</em> grade submissions only. Historical finalized sessions retain the weights that
        were active at the time they were graded.
      </div>
    </div>
  )
}
