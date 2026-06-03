import { db } from '@/lib/db'
import { validateSandboxToken, verifyPin, issueSandboxToken } from '@/lib/sandbox-auth'
import { redirect, notFound } from 'next/navigation'
import { TPSBrandHeader } from '@/components/ui/tps-branding'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Creator Access' }

interface PageProps { params: Promise<{ token: string }> }

export default async function CreatorAuthPage({ params }: PageProps) {
  const { token } = await params

  const invite = await db.sandboxCreatorInvite.findUnique({
    where:  { linkToken: token },
    select: { id: true, isActive: true, pinHash: true, formSubject: true, recipientName: true },
  })
  if (!invite || !invite.isActive) notFound()

  const alreadyAuthed = await validateSandboxToken('creator', token)
  if (alreadyAuthed) redirect(`/creator/${token}`)

  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4">
      <div className="w-full max-w-sm">
        <TPSBrandHeader roleLabel="Form Creator Access" />
        <div className="card space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Welcome, {invite.recipientName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{invite.formSubject}</p>
          </div>
          <CreatorPinForm token={token} pinHash={invite.pinHash} />
        </div>
      </div>
    </main>
  )
}

// Inline form — uses a server action
function CreatorPinForm({ token, pinHash }: { token: string; pinHash: string }) {
  return (
    <form
      action={async (fd: FormData) => {
        'use server'
        const pin = fd.get('pin')?.toString() ?? ''
        const valid = await verifyPin(pin, pinHash)
        if (!valid) redirect(`/creator/${token}/auth?error=1`)
        await issueSandboxToken('creator', token)
        redirect(`/creator/${token}`)
      }}
      className="space-y-4"
    >
      <div>
        <label className="field-label">Creator PIN</label>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          required
          autoFocus
          className="field-input font-mono text-center text-2xl tracking-[0.5em]"
          placeholder="••••••"
        />
      </div>
      <button type="submit" className="btn-primary w-full">Access Builder</button>
    </form>
  )
}
