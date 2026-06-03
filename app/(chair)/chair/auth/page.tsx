import { db } from '@/lib/db'
import { validatePinToken } from '@/lib/pin-auth'
import { redirect } from 'next/navigation'
import { PinForm } from '@/components/ui/pin-form'
import { chairAuthAction } from './actions'
import { TPSBrandHeader } from '@/components/ui/tps-branding'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Panel Chair Access' }

export default async function ChairAuthPage() {
  const token = await validatePinToken('PANEL_CHAIR')

  // Only skip auth if the JWT's class is still active — prevents stale class routing
  if (token) {
    const cls = await db.class.findUnique({
      where: { id: token.classId },
      select: { isActive: true },
    })
    if (cls?.isActive) redirect('/chair')
    // Class is no longer active — fall through to show class selector
  }

  const activeClasses = await db.class.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  })

  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4">
      <div className="w-full max-w-sm">
        <TPSBrandHeader roleLabel="Panel Chair Access" />
        <div className="card">
          {activeClasses.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-gray-700 font-medium">No active class found</p>
              <p className="text-sm text-gray-500">
                Contact your administrator to activate a class.
              </p>
            </div>
          ) : (
            <PinForm
              action={chairAuthAction}
              classes={activeClasses}
              role="PANEL_CHAIR"
              submitLabel="Open Chair Dashboard"
            />
          )}
        </div>
      </div>
    </main>
  )
}
