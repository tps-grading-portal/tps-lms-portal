'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export type ChangePasswordResult = { error?: string; success?: boolean }

export async function changePasswordAction(
  _prev: ChangePasswordResult | null,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const currentPassword = formData.get('currentPassword')?.toString()
  const newPassword      = formData.get('newPassword')?.toString()
  const confirmPassword  = formData.get('confirmPassword')?.toString()

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'All fields are required.' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' }
  }
  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }

  const admin = await db.adminUser.findUnique({
    where: { username: session.user?.name ?? '' },
  })
  if (!admin) return { error: 'Admin user not found.' }

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash)
  if (!valid) return { error: 'Current password is incorrect.' }

  const newHash = await bcrypt.hash(newPassword, 12)
  await db.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: newHash },
  })

  return { success: true }
}
