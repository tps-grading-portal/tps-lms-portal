'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/** Client-side class dropdown — updates the `classId` query param. */
export function ClassSelector({
  classes, selectedClassId,
}: {
  classes: { id: string; name: string }[]
  selectedClassId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (classes.length <= 1) return null

  return (
    <select
      value={selectedClassId}
      onChange={e => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('classId', e.target.value)
        router.push(`${pathname}?${params.toString()}`)
      }}
      className="field-input w-auto text-sm"
    >
      {classes.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
