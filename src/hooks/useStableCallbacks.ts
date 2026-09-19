import { useEffect, useMemo, useRef } from 'react'

/**
 * Returns an object with the same keys as `handlers` whose functions NEVER
 * change identity but always call the latest handlers.
 *
 * Why it exists: TanStack Table's `FlexRender` treats a column's `cell` /
 * `header` function as a component type. A column array rebuilt every render
 * gives every cell a new type, so React remounts them all — an open row menu
 * closes, and a focused checkbox loses focus the instant its own toggle
 * re-renders the table (which breaks keyboard selection). Memoising the columns
 * fixes that, but the columns close over page-level handlers that are new arrow
 * functions each render; routing them through this object lets the columns
 * depend on stable references only.
 *
 * The set of keys must be the same on every render (it is captured once).
 */
export function useStableCallbacks<T extends Record<string, (...args: never[]) => unknown>>(
  handlers: T,
): T {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  return useMemo(
    () =>
      Object.fromEntries(
        Object.keys(handlers).map((key) => [
          key,
          // The ref is only read when the wrapper is CALLED (an event handler),
          // never while rendering — the compiler rule can't see that.
          // eslint-disable-next-line react-hooks/refs
          (...args: never[]) => latest.current[key](...args),
        ]),
      ) as T,
    // Deliberately empty: the wrappers must keep their identity for the life
    // of the component, and always defer to `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}
