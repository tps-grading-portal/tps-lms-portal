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
  const weekEnd = new Date(start.getTime() + 7 * 86400_000)
  return { start, end, weekEnd }
}

type QuickLink = { href: string; title: string; description: string }

function quickLinksFor(role: UserRole): QuickLink[] {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return [
        { href: '/portal/users',             title: 'User Management',  description: 'Accounts, roles, privileges' },
        { href: '/portal/classes',           title: 'Classes',          description: 'Cohorts, rosters, lifecycle' },
        { href: '/portal/course-owners',     title: 'Course Owners',    description: 'Ownership coverage' },
        { href: '/portal/weighting',         title: 'Weighting Matrix', description: 'Master grading source' },
        { href: '/portal/vault',             title: 'Content Vault',    description: 'Review pipeline' },
        { href: '/portal/surveys',           title: 'Surveys',          description: 'Deploy and sanitize' },
        { href: '/portal/standings',         title: 'Standings',        description: 'Weighted rankings' },
        { href: '/portal/grades/exports',    title: 'Gradebook Exports',description: 'Excel downloads' },
      ]
    case 'DEAN_COMMANDER':
      return [
        { href: '/portal/weighting',         title: 'Weighting Matrix', description: 'Adjust grade weights' },
        { href: '/portal/standings',         title: 'Standings',        description: 'Weighted rankings' },
        { href: '/portal/vault',             title: 'Dean Review',      description: 'Final content approvals' },
        { href: '/portal/analytics',         title: 'Analytics',        description: 'Early warning system' },
      ]
    case 'A9_STANDARDS':
      return [
        { href: '/portal/vault',             title: 'Content Vault',    description: 'A9 review queue' },
        { href: '/portal/surveys',           title: 'Surveys',          description: 'Sanitize and publish' },
        { href: '/portal/analytics',         title: 'Analytics',        description: 'IRR and grader bias' },
        { href: '/portal/standings',         title: 'Standings',        description: 'Weighted rankings' },
      ]
    case 'SCHEDULER':
      return [
        { href: '/portal/academic-schedule', title: 'Academic Schedule',description: 'Class calendars' },
        { href: '/portal/grade',             title: 'Grade Queue',      description: 'Enter grades' },
        { href: '/portal/grades/exports',    title: 'Gradebook Exports',description: 'Pull gradesheets' },
        { href: '/portal/standings',         title: 'Standings',        description: 'Weighted rankings' },
      ]
    case 'STUDENT':
      return [
        { href: '/portal/syllabus',          title: 'Syllabus',         description: 'Your course roadmap' },
        { href: '/portal/academic-schedule', title: 'Schedule',         description: 'Upcoming lessons' },
        { href: '/portal/grades',            title: 'My Grades',        description: 'Scores and feedback' },
        { href: '/portal/chat',              title: 'Chat',             description: 'Digital Squadron' },
      ]
    default: // chairs, ADO/DO, instructors
      return [
        { href: '/portal/grade',             title: 'Grade Queue',      description: 'Enter and submit grades' },
        { href: '/portal/vault',             title: 'Content Vault',    description: 'Submit and review content' },
        { href: '/portal/academic-schedule', title: 'Schedule',         description: 'Class calendars' },
        { href: '/portal/standings',         title: 'Standings',        description: 'Class performance' },
      ]
  }
}

