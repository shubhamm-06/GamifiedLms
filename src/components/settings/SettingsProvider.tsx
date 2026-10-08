import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readPublicSettings, type SectionKey } from '@/lib/settings/schema'
import { getSettingsVersions, publicSettingsQueryKey, setSettings } from '@/lib/settings/store'

/** A fetch that gives up after 3 s: the app then keeps what it has (cache or defaults). */
async function fetchPublicSettings() {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('settings timeout')), 3000))
  const call = supabase.rpc('get_public_settings').then(({ data, error }) => {
    if (error) throw error
    return data
  })
  return readPublicSettings(await Promise.race([call, timeout]))
}

/**
 * Keeps the live settings in step with the server: `get_public_settings()` through
 * react-query (5 min stale time, refetch on focus). A newer version replaces the
 * snapshot and the cache; a failure or a slow answer changes nothing (the app keeps
 * the cached or default settings, silently). Renders its children at once: the
 * theme was already applied from the cache before React started (`bootSettings`).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: publicSettingsQueryKey,
    queryFn: fetchPublicSettings,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  })

  useEffect(() => {
    if (!data) return
    const known = getSettingsVersions()
    const changed = (Object.keys(data.versions) as SectionKey[]).some((k) => data.versions[k] !== known[k])
    if (changed) setSettings(data)
  }, [data])

  return children
}
