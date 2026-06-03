import { db } from '@/lib/db'
import { validateSandboxToken } from '@/lib/sandbox-auth'
import { redirect, notFound } from 'next/navigation'
import { FormBuilder } from './form-builder'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Form Builder' }

interface PageProps { params: Promise<{ token: string }> }

export default async function CreatorPage({ params }: PageProps) {
  const { token } = await params

  const authed = await validateSandboxToken('creator', token)
  if (!authed) redirect(`/creator/${token}/auth`)

  const invite = await db.sandboxCreatorInvite.findUnique({
    where:   { linkToken: token },
    include: {
      form: {
        include: { questions: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  })
  if (!invite || !invite.isActive) notFound()

  const headersList = await headers()
  const host  = headersList.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${proto}://${host}`

  const staffMembers = await db.staffMember.findMany({
    where:   { isActive: true },
    orderBy: { name: 'asc' },
    select:  { id: true, name: true },
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-tps-navy text-white px-4 h-14 flex items-center justify-between border-b-2 border-tps-orange">
        <div>
          <p className="text-tps-gold font-bold text-[9px] tracking-widest uppercase leading-none">The Sandbox</p>
          <p className="text-white font-semibold text-sm leading-none mt-0.5">Form Builder</p>
        </div>
        <p className="text-tps-silver text-xs">{invite.formSubject}</p>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <FormBuilder
          token={token}
          existingForm={invite.form}
          staffMembers={staffMembers}
          baseUrl={baseUrl}
        />
      </div>
    </main>
  )
}
