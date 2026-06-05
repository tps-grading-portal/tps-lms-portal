'use client'

import { useState } from 'react'
import { createInstructorAction, resetInstructorPinAction, toggleInstructorActiveAction } from '../actions'
import { cn } from '@/lib/utils'

interface Instructor { id: string; name: string; isActive: boolean; createdAt: Date }

export function InstructorManagerPanel({ instructors: initial }: { instructors: Instructor[] }) {
  const [instructors, setInstructors] = useState(initial)
  const [name,        setName]        = useState('')
  const [pin,         setPin]         = useState('')
  const [creating,    setCreating]    = useState(false)
  const [error,       setError]       = useState('')
  const [pinReset,    setPinReset]    = useState<{ id: string; pin: string } | null>(null)
  const [newPinInput, setNewPinInput] = useState('')
  const [expandReset, setExpandReset] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim() || !pin.trim()) { setError('Name and PIN required.'); return }
    setCreating(true); setError('')
    const res = await createInstructorAction(name.trim(), pin.trim())
    setCreating(false)
    if ('error' in res) { setError(res.error); return }
    setName(''); setPin('')
    // Refresh
    window.location.reload()
  }

  const handleResetPin = async (id: string) => {
    const newPin = newPinInput.trim() || Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
    const res = await resetInstructorPinAction(id, newPin)
    if ('success' in res) {
      setPinReset({ id, pin: newPin })
      setExpandReset(null); setNewPinInput('')
    }
  }

  const handleToggle = async (id: string) => {
    await toggleInstructorActiveAction(id)
    setInstructors((prev) => prev.map((i) => i.id === id ? { ...i, isActive: !i.isActive } : i))
  }

  return (
    <div className="space-y-6">
      {/* Add instructor */}
      <div className="card border border-gray-200 space-y-4">
        <h2 className="font-semibold text-gray-800">Add Instructor</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Maj. Smith" className="field-input" />
          </div>
          <div>
            <label className="field-label">Initial PIN</label>
            <input value={pin} onChange={(e) => setPin(e.target.value)}
              type="text" inputMode="numeric" placeholder="e.g. 123456"
              className="field-input font-mono tracking-widest" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={handleCreate} disabled={creating} className="btn-primary text-sm">
          {creating ? 'Creating…' : 'Add Instructor'}
        </button>
      </div>

      {/* Instructor list */}
      <div className="space-y-2">
        {instructors.map((inst) => (
          <div key={inst.id} className={cn('card border space-y-3',
            inst.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
          )}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-tps-navy">{inst.name}</p>
                <p className="text-xs text-gray-400">
                  {inst.isActive ? 'Active' : 'Inactive'} · Added {new Date(inst.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setExpandReset(expandReset === inst.id ? null : inst.id); setPinReset(null) }}
                  className="btn-secondary text-xs">
                  Reset PIN
                </button>
                <button onClick={() => handleToggle(inst.id)}
                  className={cn('text-xs px-2 py-1 rounded border',
                    inst.isActive ? 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'
                                  : 'border-green-200 text-green-600 hover:border-green-400'
                  )}>
                  {inst.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>

            {expandReset === inst.id && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <input value={newPinInput} onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="New PIN (leave blank to auto-generate)"
                    className="field-input font-mono tracking-widest text-sm" />
                </div>
                <button onClick={() => handleResetPin(inst.id)} className="btn-primary text-sm flex-shrink-0">Set</button>
              </div>
            )}

            {pinReset?.id === inst.id && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-amber-800 mb-1">⚠ New PIN — share with instructor now</p>
                <p className="font-mono text-xl font-bold tracking-widest text-tps-navy">{pinReset.pin}</p>
              </div>
            )}
          </div>
        ))}
        {instructors.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No instructors yet.</p>
        )}
      </div>
    </div>
  )
}
