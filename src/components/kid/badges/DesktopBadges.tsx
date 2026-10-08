import { Award, Lock } from 'lucide-react'
import { DesktopPageHeader } from '@/components/kid/DesktopPageHeader'
import { useTerms } from '@/hooks/useSettings'
import { Skeleton } from '@/components/ui/skeleton'
import type { KidBadge } from '@/hooks/useKidProfile'

/**
 * `/badges` at >= 1024px: the same badges as mobile (`useKidBadges`, no new
 * query), as a wider grid with a page header instead of the centered 2/3-column
 * list. Cards are not interactive on desktop either — mobile's own `<li>` rows
 * have no `onClick` and no detail view, so neither does this.
 */
export function DesktopBadges({ badges }: { badges: KidBadge[] }) {
  const earned = badges.filter((b) => b.earned).length
  const { terms } = useTerms()
  return (
    <div className="kbd" data-testid="badges-desktop">
      <DesktopPageHeader title={terms('badge')} subtitle={`${earned} of ${badges.length} earned`} />
      <ul className="kbd-grid" data-testid="badge-grid">
        {badges.map((b) => (
          <li key={b.id} className="kbd-card kid-card" data-earned={b.earned} data-testid="badge">
            <span className="kbd-medal" aria-hidden>
              {b.iconUrl ? <img src={b.iconUrl} alt="" loading="lazy" /> : <Award className="size-9" />}
            </span>
            <span className="kbd-name">{b.name}</span>
            {b.description ? <span className="kbd-desc">{b.description}</span> : null}
            <span className="kbd-state">
              {b.earned ? (
                'Earned'
              ) : (
                <>
                  <Lock className="size-4" aria-hidden /> Not yet
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DesktopBadgesSkeleton() {
  const { terms, lower } = useTerms()
  return (
    <div className="kbd" data-testid="badges-desktop-skeleton" aria-busy="true" aria-label={`Loading your ${lower('badge', true)}`}>
      <DesktopPageHeader title={terms('badge')} />
      <div className="kbd-grid">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-[26px] bg-ink/10" />
        ))}
      </div>
    </div>
  )
}
