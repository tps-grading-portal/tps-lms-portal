'use server'

import { db } from '@/lib/db'
import { scoreSubmission } from '@/lib/sandbox-scoring'
import { redirect } from 'next/navigation'

export async function submitSandboxAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const formId     = formData.get('formId')?.toString()
  const slug       = formData.get('slug')?.toString()
  const subjectName = formData.get('subjectName')?.toString()?.trim() || null
  const graderName  = formData.get('graderName')?.toString()?.trim()  || null
  const answersRaw  = formData.get('answers')?.toString() ?? '{}'

  if (!formId || !slug) return 'Invalid submission.'

  let answers: Record<string, unknown>
  try {
    answers = JSON.parse(answersRaw)
  } catch {
    return 'Invalid form data.'
  }

  const form = await db.sandboxForm.findUnique({
    where:   { id: formId },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!form) return 'Form not found.'

  // Compute score if scoring enabled
  let totalScore: number | null = null
  if (form.scoringEnabled) {
    const scorableQs = form.questions.map((q) => ({
      id:           q.id,
      questionType: q.questionType,
      weight:       q.weight,
      pointMap:     (q.pointMap as Record<string, number> | null) ?? null,
      scaleMin:     q.scaleMin,
      scaleMax:     q.scaleMax,
      label:        q.label,
    }))
    totalScore = scoreSubmission(answers as Record<string, unknown>, scorableQs)
  }

  await db.sandboxSubmission.create({
    data: {
      formId,
      subjectName,
      graderName,
      answers: answers as Parameters<typeof db.sandboxSubmission.create>[0]['data']['answers'],
      totalScore,
    },
  })

  redirect(`/sandbox/${slug}/submit?submitted=1`)
}
