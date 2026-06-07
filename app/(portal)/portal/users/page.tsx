import Link from 'next/link'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { QuickReset } from './quick-reset'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'User Management' }

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const { role } = session.user

  if (!can(role, 'manage:users')) return null

  const users = await db.user.findMany({
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, lastLoginAt: true, createdAt: true,
    },
  })

  const ROLE_LABELS: Record<string, string> = {
    SYSTEM_ADMIN: 'System Admin', DEAN_COMMANDER: 'Dean', A9_STANDARDS: 'A9',
    DEPT_CHAIR: 'Dept Chair', LINE_INSTRUCTOR: 'Instructor', STUDENT: 'Student',
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tps-navy">User Management</h1>
          <p className="text-gray-500 text-sm">{users.length} portal accounts</p>
        </div>
        <Link href="/portal/users/new" className="btn-primary text-sm px-4 py-2">
          + Add User
        </Link>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Last Login</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-tps-navy">
                  <Link href={`/portal/users/${u.id}`} className="hover:underline">
                    {u.lastName}, {u.firstName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-tps-navy/10 text-tps-navy">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <QuickReset userId={u.id} name={`${u.firstName} ${u.lastName}`.trim()} email={u.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
