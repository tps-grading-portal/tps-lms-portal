import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { getWeightingMatrixData } from './actions'
import { WeightingMatrix } from './weighting-matrix'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: "Dean's Weighting Matrix" }

export default async function WeightingPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!can(session.user.role, 'manage:weighting_matrix')) return null

  const { events, catalog, weightMap } = await getWeightingMatrixData()

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-tps-navy">Dean&apos;s Weighting Matrix</h1>
        <p className="text-gray-500 text-sm mt-1">
          Set the percentage weight of each graded event per track.
          Weights must sum to exactly 100% per track before saving.
        </p>
      </div>

      <WeightingMatrix events={events} catalog={catalog} weightMap={weightMap} />
    </div>
  )
}
