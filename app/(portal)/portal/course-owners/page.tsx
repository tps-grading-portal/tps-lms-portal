import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import { deptSortIndex, deptLabel } from '@/lib/mcg-departments'
import { QuickAssign } from './quick-assign'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Course Owners' }

export default async function CourseOwnersPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!can(session.user.role, 'manage:users')) return null

  const [events, assignments, chairs, staff] = await Promise.all([
    db.syllabusEvent.findMany({
      where:   { isActive: true },
      orderBy: { courseCode: 'asc' },
      select:  { id: true, courseCode: true, title: true, deptCode: true },
    }),
    db.courseAssignment.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true, isActive: true } } },
    }),
    db.userDepartment.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true, isActive: true } } },
    }),
    db.user.findMany({
      // Guest instructor and above — anyone except students and schedulers
      where:   { isActive: true, role: { notIn: ['STUDENT', 'SCHEDULER'] } },
      orderBy: { lastName: 'asc' },
      select:  { id: true, firstName: true, lastName: true },
    }),
  ])

  const staffOptions = staff.map(s => ({ id: s.id, name: `${s.lastName}, ${s.firstName}`.trim() }))

  type Owner = { id: string; name: string; via: string }

  // Phase-level coverage: dept → owners
  const phaseOwners = new Map<string, Owner[]>()
  const addPhaseOwner = (dept: string, owner: Owner) => {
    if (!phaseOwners.has(dept)) phaseOwners.set(dept, [])
    if (!phaseOwners.get(dept)!.some(o => o.id === owner.id)) phaseOwners.get(dept)!.push(owner)
  }

  for (const a of assignments) {
    if (a.deptCode && a.user.isActive) {
      addPhaseOwner(a.deptCode, {
        id: a.user.id,
        name: `${a.user.firstName} ${a.user.lastName}`.trim(),
        via: 'phase owner',
      })
    }
  }
  for (const c of chairs) {
    if (c.user.isActive && c.user.role === 'DEPT_CHAIR') {
      addPhaseOwner(c.deptCode, {
        id: c.user.id,
        name: `${c.user.firstName} ${c.user.lastName}`.trim(),
        via: 'dept chair',
      })
    }
  }

  // Course-level owners: eventId → owners
  const courseOwners = new Map<string, Owner[]>()
  for (const a of assignments) {
    if (a.syllabusEventId && a.user.isActive) {
      if (!courseOwners.has(a.syllabusEventId)) courseOwners.set(a.syllabusEventId, [])
      courseOwners.get(a.syllabusEventId)!.push({
        id: a.user.id,
        name: `${a.user.firstName} ${a.user.lastName}`.trim(),
        via: 'course owner',
      })
    }
  }

  // Build rows with effective owners
  const rows = events.map(e => {
    const owners = [
      ...(courseOwners.get(e.id) ?? []),
      ...(phaseOwners.get(e.deptCode) ?? []),
    ]
    return { ...e, owners }
  })

  const unowned = rows.filter(r => r.owners.length === 0)

  // Group by MCG dept
  const byDept = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!byDept.has(r.deptCode)) byDept.set(r.deptCode, [])
    byDept.get(r.deptCode)!.push(r)
  }
  const sortedDepts = [...byDept.entries()].sort((a, b) => deptSortIndex(a[0]) - deptSortIndex(b[0]))

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Course Owners</h1>
          <p className="text-gray-500 text-sm">
            {events.length} courses · {unowned.length} without an owner
          </p>
        </div>
        <Link href="/portal/users" className="btn-secondary text-sm px-4 py-2">
          User Management
        </Link>
      </div>

      {/* Unowned alert */}
      {unowned.length > 0 ? (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800">
          <strong>{unowned.length} course{unowned.length === 1 ? '' : 's'}</strong> have no
          assigned owner, dept chair, or phase owner. Assign owners from a user&apos;s
          Privileges panel so every course has someone looking after it.
        </div>
      ) : (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Every course has at least one responsible owner. ✓
        </div>
      )}

      {/* Coverage by MCG course — collapsible to phase level */}
      {sortedDepts.map(([dept, deptRows]) => {
        const deptUnowned = deptRows.filter(r => r.owners.length === 0).length
        return (
          <details key={dept} open={deptUnowned > 0} className="group">
            <summary className="cursor-pointer list-none flex items-center gap-3 py-2 select-none">
              <span className="text-gray-400 text-sm transition-transform group-open:rotate-90">▶</span>
              <span className="text-xs font-bold text-tps-navy uppercase tracking-wider">
                {dept} — {deptLabel(dept)}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">{deptRows.length} courses</span>
              <span className={`text-xs ${deptUnowned > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}`}>
                {deptUnowned > 0 ? `${deptUnowned} unowned` : 'covered ✓'}
              </span>
            </summary>

            <div className="card overflow-hidden p-0 mt-1">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {deptRows.map(r => (
                    <tr key={r.id} className={r.owners.length === 0 ? 'bg-amber-50/60' : 'hover:bg-gray-50/50'}>
                      <td className="px-4 py-2 font-mono text-xs text-tps-navy font-bold w-28">
                        <Link href={`/portal/lessons/${encodeURIComponent(r.courseCode)}`} className="hover:text-tps-orange">
                          {r.courseCode}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{r.title}</td>
                      <td className="px-4 py-2 text-right">
                        <QuickAssign eventId={r.id} owners={r.owners} staff={staffOptions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </div>
  )
}
