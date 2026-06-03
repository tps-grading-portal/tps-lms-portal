import { db } from '@/lib/db'
import { headers } from 'next/headers'
import { ClassTable } from './class-table'
import { RosterPanel } from './roster-panel'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function AdminPage() {
  const [classes, staffMembers, pendingSessions, totalFinalized] = await Promise.all([
    db.class.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { students: true, sessions: true } },
        students: { orderBy: { number: 'asc' }, select: { id: true, number: true, track: true } },
      },
    }),
    db.staffMember.findMany({ orderBy: { name: 'asc' } }),
    db.gradingSession.count({ where: { status: 'PENDING_RESOLUTION' } }),
    db.gradingSession.count({ where: { status: 'FINALIZED' } }),
  ])

  const activeClass = classes.find((c) => c.isActive)

  const headersList = await headers()
  const host  = headersList.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${proto}://${host}`

  const qrRoutes = [
    { label: 'Grader Form',       path: '/grade',              color: 'bg-blue-50   border-blue-200'   },
    { label: 'Panel Chair',        path: '/chair',              color: 'bg-purple-50 border-purple-200' },
    { label: 'Student Survey',     path: '/survey/student',     color: 'bg-green-50  border-green-200'  },
    { label: 'Instructor Survey',  path: '/survey/instructor',  color: 'bg-amber-50  border-amber-200'  },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-tps-navy">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {activeClass ? `Active class: ${activeClass.name}` : 'No active class'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Class"           value={activeClass?.name ?? '—'}        color="blue"   />
        <StatCard label="Open / In-Progress"     value={activeClass?._count?.sessions ?? 0} color="gray"  />
        <StatCard label="Pending Discontinuities" value={pendingSessions}                   color="amber"  />
        <StatCard label="Total Finalized"         value={totalFinalized}                   color="green"  />
      </div>

      {/* QR Codes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Access QR Codes</h2>
          <Link href="/admin/classes" className="text-sm text-tps-blue hover:underline">
            Manage classes →
          </Link>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Permanent URLs — print and post in the exam room. Never need to be updated.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {qrRoutes.map(({ label, path, color }) => {
            const fullUrl = `${baseUrl}${path}`
            return (
              <div key={path} className={`card border ${color} flex flex-col items-center gap-2 p-4`}>
                <p className="text-xs font-semibold text-gray-700 text-center">{label}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr?url=${encodeURIComponent(fullUrl)}`}
                  alt={`QR code for ${label}`}
                  width={140}
                  height={140}
                  className="rounded"
                />
                <p className="text-[10px] text-gray-400 text-center break-all">{fullUrl}</p>
                <a
                  href={`/api/qr?url=${encodeURIComponent(fullUrl)}`}
                  download={`qr-${label.toLowerCase().replace(/\s+/g, '-')}.svg`}
                  className="text-xs text-tps-blue hover:underline"
                >
                  Download SVG
                </a>
              </div>
            )
          })}
        </div>
      </section>

      {/* Create Class — use the full wizard to ensure criteria are snapshotted correctly */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Create New Class</h2>
        <div className="card border border-gray-200 max-w-lg flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-800">Class Creation Wizard</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Review criteria, scenarios, PINs, and surveys before creating.
              Grading criteria are frozen at creation.
            </p>
          </div>
          <Link href="/admin/classes/new" className="btn-primary text-sm flex-shrink-0">
            Start Wizard →
          </Link>
        </div>
      </section>

      {/* Roster for active class */}
      {activeClass && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            Roster &amp; Scenarios — Class {activeClass.name}
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Add students, scenarios, and staff before graders arrive.
          </p>
          <RosterPanel
            classId={activeClass.id}
            className={activeClass.name}
            students={activeClass.students}
            staffMembers={staffMembers}
          />
        </section>
      )}

      {/* Class table */}
      {classes.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">All Classes</h2>
            <Link href="/admin/classes" className="text-sm text-tps-blue hover:underline">
              Full view + export →
            </Link>
          </div>
          <ClassTable classes={classes} />
        </section>
      )}
    </div>
  )
}

function StatCard({
  label, value, color,
}: {
  label: string
  value: string | number
  color: 'blue' | 'gray' | 'amber' | 'green'
}) {
  const colors = {
    blue:  'bg-blue-50 border-blue-200 text-blue-700',
    gray:  'bg-gray-50 border-gray-200 text-gray-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }
  return (
    <div className={`card border ${colors[color]} flex flex-col gap-1`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
