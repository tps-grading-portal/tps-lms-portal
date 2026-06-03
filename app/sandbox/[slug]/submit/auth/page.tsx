import { db } from '@/lib/db'
import { validateSandboxToken, verifyPin, issueSandboxToken } from '@/lib/sandbox-auth'
import { redirect, notFound } from 'next/navigation'
import { TPSBrandHeader } from '@/components/ui/tps-branding'

interface PageProps { params: Promise<{ slug: string }> }

export default async function SubmitAuthPage({ params }: PageProps) {
  const { slug } = await params

  const form = await db.sandboxForm.findUnique({
    where:  { submitSlug: slug },
    select: { id: true, isActive: true, title: true, submitPinHash: true },
  })
  if (!form || !form.isActive) notFound()

  const authed = await validateSandboxToken('submit', slug)
  if (authed) redirect(`/sandbox/${slug}/submit`)

  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4">
      <div className="w-full max-w-sm">
        <TPSBrandHeader roleLabel="Form Access" />
        <div className="card space-y-4">
          <p className="font-medium text-gray-800 text-sm">{form.title}</p>
          <form
            action={async (fd: FormData) => {
              'use server'
              const pin = fd.get('pin')?.toString() ?? ''
              const valid = await verifyPin(pin, form.submitPinHash)
              if (!valid) redirect(`/sandbox/${slug}/submit/auth?error=1`)
              await issueSandboxToken('submit', slug)
              redirect(`/sandbox/${slug}/submit`)
            }}
            className="space-y-4"
          >
            <div>
              <label className="field-label">Access PIN</label>
              <input name="pin" type="password" inputMode="numeric" required autoFocus
                className="field-input font-mono text-center text-2xl tracking-[0.5em]" placeholder="••••••" />
            </div>
            <button type="submit" className="btn-primary w-full">Enter</button>
          </form>
        </div>
      </div>
    </main>
  )
}
