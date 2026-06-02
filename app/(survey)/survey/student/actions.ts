'use server'

import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export async function submitStudentSurveyAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const classId = formData.get('classId')?.toString()
  if (!classId) return 'Please select your class.'

  const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true } })
  if (!cls) return 'Class not found.'

  // Fetch question templates so we can store question text alongside answers
  const questions = await db.surveyQuestionTemplate.findMany({
    where: { surveyType: 'STUDENT', classId: null },
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
    // Store question text for historical record-keeping
    responses[`_qt_${q.questionKey}`] = q.questionText
  }

  await db.studentSurveyResponse.create({
    // Cast to satisfy Prisma's JSON input type — responses is a plain serialisable object
    data: { classId, responses: responses as Parameters<typeof db.studentSurveyResponse.create>[0]['data']['responses'] },
  })

  redirect('/survey/student?submitted=1')
}
