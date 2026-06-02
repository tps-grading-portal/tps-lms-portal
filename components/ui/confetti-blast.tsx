'use client'

import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'

/**
 * Fires a cartoon-style confetti burst from a party horn on mount.
 * The horn bounces in, then confetti shoots out from it.
 */
export function ConfettiBlast() {
  const hornRef   = useRef<HTMLDivElement>(null)
  const [popped, setPopped] = useState(false)

  useEffect(() => {
    // Short delay so the horn animation is visible first
    const timer = setTimeout(() => {
      setPopped(true)
      fireConfetti()
    }, 400)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Party horn with bounce-in then tilt animation */}
      <div
        ref={hornRef}
        className={`text-6xl select-none transition-all duration-300 ${
          popped
            ? 'animate-horn-pop'
            : 'scale-0 opacity-0'
        }`}
        style={{
          animation: popped ? undefined : 'none',
          transform: popped ? undefined : 'scale(0)',
          fontSize: '4rem',
        }}
      >
        🎉
      </div>
    </div>
  )
}

function fireConfetti() {
  // Cartoon-style: big chunky pieces in bright colors, shot from bottom-center
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F1C', '#2EC4B6']

  const origin = { x: 0.5, y: 0.75 }

  // First burst — wide fan from the horn
  confetti({
    particleCount: 80,
    angle: 90,
    spread: 100,
    startVelocity: 55,
    decay: 0.88,
    gravity: 0.9,
    origin,
    colors,
    shapes: ['square', 'circle'],
    scalar: 1.4,        // bigger pieces = more cartoon
    ticks: 300,
  })

  // Second burst after a tiny delay — adds depth
  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 75,
      spread: 60,
      startVelocity: 45,
      decay: 0.9,
      gravity: 0.8,
      origin: { x: 0.4, y: 0.75 },
      colors,
      shapes: ['square'],
      scalar: 1.2,
      ticks: 250,
    })
    confetti({
      particleCount: 40,
      angle: 105,
      spread: 60,
      startVelocity: 45,
      decay: 0.9,
      gravity: 0.8,
      origin: { x: 0.6, y: 0.75 },
      colors,
      shapes: ['square'],
      scalar: 1.2,
      ticks: 250,
    })
  }, 150)
}
