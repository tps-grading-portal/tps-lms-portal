import { db } from '@/lib/db'
import { getTemplateCriteria } from '@/lib/criteria-utils'
import { ClassCreationWizard } from './wizard'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Create New Class' }

export default async function NewClassPage() {
  const [criteria, scenarios, surveyQuestions] = await Promise.all([
    getTemplateCriteria(),
    db.scenario.findMany({ where: { isActive: true }, orderBy: { number: 'asc' } }),
    db.surveyQuestionTemplate.findMany({
      where: { classId: null, isActive: true },
      orderBy: [{ surveyType: 'asc' }, { sortOrder: 'asc' }],
    }),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/classes" className="text-sm text-gray-400 hover:text-tps-blue">
          ← Classes
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-tps-navy">Create New Class</h1>
      </div>

      <div className="card border border-blue-200 bg-blue-50 text-sm text-blue-800">
        <p className="font-semibold">Step-by-step class setup</p>
        <p className="mt-0.5">
          Review and confirm each section. <strong>Grading criteria are frozen at creation</strong> —
          any template changes after this point won&apos;t affect this class. Staff and scenarios remain
          flexible and can be adjusted at any time.
        </p>
      </div>

      <ClassCreationWizard
        criteria={criteria}
        scenarios={scenarios}
        surveyQuestions={surveyQuestions}
      />
    </div>
  )
}
