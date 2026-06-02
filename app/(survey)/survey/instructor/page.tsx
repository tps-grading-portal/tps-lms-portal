import { db } from '@/lib/db'
import { SurveyForm } from '@/components/ui/survey-form'
import { submitInstructorSurveyAction } from './actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Instructor Survey' }

const INSTRUCTOR_SECTIONS: [number, string][] = [
  [1, 'Section 1: Examination Details'],
  [4, 'Section 2: Scenario Evaluation'],
]

interface PageProps {
  searchParams: Promise<{ submitted?: string }>
}

export default async function InstructorSurveyPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (params.submitted === '1') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center space-y-4 py-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
            <span className="text-green-600 text-3xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Feedback Submitted</h1>
          <p className="text-gray-600 text-sm">
            Thank you for providing feedback on this scenario and the Comp Oral process.
          </p>
          <a href="/survey/instructor" className="btn-secondary inline-flex text-sm">
            Submit Another Response
          </a>
        </div>
      </main>
    )
  }

  const [questions, classes] = await Promise.all([
    db.surveyQuestionTemplate.findMany({
      where: { surveyType: 'INSTRUCTOR', classId: null },
      orderBy: { sortOrder: 'asc' },
    }),
    db.class.findMany({
      where: { OR: [{ isActive: true }, { archivedAt: null }] },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true },
    }),
  ])

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-tps-navy text-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">USAF TPS Comp Oral Exam</h1>
          <p className="text-tps-silver text-sm mt-0.5">Instructor Panel Member Feedback</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6 text-sm text-gray-600">
          This survey is optional and to be completed if an instructor wants to provide
          feedback to the DFAT team on the scenario or the process for the Comp Oral Exam.
        </div>

        <SurveyForm
          action={submitInstructorSurveyAction}
          questions={questions}
          classes={classes}
          sectionBreaks={INSTRUCTOR_SECTIONS}
          submitLabel="Submit Feedback"
        />
      </div>
    </main>
  )
}
