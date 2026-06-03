import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { AdminFormBuilder } from './admin-form-builder'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Form Builder' }

interface PageProps { params: Promise<{ formId: string }> }

export default async function AdminBuilderPage({ params }: PageProps) {
  const session = await auth()
  if (!session) redirect('/admin/login')

  const { formId } = await params

  const [form, staffMembers, classes] = await Promise.all([
    db.sandboxForm.findUnique({
      where:   { id: formId },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    }),
    db.staffMember.findMany({
      where:   { isActive: true },
      orderBy: { name: 'asc' },
      select:  { id: true, name: true },
    }),
    db.class.findMany({
      orderBy: { createdAt: 'desc' },
      select:  { id: true, name: true, isActive: true, _count: { select: { students: true } } },
    }),
  ])

  if (!form) notFound()

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/sandbox" className="hover:text-tps-orange">The Sandbox</Link>
        <span>›</span>
        <Link href={`/admin/sandbox/${formId}`} className="hover:text-tps-orange">{form.title}</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Builder</span>
      </div>

      <AdminFormBuilder form={form} staffMembers={staffMembers} classes={classes} />
    </div>
  )
}
