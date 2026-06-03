'use client'

import dynamic from 'next/dynamic'

// canvas-confetti uses browser APIs — load only on client
const ConfettiBlast = dynamic(
  () => import('@/components/ui/confetti-blast').then((m) => m.ConfettiBlast),
  { ssr: false },
)

export function SuccessScreen({ className, isRetake }: { className?: string; isRetake?: boolean }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-5">
      <ConfettiBlast />
      <h1 className="text-2xl font-bold text-gray-900">Grades Submitted!</h1>
      {isRetake && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800 text-left">
          <p className="font-semibold">Retake recorded</p>
          <p className="mt-0.5">This submission was flagged as a retake. If the student passes, their official output grade will be 70%.</p>
        </div>
      )}
      <p className="text-gray-600">
        Your grades have been recorded for Class <strong>{className}</strong>.
      </p>
      <a href="/grade" className="btn-primary inline-flex mt-2">
        Grade Another Student
      </a>
    </div>
  )
}
