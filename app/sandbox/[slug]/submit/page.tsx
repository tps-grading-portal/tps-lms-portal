import { db } from '@/lib/db'
import { validateSandboxToken } from '@/lib/sandbox-auth'
import { redirect, notFound } from 'next/navigation'
import { SandboxSubmitForm } from './submit-form'
import { SandboxSuccessScreen } from './sandbox-success-screen'
import { TPSPatchBadge } from '@/components/ui/tps-branding'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Submit Form' }

interface PageProps {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ submitted?: string; submissionId?: string; edit?: string }>
}

export default async function SandboxSubmitPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp       = await searchParams

  const authed = await validateSandboxToken('submit', slug)
  if (!authed) redirect(`/sandbox/${slug}/submit/auth`)

  const form = await db.sandboxForm.findUnique({
    where:   { submitSlug: slug },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!form || !form.isActive) notFound()

  if (sp.submitted === '1') {
    return <SandboxSuccessScreen slug={slug} submissionId={sp.submissionId ?? null} />
  }

  let initialAnswers: Record<string, unknown> = {}
  let editId: string | null = null

  if (sp.edit) {
    const existing = await db.sandboxSubmission.findUnique({
      where:  { id: sp.edit },
      select: { id: true, answers: true, subjectName: true, graderName: true, formId: true },
    })
    if (existing && existing.formId === form.id) {
      initialAnswers = existing.answers as Record<string, unknown>
      editId = existing.id
    }
  }

  const staffMembers = form.graderEntry === 'STAFF_LIST'
    ? await db.staffMember.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    : []

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between border-b-2 border-tps-orange sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <TPSPatchBadge size={28} />
          <div>
            <p className="text-tps-gold font-bold text-[9px] tracking-widest uppercase leading-none">The Sandbox</p>
            <p className="text-white font-semibold text-sm leading-none mt-0.5">{form.title}</p>
          </div>
        </div>
        {editId && (
          <span className="text-xs text-white border border-white px-2 py-1 rounded-full">Editing submission</span>
        )}
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {form.description && (
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">{form.description}</p>
        )}
        <SandboxSubmitForm
          form={form}
          questions={form.questions}
          staffMembers={staffMembers}
          slug={slug}
          initialAnswers={initialAnswers}
          editId={editId}
        />
      </div>
    </main>
  )
}
