import { db } from '@/lib/db'
import Link from 'next/link'
import { InstructorManagerPanel } from './instructor-manager-panel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Instructors' }

export default async function InstructorsPage() {
  const instructors = await db.gradebookInstructor.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/gradebook" className="hover:text-tps-orange">Gradebook</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Instructors</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Instructors</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage instructor accounts for the gradebook.
            Instructors log in at <code className="bg-gray-100 px-1 rounded text-xs">/instructor</code>
          </p>
        </div>
      </div>
      <InstructorManagerPanel instructors={instructors} />
    </div>
  )
}
