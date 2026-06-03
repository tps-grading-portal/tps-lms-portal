/**
 * Shared auth page shell — dark navy background with X-62 VISTA ghost silhouette.
 * Used by admin login, grader auth, and chair auth pages.
 */
import { X62Silhouette } from './x62-silhouette'
import { TPSBrandHeader } from './tps-branding'

interface TPSAuthPageProps {
  roleLabel: string
  children: React.ReactNode
}

export function TPSAuthPage({ roleLabel, children }: TPSAuthPageProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-tps-navy p-4 relative overflow-hidden">
      {/* X-62 VISTA ghost silhouette — barely visible, adds aviation character */}
      <div className="absolute inset-0 flex items-end justify-start pointer-events-none select-none">
        <X62Silhouette className="w-[85vw] max-w-4xl text-white opacity-[0.055] mb-8 ml-4 translate-y-8" />
      </div>

      {/* Content — sits above the silhouette */}
      <div className="relative z-10 w-full max-w-sm">
        <TPSBrandHeader roleLabel={roleLabel} />
        {children}
      </div>
    </main>
  )
}
