import { db } from '@/lib/db'
import { validatePinToken } from '@/lib/pin-auth'
import { redirect } from 'next/navigation'
import { PinForm } from '@/components/ui/pin-form'
import { graderAuthAction } from './actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Grader Access' }

export default async function GraderAuthPage() {
  // Already authenticated — skip to the form
  const token = await validatePinToken('GRADER')
  if (token) redirect('/grade')

  const activeClasses = await db.class.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  })

  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-tps-gold mb-4">
            <span className="text-tps-navy font-black text-xl">TPS</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Grader Access</h1>
          <p className="text-tps-silver text-sm mt-1">
            Enter the room PIN provided by your Panel Chair
          </p>
        </div>

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
      </div>
    </main>
  )
}
