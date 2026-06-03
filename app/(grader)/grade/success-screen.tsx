'use client'

import dynamic from 'next/dynamic'

const ConfettiBlast = dynamic(
  () => import('@/components/ui/confetti-blast').then((m) => m.ConfettiBlast),
  { ssr: false },
)

interface SuccessScreenProps {
  className?:          string
  isRetake?:           boolean
  editStudentId?:      string
  editScenarioId?:     string
  editStaffMemberId?:  string
}

export function SuccessScreen({
  className,
  isRetake,
  editStudentId,
  editScenarioId,
  editStaffMemberId,
}: SuccessScreenProps) {
  // Build the edit-submission URL — pre-populates the grade form with everything just submitted
  const editHref =
    editStudentId && editScenarioId && editStaffMemberId
      ? `/grade?studentId=${editStudentId}&scenarioId=${editScenarioId}&staffMemberId=${editStaffMemberId}`
      : null

  return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-5">
      <ConfettiBlast />
      <h1 className="text-2xl font-bold text-gray-900">Grades Submitted!</h1>

      {isRetake && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800 text-left">
          <p className="font-semibold">Retake recorded</p>
          <p className="mt-0.5">
            This submission was flagged as a retake. If the student passes, their official output grade will be 70%.
          </p>
        </div>
      )}

      <p className="text-gray-600">
        Your grades have been recorded for Class <strong>{className}</strong>.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {editHref && (
          <a
            href={editHref}
            className="btn-secondary"
          >
            ← Edit My Submission
          </a>
        )}
        <a href="/grade" className="btn-primary">
          Grade Another Student
        </a>
      </div>

      {editHref && (
        <p className="text-xs text-gray-400">
          Made a mistake? &quot;Edit My Submission&quot; returns you to the same form pre-filled — change any field and resubmit.
        </p>
      )}
    </div>
  )
}
