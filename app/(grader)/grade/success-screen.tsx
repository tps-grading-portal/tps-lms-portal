'use client'

import dynamic from 'next/dynamic'

// canvas-confetti uses browser APIs — load only on client
const ConfettiBlast = dynamic(
  () => import('@/components/ui/confetti-blast').then((m) => m.ConfettiBlast),
  { ssr: false },
)

export function SuccessScreen({ className }: { className?: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-5">
      <ConfettiBlast />
      <h1 className="text-2xl font-bold text-gray-900">Grades Submitted!</h1>
      <p className="text-gray-600">
        Your grades have been recorded for Class <strong>{className}</strong>.
      </p>
      <a href="/grade" className="btn-primary inline-flex mt-2">
        Grade Another Student
      </a>
    </div>
  )
}
