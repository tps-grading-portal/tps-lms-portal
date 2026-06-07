import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getScheduleDataAction } from './actions'
import { ScheduleView } from './schedule-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Academic Schedule' }

export default async function AcademicSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const params = await searchParams
  const data = await getScheduleDataAction(params.classId)

  if (!data.selectedClassId) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-tps-navy mb-2">Academic Schedule</h1>
        <div className="card text-center py-16 text-gray-400 text-sm">
          No active classes found. Create a class first.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ScheduleView
        classes={data.classes}
        activeClasses={data.activeClasses}
        selectedClassId={data.selectedClassId}
        selectedClassName={data.selectedClassName ?? ''}
        classStartDate={data.classStartDate}
        classEndDate={data.classEndDate}
        weeks={data.weeks}
        scheduled={data.scheduled}
        unscheduledByClass={data.unscheduledByClass}
        instructors={data.instructors}
        canEdit={data.canEdit}
      />
    </div>
  )
}
