import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { syncFlightSchedule, getTodaySchedule } from '@/lib/flight-schedule'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Flight Schedule' }
export const revalidate = 3600 // Re-fetch every hour

export default async function SchedulePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  if (!can(session.user.role, 'view:flight_schedule')) return null

  // Trigger sync (no-op if recent)
  await syncFlightSchedule()
  const { entries, lastSync } = await getTodaySchedule()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // Build per-student consolidated view
  type StudentRow = {
    name:       string
    flightTime: string | null
    groundTime: string | null
    isNA:       boolean
  }
  const studentMap = new Map<string, StudentRow>()
  for (const e of entries) {
    const existing = studentMap.get(e.studentName) ?? { name: e.studentName, flightTime: null, groundTime: null, isNA: false }
    if (e.eventType === 'FLIGHT') existing.flightTime = e.eventTime
    if (e.eventType === 'GROUND') existing.groundTime = e.eventTime
    if (e.eventType === 'NA')     existing.isNA       = true
    studentMap.set(e.studentName, existing)
  }
  const students = [...studentMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Flight Schedule</h1>
          <p className="text-gray-500 text-sm">{today}</p>
        </div>

        <div className="text-right text-xs text-gray-400">
          {lastSync ? (
            <>
              Last sync: {new Date(lastSync.syncedAt).toLocaleTimeString()}
              {lastSync.status !== 'success' && (
                <span className="ml-2 text-amber-500">({lastSync.status})</span>
              )}
              {' · '}{lastSync.rowsIngested} entries
            </>
          ) : (
            <span className="text-amber-500">Not yet synced today</span>
          )}
          <br />Source: Google Sheets (read-only)
        </div>
      </div>

      {!process.env.GOOGLE_SHEETS_API_KEY && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>GOOGLE_SHEETS_API_KEY</strong> not configured —
          add this to your environment variables to enable live schedule sync.
        </div>
      )}

      {students.length === 0 ? (
        <div className="card text-center py-16 text-gray-400 text-sm">
          {process.env.GOOGLE_SHEETS_API_KEY
            ? 'No schedule data available for today.'
            : 'Configure GOOGLE_SHEETS_API_KEY to pull the daily whiteboard.'}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Student</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-32">Flight</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-32">Ground</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-20">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => (
                <tr
                  key={s.name}
                  className={`transition-colors ${s.isNA ? 'bg-gray-50/60' : ''} hover:bg-gray-50/80`}
                >
                  <td className="px-4 py-3 font-medium text-tps-navy">{s.name}</td>
                  <td className="px-4 py-3 text-center font-mono text-sm">
                    {s.flightTime ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-sm">
                    {s.groundTime ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.isNA ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">N/A</span>
                    ) : s.flightTime ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-semibold">FLT</span>
                    ) : s.groundTime ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">GRD</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        This view is read-only. The LMS never writes to the scheduling whiteboard.
        Data refreshes every hour.
      </p>
    </div>
  )
}
