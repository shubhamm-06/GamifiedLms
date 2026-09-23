import { useEffect, useState } from 'react'

/**
 * Turns true only after `delayMs` of `condition` staying true (spec Part A7:
 * "show the loading skeleton only after 200ms, so fast loads do not flash
 * it"). The returned value is gated on the current `condition` at render
 * time, so it hides again the instant `condition` goes false, even before
 * the internal timer state has reset. Used to gate a loading skeleton, never
 * the data itself.
 */
export function useDelayedFlag(condition: boolean, delayMs = 200): boolean {
  const [firedAt, setFiredAt] = useState<boolean>(false)

  useEffect(() => {
    if (!condition) return
    const id = window.setTimeout(() => setFiredAt(true), delayMs)
    return () => {
      window.clearTimeout(id)
      setFiredAt(false)
    }
  }, [condition, delayMs])

  return condition && firedAt
}
