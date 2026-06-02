'use server'

import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export async function submitInstructorSurveyAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const classId = formData.get('classId')?.toString()
  if (!classId) return 'Please select a class.'

  const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true } })
  if (!cls) return 'Class not found.'

  const questions = await db.surveyQuestionTemplate.findMany({
    where: { surveyType: 'INSTRUCTOR', classId: null },
    orderBy: { sortOrder: 'asc' },
  })

  const responses: Record<string, unknown> = {}

  for (const q of questions) {
    const value = formData.getAll(q.questionKey)
    if (value.length === 1) {
      responses[q.questionKey] = value[0]
    } else if (value.length > 1) {
      responses[q.questionKey] = value
    }
    responses[`_qt_${q.questionKey}`] = q.questionText
  }

  await db.instructorSurveyResponse.create({
    data: { classId, responses: responses as Parameters<typeof db.instructorSurveyResponse.create>[0]['data']['responses'] },
  })

  redirect('/survey/instructor?submitted=1')
}
