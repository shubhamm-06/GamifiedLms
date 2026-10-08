import { useFeature, useTerms } from '@/hooks/useSettings'
import { KID_TABS } from './kidTabs'

/**
 * The tabs the nav and sidebar actually show: Badges is hidden when the badges
 * feature is off (Settings > Features), and the Badges / Courses labels follow
 * the terminology settings.
 */
export function useKidTabs() {
  const badges = useFeature('badges')
  const { terms } = useTerms()
  return KID_TABS.filter((t) => t.id !== 'badges' || badges).map((t) => ({
    ...t,
    label: t.id === 'badges' ? terms('badge') : t.id === 'courses' ? terms('course') : t.label,
  }))
}
