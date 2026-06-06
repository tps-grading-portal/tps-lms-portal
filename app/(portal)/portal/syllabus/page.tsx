import { requireAuth } from '@/lib/server-auth'
import { getRoadmapData } from './actions'
import { RoadmapView } from './roadmap-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Syllabus Roadmap' }

export default async function SyllabusPage() {
  await requireAuth()
  const data = await getRoadmapData()

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-tps-navy mb-1">Syllabus Roadmap</h1>
      <p className="text-gray-500 text-sm mb-6">
        MCG course catalog — {data.events.length} events across all phases and departments
      </p>
      <RoadmapView events={data.events} studentName={data.studentName} />
    </div>
  )
}
