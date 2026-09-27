import { useCallback, useState } from 'react'

const STORAGE_KEY = 'kid.soundEffectsEnabled'

function readStored(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/**
 * Whether the kid app's sound effects are on. Persisted to this device's
 * `localStorage`, not a `profiles` column — a pure per-device convenience
 * with no need to sync across devices or survive a reinstall, so it needed
 * no migration. Defaults to on. **No sound effects are actually wired up
 * anywhere in the app yet** — this is the preference switch, ready for when
 * they are (a later task reads it before playing anything).
 */
export function useSoundEffects() {
  const [enabled, setEnabledState] = useState(readStored)

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Private browsing / blocked storage: the toggle still works for this session, just doesn't persist.
    }
  }, [])

  return [enabled, setEnabled] as const
}
