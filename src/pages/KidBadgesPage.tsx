import { Award, Lock } from 'lucide-react'
import { useKidHeader } from '@/components/kid/kidHeader'
import { RetryScreen, Screen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { useKidBadges } from '@/hooks/useKidProfile'

/**
 * `/badges`: every active badge, earned ones first in colour, the rest dimmed
 * with a lock. Deliberately minimal (no celebration, no filters): a real design
 * pass is a follow-up.
 */
export function KidBadgesPage() {
  useKidHeader('Badges')
  const badges = useKidBadges()

  if (badges.isPending) {
    return (
      <div className="kb-grid" aria-busy="true" aria-label="Loading your badges">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 w-full rounded-[26px] bg-ink/10" />
        ))}
      </div>
    )
  }
  if (badges.isError) {
    return <RetryScreen title="Oops! We couldn't load your badges" onRetry={() => void badges.refetch()} />
  }
  if (badges.data.length === 0) {
    return (
      <Screen
        testId="state-no-badges"
        icon={<Award className="size-8" aria-hidden />}
        title="No badges yet"
        body="Keep learning and they will show up here."
      />
    )
  }
  const earned = badges.data.filter((b) => b.earned).length
  return (
    <>
      <p className="kb-count" data-testid="badge-count">
        {earned} of {badges.data.length} earned
      </p>
      <ul className="kb-grid" data-testid="badge-grid">
        {badges.data.map((b) => (
          <li key={b.id} className="kb-card kid-card" data-earned={b.earned} data-testid="badge">
            <span className="kb-medal" aria-hidden>
              {b.iconUrl ? <img src={b.iconUrl} alt="" loading="lazy" /> : <Award className="size-9" />}
            </span>
            <span className="kb-name">{b.name}</span>
            {b.description ? <span className="kb-desc">{b.description}</span> : null}
            <span className="kb-state">
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
    </>
  )
}
