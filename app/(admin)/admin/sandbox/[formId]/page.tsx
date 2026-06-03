import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { AdminFormDetail } from './admin-form-detail'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sandbox Form' }

interface PageProps { params: Promise<{ formId: string }> }

export default async function SandboxFormDetailPage({ params }: PageProps) {
  const { formId } = await params

  const [form, allForms] = await Promise.all([
    db.sandboxForm.findUnique({
      where:   { id: formId },
      include: {
        questions:     { orderBy: { sortOrder: 'asc' } },
        invite:        true,
        _count:        { select: { submissions: true } },
        accessTargets: { select: { grantedToFormId: true } },
      },
    }),
    db.sandboxForm.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  if (!form) notFound()

  const headersList = await headers()
  const host  = headersList.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${proto}://${host}`

  const submitUrl  = `${baseUrl}/sandbox/${form.submitSlug}/submit`
  const resultsUrl = `${baseUrl}/sandbox/${form.resultsSlug}/results`

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/sandbox" className="hover:text-tps-orange">The Sandbox</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{form.title}</span>
      </div>

      {/* Builder link — always accessible to admin */}
      <div className="flex gap-3">
        <Link href={`/admin/sandbox/${formId}/builder`} className="btn-primary text-sm">
          ✎ Build / Edit Questions
        </Link>
        <a href={resultsUrl} target="_blank" className="btn-secondary text-sm">
          View Results ↗
        </a>
      </div>

      <AdminFormDetail
        form={form}
        submitUrl={submitUrl}
        resultsUrl={resultsUrl}
        allForms={allForms.filter((f) => f.id !== formId)}
        grantedToFormIds={form.accessTargets.map((a) => a.grantedToFormId)}
      />
    </div>
  )
}
