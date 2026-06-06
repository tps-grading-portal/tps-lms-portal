import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id: userId, role, firstName } = session.user

  // Load contextual stats based on role
  const [classCount, userCount, alertCount] = await Promise.all([
    db.class.count(),
    can(role, 'manage:users') ? db.user.count() : Promise.resolve(null),
    db.studentAlert.count({ where: { resolvedAt: null } }),
  ])

  // Role-specific quick links rendered on the dashboard
  const quickLinks = getQuickLinks(role)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-tps-navy">
          Welcome back, {firstName}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          USAF Test Pilot School — Learning Management System
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatTile label="Active Classes" value={classCount} />

        {alertCount > 0 && (
          <StatTile
            label="Open Alerts"
            value={alertCount}
            href="/portal/analytics"
            highlight="amber"
          />
        )}

        {userCount !== null && (
          <StatTile label="Portal Users" value={userCount} href="/portal/users" />
        )}
      </div>

      {/* Quick access grid */}
      {quickLinks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quickLinks.map(link => (
              <QuickLinkCard key={link.href} {...link} />
            ))}
          </div>
        </section>
      )}

      {/* Role description banner */}
      <RoleBanner role={role} />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  href,
  highlight,
}: {
  label:      string
  value:      number
  href?:      string
  highlight?: 'amber' | 'red'
}) {
  const inner = (
    <div
      className={`card flex flex-col gap-1 ${
        highlight === 'amber' ? 'border-amber-300 bg-amber-50' :
        highlight === 'red'   ? 'border-red-300   bg-red-50'   : ''
      }`}
    >
      <span className="text-2xl font-black text-tps-navy">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
  if (href) {
    return <a href={href} className="block hover:opacity-80 transition-opacity">{inner}</a>
  }
  return inner
}

type QuickLink = { href: string; title: string; description: string }

function QuickLinkCard({ href, title, description }: QuickLink) {
  return (
    <a
      href={href}
      className="card block hover:border-tps-orange hover:shadow-md transition-all group"
    >
      <p className="font-semibold text-tps-navy group-hover:text-tps-orange transition-colors text-sm">
        {title}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </a>
  )
}

function RoleBanner({ role }: { role: string }) {
  const DESCRIPTIONS: Record<string, string> = {
    SYSTEM_ADMIN:    'You have full system access. Use User Management to onboard new staff and students.',
    DEAN_COMMANDER:  'Strategic overview: manage the Dean\'s Weighting Matrix, review standings, and monitor class health.',
    A9_STANDARDS:    'Content Vault gatekeeper and survey anonymity shield. All raw survey data routes through you.',
    DEPT_CHAIR:      'Review content submissions from your instructors and monitor department-level analytics.',
    LINE_INSTRUCTOR: 'Submit course content for review, enter grades, and view flight schedules.',
    STUDENT:         'Track your progress on the syllabus roadmap and view your grades below.',
  }
  const desc = DESCRIPTIONS[role]
  if (!desc) return null
  return (
    <div className="rounded-xl bg-tps-navy/5 border border-tps-navy/10 px-4 py-3 text-sm text-gray-700">
      {desc}
    </div>
  )
}

function getQuickLinks(role: string): QuickLink[] {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return [
        { href: '/portal/users',     title: 'User Management',     description: 'Manage accounts and roles' },
        { href: '/portal/classes',   title: 'Classes',             description: 'Create and manage cohorts' },
        { href: '/portal/analytics', title: 'Analytics',           description: 'System-wide performance view' },
        { href: '/portal/vault',     title: 'Content Vault',       description: 'Review and approve content' },
        { href: '/portal/surveys',   title: 'Survey Module',       description: 'Manage and sanitize surveys' },
        { href: '/portal/weighting', title: 'Weighting Matrix',    description: 'Dean\'s track × event weights' },
      ]
    case 'DEAN_COMMANDER':
      return [
        { href: '/portal/weighting', title: 'Weighting Matrix',    description: 'Adjust Dean\'s grade weights' },
        { href: '/portal/standings', title: 'Class Standings',     description: 'Full weighted standings board' },
        { href: '/portal/analytics', title: 'Analytics',           description: 'Class-wide performance trends' },
      ]
    case 'A9_STANDARDS':
      return [
        { href: '/portal/vault',     title: 'Content Vault',       description: 'Approve or archive content' },
        { href: '/portal/surveys',   title: 'Survey Sanitization', description: 'Strip names, generate reports' },
        { href: '/portal/analytics', title: 'Analytics',           description: 'IRR and grader bias review' },
      ]
    case 'DEPT_CHAIR':
      return [
        { href: '/portal/vault',     title: 'Content Review',      description: 'Review instructor submissions' },
        { href: '/portal/standings', title: 'Dept Standings',      description: 'Track-level performance view' },
        { href: '/portal/analytics', title: 'Dept Analytics',      description: 'Department trend analysis' },
      ]
    case 'LINE_INSTRUCTOR':
      return [
        { href: '/portal/vault',     title: 'Submit Content',      description: 'Upload course materials' },
        { href: '/portal/schedule',  title: 'Flight Schedule',     description: 'Today\'s flight and ground ops' },
        { href: '/portal/standings', title: 'Standings',           description: 'Class performance view' },
      ]
    case 'STUDENT':
      return [
        { href: '/portal/syllabus',  title: 'Syllabus Roadmap',    description: 'Your course progression map' },
        { href: '/portal/grades',    title: 'My Grades',           description: 'View your graded events' },
        { href: '/portal/schedule',  title: 'Flight Schedule',     description: 'Check today\'s schedule' },
      ]
    default:
      return []
  }
}
