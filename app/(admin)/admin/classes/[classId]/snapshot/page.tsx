import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { studentId } from '@/lib/student-utils'
import { PASSING_SCORE, AUTO_FAIL_SCORE } from '@/lib/constants'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Grade Snapshot' }

interface PageProps {
  params: Promise<{ classId: string }>
}

export default async function GradeSnapshotPage({ params }: PageProps) {
  const { classId } = await params

  const cls = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
  if (!cls) notFound()

  const students = await db.student.findMany({
    where: { classId },
    orderBy: { number: 'asc' },
    include: {
      sessions: {
        orderBy: { createdAt: 'asc' },
        include: {
          scenario: { select: { number: true, label: true } },
        },
      },
    },
  })

  const total    = students.length
  const graded   = students.filter((s) => s.sessions.some((x) => x.status === 'FINALIZED')).length
  const passed   = students.filter((s) =>
    s.sessions.some((x) => x.status === 'FINALIZED' && (x.outputScore ?? x.finalScore ?? 0) >= PASSING_SCORE)
  ).length
  const failed   = students.filter((s) =>
    s.sessions.some((x) => x.status === 'FINALIZED' && x.hasFail)
  ).length
  const retakes  = students.filter((s) =>
    s.sessions.some((x) => x.isRetake)
  ).length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/classes" className="hover:text-tps-blue">Classes</Link>
        <span>›</span>
        <Link href={`/admin/classes/${classId}`} className="hover:text-tps-blue">Class {cls.name}</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Grade Snapshot</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Grade Snapshot — Class {cls.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live view · updates on each page load</p>
        </div>
        <Link href={`/admin/classes/${classId}`} className="btn-secondary text-sm">← Class Detail</Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Students', value: total,   color: 'border-gray-200'   },
          { label: 'Graded',         value: graded,  color: 'border-blue-200'   },
          { label: 'Passed',         value: passed,  color: 'border-green-200'  },
          { label: 'Failed',         value: failed,  color: 'border-red-200',   warn: failed > 0 },
          { label: 'Retakes',        value: retakes, color: 'border-amber-200', warn: retakes > 0 },
        ].map(({ label, value, color, warn }) => (
          <div key={label} className={`card border ${color} text-center py-3`}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-2xl font-bold ${warn ? 'text-amber-700' : 'text-tps-navy'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Student table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Student #', 'Track', 'Scenario', 'Status', 'Official Grade', 'Notes'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student) => {
              const finalSession = student.sessions
                .filter((s) => s.status === 'FINALIZED')
                .sort((a, b) => (b.finalizedAt?.getTime() ?? 0) - (a.finalizedAt?.getTime() ?? 0))[0]

              const activeSession = student.sessions.find((s) => s.status !== 'FINALIZED')
              const isRetake = student.sessions.some((s) => s.isRetake)

              const officialScore = finalSession
                ? (finalSession.outputScore ?? finalSession.finalScore)
                : null

              const statusLabel = finalSession
                ? finalSession.hasFail
                  ? { text: 'FAIL', cls: 'bg-red-100 text-red-800 font-bold' }
                  : (officialScore ?? 0) >= PASSING_SCORE
                  ? { text: 'PASS', cls: 'bg-green-100 text-green-800 font-bold' }
                  : { text: 'FAIL', cls: 'bg-red-100 text-red-800 font-bold' }
                : activeSession
                ? { text: 'In Progress', cls: 'bg-amber-100 text-amber-700' }
                : { text: 'Not Started', cls: 'bg-gray-100 text-gray-500' }

              return (
                <tr key={student.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-tps-navy">
                    {studentId(cls.name, student.number)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{student.track}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {finalSession?.scenario.label ?? activeSession?.scenario.label ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabel.cls}`}>
                      {statusLabel.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {officialScore !== null ? (
                      <span className={officialScore < PASSING_SCORE || finalSession?.hasFail ? 'text-red-600' : 'text-green-700'}>
                        {finalSession?.hasFail ? '69 (Fail)' : officialScore.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {isRetake && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-1">Retake</span>}
                    {finalSession?.outputScore !== null && finalSession?.outputScore !== finalSession?.finalScore && (
                      <span title={`Actual: ${finalSession?.finalScore?.toFixed(2)}`}>Capped at 70</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  No students in this class yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
