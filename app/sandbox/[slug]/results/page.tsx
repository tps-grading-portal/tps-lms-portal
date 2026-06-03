import { db } from '@/lib/db'
import { validateSandboxToken } from '@/lib/sandbox-auth'
import { redirect, notFound } from 'next/navigation'
import { SandboxResultsViewer } from './results-viewer'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Results' }

interface PageProps { params: Promise<{ slug: string }> }

export default async function SandboxResultsPage({ params }: PageProps) {
  const { slug }  = await params
  const authed    = await validateSandboxToken('results', slug)
  if (!authed) redirect(`/sandbox/${slug}/results/auth`)

  const form = await db.sandboxForm.findUnique({
    where:   { resultsSlug: slug },
    include: {
      questions:   { orderBy: { sortOrder: 'asc' } },
      submissions: { orderBy: { submittedAt: 'desc' } },
    },
  })
  if (!form || !form.isActive) notFound()

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between border-b-2 border-tps-orange sticky top-0 z-20">
        <div>
          <p className="text-tps-gold font-bold text-[9px] tracking-widest uppercase leading-none">The Sandbox — Results</p>
          <p className="text-white font-semibold text-sm leading-none mt-0.5">{form.title}</p>
        </div>
        <a href={`/api/sandbox/export/${slug}`} className="text-xs text-tps-gold hover:text-white border border-tps-gold hover:border-white px-3 py-1.5 rounded-lg transition-colors">
          ↓ Download Excel
        </a>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <SandboxResultsViewer
          form={form}
          questions={form.questions}
          initialSubmissions={form.submissions.map((s) => ({
            id:          s.id,
            subjectName: s.subjectName,
            graderName:  s.graderName,
            answers:     s.answers as Record<string, unknown>,
            totalScore:  s.totalScore,
            submittedAt: s.submittedAt.toISOString(),
          }))}
          slug={slug}
        />
      </div>
    </main>
  )
}
