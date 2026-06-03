'use client'

import dynamic from 'next/dynamic'

const ConfettiBlast = dynamic(
  () => import('@/components/ui/confetti-blast').then((m) => m.ConfettiBlast),
  { ssr: false },
)

interface Props {
  slug:         string
  submissionId: string | null
}

export function SandboxSuccessScreen({ slug, submissionId }: Props) {
  const editHref = submissionId
    ? `/sandbox/${slug}/submit?edit=${submissionId}`
    : null

  return (
    <main className="min-h-screen bg-gray-50 overflow-hidden flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center space-y-5 py-10">
        <ConfettiBlast />
        <h1 className="text-2xl font-bold text-gray-900">Submitted!</h1>
        <p className="text-gray-600 text-sm">Your response has been recorded. Thank you.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {editHref && (
            <a href={editHref} className="btn-secondary text-sm">
              ← Edit My Submission
            </a>
          )}
          <a href={`/sandbox/${slug}/submit`} className="btn-primary text-sm">
            Submit Another Response
          </a>
        </div>
        {editHref && (
          <p className="text-xs text-gray-400">
            Made a mistake? &quot;Edit My Submission&quot; re-opens the form with your answers pre-filled.
          </p>
        )}
      </div>
    </main>
  )
}
