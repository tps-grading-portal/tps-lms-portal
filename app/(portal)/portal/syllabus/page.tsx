import { requireAuth } from '@/lib/server-auth'
import { getRoadmapData } from './actions'
import { RoadmapView } from './roadmap-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Syllabus Roadmap' }

export default async function SyllabusPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  await requireAuth()
  const { classId } = await searchParams
  const data = await getRoadmapData(classId)

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-tps-navy mb-1">Syllabus Roadmap</h1>
      <p className="text-gray-500 text-sm mb-6">
        {data.viewClassName ? `Class ${data.viewClassName} MCG` : 'MCG course catalog'}
        {' '}— {data.events.length} events across all phases
      </p>
      <RoadmapView
        events={data.events}
        studentName={data.studentName}
        studentConcentration={data.studentConcentration}
        viewClassId={data.viewClassId}
        viewClassName={data.viewClassName}
        classOptions={data.classOptions}
        editScope={data.editScope}
      />
    </div>
  )
}
