import { Skeleton } from '@/components/ui/skeleton'

/** Shaped like the player (chips, a content block, a bar) so nothing jumps when it loads. */
export function PlayerSkeleton() {
  return (
    <div className="lp" data-testid="player-skeleton" aria-busy="true" aria-label="Loading your lesson">
      <div className="lp-meta">
        <Skeleton className="h-7 w-20 rounded-full bg-ink/10" />
        <Skeleton className="h-7 w-24 rounded-full bg-ink/10" />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-[20px] bg-ink/10" />
      <Skeleton className="mt-4 h-5 w-3/4 rounded-lg bg-ink/10" />
      <Skeleton className="mt-2 h-5 w-1/2 rounded-lg bg-ink/10" />
    </div>
  )
}
