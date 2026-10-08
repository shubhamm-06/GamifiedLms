import { FeatureOffBanner } from '@/components/admin/FeatureOffBanner'
import { BadgesSection } from '@/components/admin/gamification/BadgesSection'
import { LevelThresholdsSection } from '@/components/admin/gamification/LevelThresholdsSection'

/**
 * Two stacked sections on one page, not tabs — unlike Settings, neither is a
 * small config form, and an admin editing one usually wants the other in
 * view (a new badge's XP threshold is only meaningful against the level
 * curve below it).
 */
export function GamificationPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <FeatureOffBanner feature="gamification" />
      <BadgesSection />
      <LevelThresholdsSection />
    </div>
  )
}
