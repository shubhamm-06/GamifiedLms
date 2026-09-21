import { Lock } from 'lucide-react'
import type { RoadmapSection } from '@/lib/roadmap'

/**
 * A module heading, deliberately NOT tappable-looking: soft gold tint, flat,
 * no press state (Continue is the only candy button on the screen). It shows
 * the module title and one dot per lesson (solid = done, ring = current,
 * faint = to come). The dots are decorative; the text equivalent is visually
 * hidden beside them. Sticks under the top bar while its lessons scroll past.
 */
export function ModuleBanner({
  section,
  currentLessonId,
}: {
  section: RoadmapSection
  currentLessonId: string | null
}) {
  return (
    <div className="rm-banner" data-locked={section.allLocked} data-testid="module-banner">
      <h2 className="rm-banner-title">{section.title}</h2>
      {section.allLocked ? <Lock className="size-5 flex-none" aria-label="Locked" role="img" /> : null}
      <span className="sr-only" data-testid="module-progress-text">
        {section.doneCount} of {section.lessons.length} lessons done
      </span>
      <div className="rm-dots" aria-hidden data-testid="module-dots">
        {section.lessons.map((lesson) => (
          <span
            key={lesson.id}
            className="rm-dot"
            data-s={lesson.state === 'completed' ? 'done' : lesson.id === currentLessonId ? 'current' : 'todo'}
          />
        ))}
      </div>
    </div>
  )
}
