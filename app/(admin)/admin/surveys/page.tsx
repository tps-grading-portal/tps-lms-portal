import { db } from '@/lib/db'
import { SurveyViewer } from './survey-viewer'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Surveys' }

export default async function SurveysPage() {
  const [
    classes,
    studentQuestions,
    instructorQuestions,
    rawStudentResponses,
    rawInstructorResponses,
  ] = await Promise.all([
    db.class.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, isActive: true },
    }),
    db.surveyQuestionTemplate.findMany({
      where:   { surveyType: 'STUDENT', classId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select:  { id: true, questionKey: true, questionText: true, questionType: true, options: true, sortOrder: true, isRequired: true },
    }),
    db.surveyQuestionTemplate.findMany({
      where:   { surveyType: 'INSTRUCTOR', classId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select:  { id: true, questionKey: true, questionText: true, questionType: true, options: true, sortOrder: true, isRequired: true },
    }),
    db.studentSurveyResponse.findMany({
      orderBy: { submittedAt: 'desc' },
      include: { class: { select: { name: true } } },
    }),
    db.instructorSurveyResponse.findMany({
      orderBy: { submittedAt: 'desc' },
      include: { class: { select: { name: true } } },
    }),
  ])

  // Flatten responses to a serialisable format with className attached
  const studentResponses = rawStudentResponses.map((r) => ({
    id:          r.id,
    classId:     r.classId,
    className:   r.class.name,
    submittedAt: r.submittedAt.toISOString(),
    responses:   r.responses as Record<string, unknown>,
  }))

  const instructorResponses = rawInstructorResponses.map((r) => ({
    id:          r.id,
    classId:     r.classId,
    className:   r.class.name,
    submittedAt: r.submittedAt.toISOString(),
    responses:   r.responses as Record<string, unknown>,
  }))

  return (
    <SurveyViewer
      classes={classes}
      studentQuestions={studentQuestions}
      instructorQuestions={instructorQuestions}
      studentResponses={studentResponses}
      instructorResponses={instructorResponses}
    />
  )
}
