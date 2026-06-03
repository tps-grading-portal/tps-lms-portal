import { db } from '@/lib/db'
import { validateSandboxToken } from '@/lib/sandbox-auth'
import { redirect, notFound } from 'next/navigation'
import { SandboxSubmitForm } from './submit-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Submit Form' }

interface PageProps {
  params:      Promise<{ slug: string }>
  searchParams: Promise<{ submitted?: string }>
}

export default async function SandboxSubmitPage({ params, searchParams }: PageProps) {
  const { slug }   = await params
  const sp         = await searchParams
  const authed     = await validateSandboxToken('submit', slug)
  if (!authed) redirect(`/sandbox/${slug}/submit/auth`)

  const form = await db.sandboxForm.findUnique({
    where:   { submitSlug: slug },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!form || !form.isActive) notFound()

  const staffMembers = form.questions.some((q) => false) // placeholder
    ? await db.staffMember.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    : form.questions.length > 0 && (['FREE_TEXT', 'STAFF_LIST'].includes(form.graderEntry))
    ? await db.staffMember.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    : []

  if (sp.submitted === '1') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center space-y-4 py-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
            <span className="text-green-600 text-3xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Submitted!</h1>
          <p className="text-gray-600 text-sm">Your response has been recorded. Thank you.</p>
          <a href={`/sandbox/${slug}/submit`} className="btn-secondary inline-flex text-sm">Submit Another</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center border-b-2 border-tps-orange">
        <div>
          <p className="text-tps-gold font-bold text-[9px] tracking-widest uppercase leading-none">The Sandbox</p>
          <p className="text-white font-semibold text-sm leading-none mt-0.5">{form.title}</p>
        </div>
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
        />
      </div>
    </main>
  )
}
