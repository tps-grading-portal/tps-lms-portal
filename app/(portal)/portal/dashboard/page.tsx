import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import type { Metadata } from 'next'
import type { UserRole, ContentStatus } from '@prisma/client'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end   = new Date(); end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** Which review stage this role acts on (for the "needs your review" tile) */
function reviewStageFor(role: UserRole): ContentStatus[] {
  switch (role) {
    case 'SYSTEM_ADMIN':   return ['PENDING_CHAIR', 'PENDING_A9', 'PENDING_DEAN']
    case 'A9_STANDARDS':   return ['PENDING_A9']
    case 'DEAN_COMMANDER': return ['PENDING_DEAN']
    case 'DEPT_CHAIR':
    case 'ADO':
    case 'DO':             return ['PENDING_CHAIR']
    default:               return []
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id: userId, role, firstName } = session.user
  const { start, end } = todayRange()
  const isStudent = role === 'STUDENT'

  // ── Student dashboard ────────────────────────────────────────────────────
  if (isStudent) {
    const student = await db.student.findFirst({
      where: { userId },
      include: { class: { select: { id: true, name: true, startDate: true } } },
    })

    const [upcoming, recentGrades, progress, notifications] = await Promise.all([
      student
        ? db.classSyllabusSchedule.findMany({
            where: {
              classId:       student.classId,
              scheduledDate: { gte: start },
              syllabusEvent: { tracks: { has: student.track } },
            },
            include: {
              syllabusEvent: { select: { courseCode: true, title: true } },
              instructor:    { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
            take: 6,
          })
        : Promise.resolve([]),
      student
        ? db.gradebookEntry.findMany({
            where:   { studentId: student.id, status: 'SUBMITTED' },
            include: { template: { select: { courseCode: true, title: true } } },
            orderBy: { submittedAt: 'desc' },
            take: 4,
          })
        : Promise.resolve([]),
      student
        ? db.studentSyllabusEvent.groupBy({
            by: ['status'],
            where: { studentId: student.id },
            _count: true,
          })
        : Promise.resolve([]),
      db.notification.findMany({
        where:   { userId, readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ])

    const completed = progress.find(p => p.status === 'COMPLETED')?._count ?? 0
    const totalEvents = progress.reduce((n, p) => n + p._count, 0)

    // Class week number
    let weekNum: number | null = null
    if (student?.class.startDate) {
      weekNum = Math.floor((Date.now() - student.class.startDate.getTime()) / (7 * 86400_000))
    }

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">Welcome back, {firstName}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {student ? `Class ${student.class.name}${weekNum !== null && weekNum >= 0 ? ` · Week ${weekNum}` : ''} · ${student.track} track` : 'USAF Test Pilot School LMS'}
          </p>
        </div>

        {/* Unread notifications */}
        {notifications.length > 0 && (
          <div className="space-y-2">
            {notifications.map(n => (
              <Link key={n.id} href={n.href ?? '#'} className="block rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-900 hover:bg-blue-100 transition-colors">
                🔔 {n.title}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upcoming schedule */}
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Coming Up</h2>
              <Link href="/portal/academic-schedule" className="text-xs text-tps-blue hover:underline">Full schedule →</Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">Nothing scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(s => (
                  <Link
                    key={s.id}
                    href={`/portal/lessons/${encodeURIComponent(s.syllabusEvent.courseCode)}`}
                    className="flex items-center gap-3 py-1.5 group"
                  >
                    <div className="text-center w-12 shrink-0">
                      <p className="text-[10px] text-gray-400 uppercase">
                        {s.scheduledDate?.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-sm font-bold text-tps-navy">
                        {s.scheduledDate?.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-tps-orange transition-colors truncate">
                        <span className="font-mono">{s.syllabusEvent.courseCode}</span> · {s.syllabusEvent.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.scheduledTime}{s.locationRoom && ` · ${s.locationRoom}`}
                        {s.instructor && ` · ${s.instructor.firstName} ${s.instructor.lastName}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recent grades + progress */}
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Grades</h2>
              <Link href="/portal/grades" className="text-xs text-tps-blue hover:underline">All grades →</Link>
            </div>
            {recentGrades.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No graded events yet.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {recentGrades.map(g => (
                  <div key={g.id} className="flex items-center justify-between gap-3 py-1">
                    <p className="text-sm text-gray-700 truncate">
                      <span className="font-mono font-bold text-tps-navy">{g.template.courseCode}</span> · {g.template.title}
                    </p>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${
                      (g.overallScore ?? 0) >= 80 ? 'text-green-700' : (g.overallScore ?? 0) >= 70 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {g.overallScore?.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
            {totalEvents > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Course progress</span>
                  <span>{completed}/{totalEvents}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${totalEvents ? (completed / totalEvents) * 100 : 0}%` }} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    )
  }

  // ── Staff dashboard ──────────────────────────────────────────────────────
  const reviewStages = reviewStageFor(role)
  const canGrade = can(role, 'grade:queue')

  const [todaysEvents, pendingReview, gradeCounts, classes, notifications, unownedCount] = await Promise.all([
    db.classSyllabusSchedule.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        class: { OR: [{ isActive: true }, { isPlanning: true }], archivedAt: null },
      },
      include: {
        syllabusEvent: { select: { courseCode: true, title: true } },
        instructor:    { select: { firstName: true, lastName: true } },
        class:         { select: { name: true } },
      },
      orderBy: { scheduledTime: 'asc' },
      take: 10,
    }),
    reviewStages.length > 0
      ? db.contentFile.count({ where: { status: { in: reviewStages }, isLatest: true } })
      : Promise.resolve(0),
    canGrade
      ? db.gradebookEntry.groupBy({
          by: ['status'],
          where: { student: { class: { isActive: true, archivedAt: null } } },
          _count: true,
        })
      : Promise.resolve([]),
    db.class.findMany({
      where:   { archivedAt: null, OR: [{ isActive: true }, { isPlanning: true }] },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { students: true } } },
    }),
    db.notification.findMany({
      where:   { userId, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
    role === 'SYSTEM_ADMIN'
      ? db.syllabusEvent.count({
          where: { isActive: true, courseAssignments: { none: {} } },
        })
      : Promise.resolve(0),
  ])

  const notStarted = gradeCounts.find(g => g.status === 'NOT_STARTED')?._count ?? 0
  const inProgress = gradeCounts.find(g => g.status === 'IN_PROGRESS')?._count ?? 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tps-navy">Welcome back, {firstName}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Unread notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map(n => (
            <Link key={n.id} href={n.href ?? '#'} className="block rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-900 hover:bg-blue-100 transition-colors">
              🔔 {n.title}
            </Link>
          ))}
        </div>
      )}

      {/* Action tiles — things that need attention */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {reviewStages.length > 0 && (
          <Link href="/portal/vault" className={`card text-center hover:shadow-md transition-shadow ${pendingReview > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
            <p className={`text-2xl font-black ${pendingReview > 0 ? 'text-amber-600' : 'text-tps-navy'}`}>{pendingReview}</p>
            <p className="text-xs text-gray-500 mt-0.5">Awaiting Your Review</p>
          </Link>
        )}
        {canGrade && (
          <>
            <Link href="/portal/grade" className="card text-center hover:shadow-md transition-shadow">
              <p className="text-2xl font-black text-tps-navy">{notStarted}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sheets Not Started</p>
            </Link>
            <Link href="/portal/grade" className={`card text-center hover:shadow-md transition-shadow ${inProgress > 0 ? 'border-amber-200' : ''}`}>
              <p className="text-2xl font-black text-amber-600">{inProgress}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sheets In Progress</p>
            </Link>
          </>
        )}
        {role === 'SYSTEM_ADMIN' && (
          <Link href="/portal/course-owners" className={`card text-center hover:shadow-md transition-shadow ${unownedCount > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
            <p className={`text-2xl font-black ${unownedCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>{unownedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Unowned Courses</p>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's schedule */}
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today&apos;s Schedule</h2>
            <Link href="/portal/academic-schedule" className="text-xs text-tps-blue hover:underline">Calendar →</Link>
          </div>
          {todaysEvents.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">Nothing scheduled today.</p>
          ) : (
            <div className="space-y-2">
              {todaysEvents.map(s => (
                <Link
                  key={s.id}
                  href={`/portal/lessons/${encodeURIComponent(s.syllabusEvent.courseCode)}`}
                  className="flex items-center gap-3 py-1.5 group"
                >
                  <span className="text-sm font-mono font-bold text-tps-navy w-14 shrink-0">
                    {s.scheduledTime ?? '—'}
                  </span>
                  <span className="text-[10px] font-bold bg-tps-navy/10 text-tps-navy px-1.5 py-0.5 rounded shrink-0">
                    {s.class.name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 group-hover:text-tps-orange transition-colors truncate">
                      <span className="font-mono font-semibold">{s.syllabusEvent.courseCode}</span> · {s.syllabusEvent.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {s.locationRoom ?? ''}{s.instructor && ` · ${s.instructor.firstName} ${s.instructor.lastName}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Classes snapshot */}
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Classes</h2>
            {can(role, 'manage:classes') && (
              <Link href="/portal/classes" className="text-xs text-tps-blue hover:underline">Manage →</Link>
            )}
          </div>
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No active classes.</p>
          ) : (
            <div className="space-y-2">
              {classes.map(c => {
                const weekNum = c.startDate
                  ? Math.floor((Date.now() - c.startDate.getTime()) / (7 * 86400_000))
                  : null
                return (
                  <div key={c.id} className="flex items-center gap-3 py-1.5">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
                      c.isActive ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {c.name}
                    </span>
                    <div className="flex-1 text-sm text-gray-600">
                      {c._count.students} students
                      {weekNum !== null && weekNum >= 0 && c.isActive && ` · Week ${weekNum}`}
                      {!c.isActive && c.isPlanning && ' · planning'}
                    </div>
                    {can(role, 'manage:classes') && (
                      <Link href={`/portal/classes/${c.id}`} className="text-xs text-tps-blue hover:underline shrink-0">
                        Roster
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
