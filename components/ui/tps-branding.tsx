/**
 * Shared TPS branding elements used on all login / auth screens.
 * Keeps the identity consistent across Admin, Grader, and Chair entry points.
 */
export function TPSBrandHeader({
  subtitle,
  roleLabel,
}: {
  subtitle?: string
  roleLabel?: string
}) {
  return (
    <div className="text-center mb-8">
      {/* Grad patch */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/grad-patch.png"
        alt="USAF Test Pilot School Graduate"
        width={120}
        height={140}
        className="mx-auto mb-4 drop-shadow-lg"
      />

      {/* School name — gold on navy */}
      <p className="text-tps-gold font-bold tracking-widest text-xs uppercase">
        USAF Test Pilot School
      </p>

      {/* Portal title */}
      <h1 className="text-white text-2xl font-black mt-1 tracking-wide">
        {subtitle ?? 'Grading Portal'}
      </h1>

      {/* Role label — orange accent */}
      {roleLabel && (
        <p className="text-tps-orange font-semibold text-sm mt-1">{roleLabel}</p>
      )}
    </div>
  )
}

/** Small inline patch badge for header bars */
export function TPSPatchBadge({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/grad-patch.png"
      alt="TPS"
      width={size}
      height={size}
      className="object-contain"
    />
  )
}
