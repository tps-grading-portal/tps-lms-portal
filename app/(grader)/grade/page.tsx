import { validatePinToken } from '@/lib/pin-auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { GradeForm } from './grade-form'
import { clearPinToken } from '@/lib/pin-auth'
import { SuccessScreen } from './success-screen'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Enter Grades' }

interface PageProps {
  searchParams: Promise<{
    submitted?:       string
    sessionId?:       string
    isRetake?:        string
    editStudentId?:   string
    editScenarioId?:  string
    editStaffMemberId?: string
    studentId?:       string
    scenarioId?:      string
    staffMemberId?:   string
  }>
}

export default async function GraderPage({ searchParams }: PageProps) {
  const token = await validatePinToken('GRADER')
  if (!token) redirect('/grade/auth')

  const params = await searchParams

  const [cls, students, scenarios, staffMembers, criteria] = await Promise.all([
    db.class.findUnique({ where: { id: token.classId }, select: { name: true } }),
    db.student.findMany({
      where: { classId: token.classId },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, track: true },
    }),
    // Scenarios are now global — show all active ones
    db.scenario.findMany({
      where: { isActive: true },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, label: true },
    }),
    db.staffMember.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    // Use class-specific criteria snapshot if it exists
    import('@/lib/criteria-utils').then((m) => m.getCriteriaForClass(token.classId)),
  ])

  // Load existing grades if returning to update
  let existingGrades: Record<string, number> = {}
  if (params.studentId && params.scenarioId && params.staffMemberId) {
    const existingAssessment = await db.graderAssessment.findFirst({
      where: {
        staffMemberId: params.staffMemberId,
        session: {
          classId: token.classId,
          studentId: params.studentId,
          scenarioId: params.scenarioId,
          status: { not: 'FINALIZED' },
        },
      },
      include: {
        grades: { select: { criterionId: true, gradeValue: true } },
      },
    })
    if (existingAssessment) {
      existingGrades = Object.fromEntries(
        existingAssessment.grades.map((g) => [g.criterionId, g.gradeValue]),
      )
    }
  }

  // Success confirmation screen
  if (params.submitted === '1') {
    return (
      <main className="min-h-screen bg-gray-50 overflow-hidden">
        <Header className={cls?.name} />
        <SuccessScreen
          className={cls?.name}
          isRetake={params.isRetake === '1'}
          editStudentId={params.editStudentId}
          editScenarioId={params.editScenarioId}
          editStaffMemberId={params.editStaffMemberId}
        />
      </main>
    )
  }

  // No students added yet
  if (students.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header className={cls?.name} />
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <p className="text-lg font-semibold text-gray-700">
            No students have been added to this class yet.
          </p>
          <p className="text-sm text-gray-500">
            Contact your administrator to set up the student roster.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <Header className={cls?.name} />
      <div className="max-w-lg mx-auto px-4 py-4">
        <GradeForm
          criteria={criteria}
          students={students}
          scenarios={scenarios}
          staffMembers={staffMembers}
          existingGrades={existingGrades}
          className={cls?.name}
          preSelectedStudentId={params.studentId}
          preSelectedScenarioId={params.scenarioId}
          preSelectedStaffMemberId={params.staffMemberId}
        />
      </div>
    </main>
  )
}

function Header({ className }: { className?: string }) {
  return (
    <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between sticky top-0 z-10">
      <span className="font-bold text-sm">
        Grading — Class {className ?? '…'}
      </span>
      <form
        action={async () => {
          'use server'
          await clearPinToken('GRADER')
          redirect('/grade/auth')
        }}
      >
        <button type="submit" className="text-tps-silver text-xs hover:text-white min-h-[44px] px-2">
          Exit
        </button>
      </form>
    </header>
  )
}
