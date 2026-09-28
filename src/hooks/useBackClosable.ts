import { useEffect, useRef } from 'react'
import { addLeaveGuard, pushOverlay } from '@/lib/backButton'

/**
 * Registers `close` with the Android Back overlay registry while `open` is true
 * (lib/backButton.ts). Every overlay a child can open must call this (rules.md).
 * The latest `close` is always used, so callers can pass an inline function.
 * Harmless on the web: nothing reads the registry there.
 */
export function useBackClosable(open: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!open) return
    return pushOverlay(() => closeRef.current())
  }, [open])
}

/** While `active`, Android Back asks "Leave this lesson?" before leaving. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return
    return addLeaveGuard()
  }, [active])
}
