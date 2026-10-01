import { useSyncExternalStore } from 'react'

/** Subscribes to a CSS media query. Falls back to `false` where matchMedia doesn't exist. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}

export const MD_UP = '(min-width: 768px)'
/** The kid app's desktop shell (sidebar + list-style Home) starts here; `ui.md` "Desktop shell". */
export const LG_UP = '(min-width: 1024px)'
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(REDUCED_MOTION).matches
}
