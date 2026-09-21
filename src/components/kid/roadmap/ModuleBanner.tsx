import { Lock } from 'lucide-react'
import type { RoadmapSection } from '@/lib/roadmap'

/** Sticky under the top bar while this section's lessons scroll past. */
export function ModuleBanner({ section }: { section: RoadmapSection }) {
  return (
    <div className="rm-banner" data-locked={section.allLocked} data-testid="module-banner">
      <div className="min-w-0 flex-1">
        <p className="rm-banner-eyebrow">{section.eyebrow}</p>
        <h2 className="rm-banner-title">{section.title}</h2>
      </div>
      {section.allLocked ? <Lock className="size-6 flex-none" aria-label="Locked" role="img" /> : null}
      <span className="rm-banner-count">
        {section.doneCount} of {section.lessons.length} done
      </span>
    </div>
  )
}