function QuickAccessGrid({ role }: { role: UserRole }) {
  const links = quickLinksFor(role)
  return (
    <section>
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Access</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {links.map(l => (
          <Link key={l.href} href={l.href} className="card block hover:border-tps-orange hover:shadow-md transition-all group py-3">
            <p className="font-semibold text-tps-navy group-hover:text-tps-orange transition-colors text-sm">{l.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{l.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
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
  const { start, end, weekEnd } = todayRange()
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
      <div className="w-full space-y-6">
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

        <QuickAccessGrid role={role} />
      </div>
    )
  }

  // ── Staff dashboard ──────────────────────────────────────────────────────
  const reviewStages = reviewStageFor(role)
  const canGrade = can(role, 'grade:queue')

  const [weekEvents, pendingFiles, gradeCounts, classes, notifications, unownedCount] = await Promise.all([
    // Next 7 days across active + planning classes
    db.classSyllabusSchedule.findMany({
      where: {
        scheduledDate: { gte: start, lte: weekEnd },
        class: { OR: [{ isActive: true }, { isPlanning: true }], archivedAt: null },
      },
      include: {
        syllabusEvent: { select: { courseCode: true, title: true } },
        instructor:    { select: { firstName: true, lastName: true } },
        class:         { select: { name: true } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      take: 14,
    }),
    reviewStages.length > 0
      ? db.contentFile.findMany({
          where:   { status: { in: reviewStages }, isLatest: true },
          include: { syllabusEvent: { select: { courseCode: true } }, uploadedBy: { select: { firstName: true, lastName: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
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
  const pendingReview = reviewStages.length > 0
    ? await db.contentFile.count({ where: { status: { in: reviewStages }, isLatest: true } })
    : 0

  // Standings preview: top 3 per active class by avg submitted score
  const standingsPreview: { className: string; top: { name: string; avg: number }[] }[] = []
  if (can(role, 'view:all_standings')) {
    for (const c of classes.filter(c => c.isActive)) {
      const students = await db.student.findMany({
        where:  { classId: c.id },
        select: {
          firstName: true, lastName: true, number: true,
          entries: { where: { status: 'SUBMITTED', overallScore: { not: null } }, select: { overallScore: true } },
        },
      })
      const ranked = students
        .map(s => ({
          name: `${s.lastName}, ${s.firstName}`.trim() || `#${s.number}`,
          avg:  s.entries.length > 0 ? s.entries.reduce((sum, e) => sum + (e.overallScore ?? 0), 0) / s.entries.length : -1,
        }))
        .filter(s => s.avg >= 0)
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
      if (ranked.length > 0) standingsPreview.push({ className: c.name, top: ranked })
    }
  }

  const stageLabel: Record<string, string> = {
    SANDBOX: 'Draft', PENDING_CHAIR: 'Dept Review', PENDING_A9: 'A9 Review', PENDING_DEAN: 'Dean Review',
  }

  return (
    <div className="w-full space-y-6">
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
        {/* This week's schedule */}
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Next 7 Days</h2>
            <Link href="/portal/academic-schedule" className="text-xs text-tps-blue hover:underline">Calendar →</Link>
          </div>
          {weekEvents.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">Nothing scheduled this week.</p>
          ) : (() => {
            // Group by day so each day reads as its own clearly divided block
            const tomorrow = new Date(start.getTime() + 86400_000)
            const byDay = new Map<string, typeof weekEvents>()
            for (const s of weekEvents) {
              const key = s.scheduledDate?.toISOString().slice(0, 10) ?? '—'
              if (!byDay.has(key)) byDay.set(key, [])
              byDay.get(key)!.push(s)
            }
            return (
              <div className="space-y-3">
                {[...byDay.entries()].map(([dayKey, dayEvents]) => {
                  const d = dayEvents[0].scheduledDate
                  const isToday    = !!d && d >= start && d <= end
                  const isTomorrow = !isToday && !!d &&
                    d.toISOString().slice(0, 10) === tomorrow.toISOString().slice(0, 10)
                  return (
                    <div key={dayKey} className={isToday ? 'rounded-lg bg-tps-orange/5 -mx-2 px-2 py-1' : ''}>
                      {/* Bold day divider */}
                      <div className={`flex items-center gap-2 border-b-2 pb-1 mb-1.5 ${
                        isToday ? 'border-tps-orange' : 'border-gray-300'
                      }`}>
                        <span className={`text-xs font-black uppercase tracking-wide ${
                          isToday ? 'text-tps-orange' : 'text-tps-navy'
                        }`}>
                          {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d?.toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold">
                          {d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map(s => (
                          <Link
                            key={s.id}
                            href={`/portal/lessons/${encodeURIComponent(s.syllabusEvent.courseCode)}?classId=${s.classId}`}
                            className="flex items-center gap-3 py-1 group"
                          >
                            <p className="text-xs font-mono font-bold text-tps-navy w-12 shrink-0">{s.scheduledTime ?? '—'}</p>
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
                    </div>
                  )
                })}
              </div>
            )
          })()}
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

        {/* Awaiting your review — detail */}
        {pendingFiles.length > 0 && (
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Awaiting Your Review</h2>
              <Link href="/portal/vault" className="text-xs text-tps-blue hover:underline">Vault →</Link>
            </div>
            <div className="space-y-2">
              {pendingFiles.map(f => (
                <Link
                  key={f.id}
                  href={f.syllabusEvent ? `/portal/lessons/${encodeURIComponent(f.syllabusEvent.courseCode)}` : '/portal/vault'}
                  className="flex items-center gap-3 py-1.5 group"
                >
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">
                    {stageLabel[f.status] ?? f.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 group-hover:text-tps-orange transition-colors truncate">{f.title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {f.syllabusEvent?.courseCode ?? 'No course'} · by {f.uploadedBy.firstName} {f.uploadedBy.lastName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Standings preview */}
        {standingsPreview.length > 0 && (
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Standings — Top 3</h2>
              <Link href="/portal/standings" className="text-xs text-tps-blue hover:underline">Full standings →</Link>
            </div>
            <div className="space-y-3">
              {standingsPreview.map(sp => (
                <div key={sp.className}>
                  <p className="text-xs font-bold text-tps-navy mb-1">Class {sp.className}</p>
                  <div className="space-y-1">
                    {sp.top.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-2 text-sm">
                        <span className="w-5 text-center font-bold text-gray-400">{i + 1}</span>
                        <span className="flex-1 text-gray-700 truncate">{s.name}</span>
                        <span className="font-bold tabular-nums text-tps-navy">{s.avg.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <QuickAccessGrid role={role} />
    </div>
  )
}
