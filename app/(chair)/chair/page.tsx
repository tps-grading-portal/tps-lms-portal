import { validatePinToken } from '@/lib/pin-auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { clearPinToken } from '@/lib/pin-auth'
import { getSessionDisplayData } from '@/lib/session-processor'
import { SessionGrid } from './session-grid'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Panel Chair Dashboard' }

export default async function ChairPage() {
  const token = await validatePinToken('PANEL_CHAIR')
  if (!token) redirect('/chair/auth')

  // Second-line defence: redirect to auth if the class is no longer active.
  // Cannot call clearPinToken here (Server Component — cookies are read-only).
  const classCheck = await db.class.findUnique({
    where: { id: token.classId },
    select: { isActive: true, name: true },
  })
  if (!classCheck?.isActive) redirect('/chair/auth')

  const cls = classCheck

  const initialData = await getSessionDisplayData(token.classId)

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between sticky top-0 z-20 border-b-2 border-tps-orange">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/grad-patch.png" alt="TPS" width={28} height={28} className="object-contain" />
          <div>
            <p className="text-tps-gold font-bold text-[9px] tracking-widest uppercase leading-none">Panel Chair</p>
            <p className="text-white font-semibold text-sm leading-none mt-0.5">
              Class {cls?.name ?? '…'}
              <span className="text-tps-silver font-normal text-xs ml-2">
                {initialData.sessions.length} session{initialData.sessions.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
        </div>
        <form
          action={async () => {
            'use server'
            await clearPinToken('PANEL_CHAIR')
            redirect('/chair/auth')
          }}
        >
          <button type="submit" className="text-tps-silver text-xs hover:text-white min-h-[44px] px-2">
            Exit
          </button>
        </form>
      </header>

      {/* Legend */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-grade-discontinuity border border-amber-400 inline-block" />
          Discontinuity (&gt;2 pts apart)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-red-200 border border-red-400 inline-block" />
          Fail grade
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
          Chair-edited
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          Live — updates every 3s
        </span>
      </div>

      {/* Session grid */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <SessionGrid initialData={initialData} classId={token.classId} />
      </div>
    </main>
  )
}
