import { Info } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useFeature } from '@/hooks/useSettings'
import type { FeatureKey } from '@/lib/settings/schema'

/**
 * Shown on an admin page whose feature is switched off in Settings > Features.
 * Admins are never blocked: the page still works, this only says learners won't see it.
 */
export function FeatureOffBanner({ feature }: { feature: FeatureKey }) {
  if (useFeature(feature)) return null
  return (
    <div className="bg-muted text-muted-foreground mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm" role="status" data-testid="feature-off-banner">
      <Info className="size-4 shrink-0" aria-hidden />
      <span>
        This feature is turned off in{' '}
        <Link to="/admin/settings" search={{ tab: 'features' }} className="text-foreground underline underline-offset-2">
          Settings
        </Link>
        . Learners don&rsquo;t see it.
      </span>
    </div>
  )
}
