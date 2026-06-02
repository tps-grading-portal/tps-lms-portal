'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const updateCriterionSchema = z.object({
  id:             z.string().cuid(),
  name:           z.string().min(1).max(120),
  description:    z.string().min(1),
  waaDescriptor:  z.string().min(1),
  avgDescriptor:  z.string().min(1),
  failDescriptor: z.string().min(1),
  weight:         z.coerce.number().min(0.001).max(1),
})

export type UpdateCriterionResult = { error?: string; success?: boolean }

export async function updateCriterionAction(
  _prev: UpdateCriterionResult | null,
  formData: FormData,
): Promise<UpdateCriterionResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const parsed = updateCriterionSchema.safeParse({
    id:             formData.get('id'),
    name:           formData.get('name'),
    description:    formData.get('description'),
    waaDescriptor:  formData.get('waaDescriptor'),
    avgDescriptor:  formData.get('avgDescriptor'),
    failDescriptor: formData.get('failDescriptor'),
    weight:         formData.get('weight'),
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  // Validate that the total weight across all criteria won't exceed 1.0
  const allCriteria = await db.criterion.findMany({ select: { id: true, weight: true } })
  const otherWeightsSum = allCriteria
    .filter((c) => c.id !== parsed.data.id)
    .reduce((sum, c) => sum + c.weight, 0)

  if (otherWeightsSum + parsed.data.weight > 1.0001) {
    return {
      error: `Weight of ${(parsed.data.weight * 100).toFixed(1)}% would make total exceed 100%. Other criteria sum to ${(otherWeightsSum * 100).toFixed(1)}%.`,
    }
  }

  await db.criterion.update({
    where: { id: parsed.data.id },
    data: {
      name:           parsed.data.name,
      description:    parsed.data.description,
      waaDescriptor:  parsed.data.waaDescriptor,
      avgDescriptor:  parsed.data.avgDescriptor,
      failDescriptor: parsed.data.failDescriptor,
      weight:         parsed.data.weight,
    },
  })

  revalidatePath('/admin/rubric')
  revalidatePath('/grade')

  return { success: true }
}
