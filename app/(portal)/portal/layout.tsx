import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PortalTopNav } from '@/components/portal/portal-topnav'
import { PortalSidebar } from '@/components/portal/portal-sidebar'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { firstName, lastName, role } = session.user

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalTopNav firstName={firstName} lastName={lastName} role={role} />
      <PortalSidebar role={role} />

      {/* Main content — offset for top nav + sidebar */}
      <main className="pt-14 md:pl-52 min-h-screen">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  )
}
