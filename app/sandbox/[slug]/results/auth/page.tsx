import { db } from '@/lib/db'
import { validateSandboxToken, verifyPin, issueSandboxToken } from '@/lib/sandbox-auth'
import { redirect, notFound } from 'next/navigation'
import { TPSBrandHeader } from '@/components/ui/tps-branding'

interface PageProps { params: Promise<{ slug: string }> }

export default async function ResultsAuthPage({ params }: PageProps) {
  const { slug } = await params

  const form = await db.sandboxForm.findUnique({
    where:  { resultsSlug: slug },
    select: { id: true, isActive: true, title: true, resultsPinHash: true },
  })
  if (!form || !form.isActive) notFound()

  const authed = await validateSandboxToken('results', slug)
  if (authed) redirect(`/sandbox/${slug}/results`)

  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4">
      <div className="w-full max-w-sm">
        <TPSBrandHeader roleLabel="Results Access" />
        <div className="card space-y-4">
          <p className="font-medium text-gray-800 text-sm">{form.title}</p>
          <form
            action={async (fd: FormData) => {
              'use server'
              const pin = fd.get('pin')?.toString() ?? ''
              const valid = await verifyPin(pin, form.resultsPinHash)
              if (!valid) redirect(`/sandbox/${slug}/results/auth?error=1`)
              await issueSandboxToken('results', slug)
              redirect(`/sandbox/${slug}/results`)
            }}
            className="space-y-4"
          >
            <div>
              <label className="field-label">Results PIN</label>
              <input name="pin" type="password" inputMode="numeric" required autoFocus
                className="field-input font-mono text-center text-2xl tracking-[0.5em]" placeholder="••••••" />
            </div>
            <button type="submit" className="btn-primary w-full">View Results</button>
          </form>
        </div>
      </div>
    </main>
  )
}
