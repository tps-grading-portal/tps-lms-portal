import { db } from '@/lib/db'
import { validatePinToken } from '@/lib/pin-auth'
import { redirect } from 'next/navigation'
import { PinForm } from '@/components/ui/pin-form'
import { graderAuthAction } from './actions'
import { TPSAuthPage } from '@/components/ui/tps-auth-page'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Grader Access' }

export default async function GraderAuthPage() {
  const token = await validatePinToken('GRADER')

  if (token) {
    const cls = await db.class.findUnique({
      where: { id: token.classId },
      select: { isActive: true },
    })
    if (cls?.isActive) redirect('/grade')
  }

  const activeClasses = await db.class.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  })

  return (
    <TPSAuthPage roleLabel="Grader Access">
      <div className="card">
        {activeClasses.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-gray-700 font-medium">No active class found</p>
            <p className="text-sm text-gray-500">
              Contact your administrator to activate a class before grading begins.
            </p>
          </div>
        ) : (
          <PinForm
            action={graderAuthAction}
            classes={activeClasses}
            role="GRADER"
            submitLabel="Enter Grader Room"
          />
        )}
      </div>
    </TPSAuthPage>
  )
}
