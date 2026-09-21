import { cn } from '@/lib/utils'
import type { Roadmap } from '@/lib/roadmap'
import { LessonNode } from './LessonNode'
import { ModuleBanner } from './ModuleBanner'

/**
 * The learning path: one section per module (banner + zigzag nodes), then
 * "More to explore" for ungrouped lessons. Order is the states function's,
 * untouched.
 */
export function RoadmapPath({
  roadmap,
  onOpenLesson,
}: {
  roadmap: Roadmap
  onOpenLesson: (lessonId: string) => void
}) {
  return (
    <div className="rm" data-testid="roadmap">
      {roadmap.sections.map((section) => (
        <section key={section.key} className={cn('mb-2', `mod-${section.colorIndex}`)} data-testid="roadmap-section">
          <ModuleBanner section={section} />
          <div className="rm-path">
            {section.lessons.map((lesson, i) => (
              <LessonNode
                key={lesson.id}
                lesson={lesson}
                index={i}
                isCurrent={lesson.id === roadmap.currentLessonId}
                onOpen={onOpenLesson}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
