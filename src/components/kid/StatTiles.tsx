import { Flame, Sparkles } from 'lucide-react'
import { useKidProfile } from '@/hooks/useKidProfile'
import { useFeature, useTerms } from '@/hooks/useSettings'

/**
 * The two small stat cards (day streak, total XP) shown in a sticky rail at
 * the desktop shell (`.khd-card`, kid.css "desktop Home"): Home's own rail and
 * the lesson shell's rail (ui.md "Lesson pages redesign") share this, so the
 * numbers and the Settings > Features gates (streaks/xp) can't drift between them.
 */
export function StatTiles({ gamified }: { gamified: boolean }) {
  const profile = useKidProfile()
  const streaksOn = useFeature('streaks')
  const showStreak = gamified && streaksOn
  const xpOn = useFeature('xp')
  const showXp = gamified && xpOn
  const { lower } = useTerms()
  const value = (n: number | undefined) => (n === undefined ? '–' : n)
  if (!showStreak && !showXp) return null
  return (
    <>
      {showStreak ? (
        <div className="khd-card" data-kind="streak" data-testid="rail-streak">
          <span className="khd-card-icon" aria-hidden>
            <Flame className="size-6" />
          </span>
          <div>
            <p className="khd-card-value kid-num">{value(profile.data?.currentStreak)}</p>
            <p className="khd-card-label">day {lower('streak')}</p>
          </div>
        </div>
      ) : null}
      {showXp ? (
        <div className="khd-card" data-kind="xp" data-testid="rail-xp">
          <span className="khd-card-icon" aria-hidden>
            <Sparkles className="size-6" />
          </span>
          <div>
            <p className="khd-card-value kid-num">{value(profile.data?.totalXp)}</p>
            <p className="khd-card-label">total {lower('xp')}</p>
          </div>
        </div>
      ) : null}
    </>
  )
}
