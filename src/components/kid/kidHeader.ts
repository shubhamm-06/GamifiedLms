import { createContext, useContext, useEffect } from 'react'

export interface KidHeaderValue {
  title: string
  setTitle: (title: string) => void
  /** Where Back goes when there is no in-app history to return to (a deep link). */
  fallbackPath: string
  setFallbackPath: (path: string) => void
  /** The right end of the top bar, for a page's own small control (the lesson player's time ring). */
  rightSlot: HTMLElement | null
  setRightSlot: (el: HTMLElement | null) => void
}

export const KidHeaderContext = createContext<KidHeaderValue | null>(null)

/**
 * Sets the top bar's title (and the Back fallback) while the calling page is
 * mounted. Pages call it; `KidLayout` owns the bar.
 */
export function useKidHeader(title: string, fallbackPath = '/') {
  const ctx = useContext(KidHeaderContext)
  const setTitle = ctx?.setTitle
  const setFallbackPath = ctx?.setFallbackPath
  useEffect(() => {
    setTitle?.(title)
    setFallbackPath?.(fallbackPath)
  }, [title, fallbackPath, setTitle, setFallbackPath])
}

/** The element at the right end of the top bar; render into it with a portal. Null until mounted. */
export function useKidRightSlot(): HTMLElement | null {
  return useContext(KidHeaderContext)?.rightSlot ?? null
}
