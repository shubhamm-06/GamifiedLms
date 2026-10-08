import { useSyncExternalStore } from 'react'
import { effectiveFeatures, type FeatureKey, type Settings, type TermKey } from '@/lib/settings/schema'
import { getSettingsSnapshot, subscribeSettings } from '@/lib/settings/store'
import { makeTerms, type Terms } from '@/lib/settings/terms'

/** The live settings (validated, defaults filled in). Re-renders when they change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot)
}

export function useBranding(): Settings['branding'] {
  return useSettings().branding
}

export function useThemeSettings(): Settings['theme'] {
  return useSettings().theme
}

/** `term('lesson')` "Lesson", `terms('lesson')` "Lessons", `formatCount('lesson', 3)` "3 Lessons", `lower(...)`. */
export function useTerms(): Terms {
  return makeTerms(useSettings().terminology)
}

/** Whether a feature is on, after the dependency rules (gamification is the master switch). */
export function useFeature(key: FeatureKey): boolean {
  return effectiveFeatures(useSettings().features)[key]
}

export type { TermKey }
