'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const questionSchema = z.object({
  surveyType:   z.enum(['STUDENT', 'INSTRUCTOR']),
  questionKey:  z.string().min(1).max(100),
  questionText: z.string().min(1),
  questionType: z.enum(['TEXT', 'MULTIPLE_CHOICE', 'MULTI_SELECT', 'LIKERT', 'DATE', 'NUMBER']),
  options:      z.string().optional(), // JSON string of string[]
  isRequired:   z.boolean().default(true),
})

export type SurveyActionResult = { error?: string; success?: boolean }

export async function updateSurveyQuestionAction(
  id: string,
  data: { questionText: string; isRequired: boolean },
): Promise<SurveyActionResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.surveyQuestionTemplate.update({
    where: { id },
    data:  { questionText: data.questionText, isRequired: data.isRequired },
  })
  revalidatePath('/admin/classes/new')
  return { success: true }
}

export async function addSurveyQuestionAction(formData: FormData): Promise<SurveyActionResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const surveyType   = formData.get('surveyType')?.toString() as 'STUDENT' | 'INSTRUCTOR'
  const questionText = formData.get('questionText')?.toString()?.trim()
  const questionType = (formData.get('questionType')?.toString() ?? 'TEXT') as 'TEXT' | 'MULTIPLE_CHOICE' | 'LIKERT'
  const isRequired   = formData.get('isRequired') === 'true'

  if (!surveyType || !questionText) return { error: 'Missing required fields.' }

  // Find the max sortOrder for this survey type
  const maxOrder = await db.surveyQuestionTemplate.findFirst({
    where:   { surveyType, classId: null },
    orderBy: { sortOrder: 'desc' },
    select:  { sortOrder: true },
  })

  const key = `custom_${Date.now()}`

  await db.surveyQuestionTemplate.create({
    data: {
      surveyType,
      classId:      null,
      questionKey:  key,
      questionText,
      questionType,
      sortOrder:    (maxOrder?.sortOrder ?? 0) + 1,
      isRequired,
      options:      undefined,
      isActive:     true,
    },
  })

  revalidatePath('/admin/classes/new')
  return { success: true }
}

export async function deleteSurveyQuestionAction(id: string): Promise<SurveyActionResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  await db.surveyQuestionTemplate.update({
    where: { id },
    data:  { isActive: false },
  })

  revalidatePath('/admin/classes/new')
  return { success: true }
}
