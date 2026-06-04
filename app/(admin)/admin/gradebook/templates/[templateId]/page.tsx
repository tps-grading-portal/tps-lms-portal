import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TemplateDetailPanel } from './template-detail-panel'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gradesheet Template' }

interface PageProps {
  params:      Promise<{ templateId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function TemplateDetailPage({ params, searchParams }: PageProps) {
  const { templateId } = await params
  const { tab }        = await searchParams

  const template = await db.gradesheetTemplate.findUnique({
    where:   { id: templateId },
    include: { tasks: { orderBy: { sortOrder: 'asc' } }, _count: { select: { entries: true } } },
  })
  if (!template) notFound()

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/gradebook" className="hover:text-tps-orange">Gradebook</Link>
        <span>›</span>
        <Link href="/admin/gradebook/templates" className="hover:text-tps-orange">Library</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{template.courseCode}</span>
      </div>

      <TemplateDetailPanel template={template} initialTab={(tab as 'view' | 'preview' | 'edit') ?? 'view'} />
    </div>
  )
}
