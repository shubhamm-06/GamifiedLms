import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Roadmap, RoadmapSection } from '@/lib/roadmap'
import { useNodeCenters } from '@/hooks/useNodeCenters'
import { ModuleBanner } from './ModuleBanner'
import { RoadmapConnector } from './RoadmapConnector'
import { RoadmapNode } from './RoadmapNode'

/** How many lessons at the front of the section are completed (they always form a prefix). */
function leadingCompleted(section: RoadmapSection): number {
  let n = 0
  for (const l of section.lessons) {
    if (l.state !== 'completed') break
    n += 1
  }
  return n
}

function SectionPath({
  section,
  currentLessonId,
  onOpenLesson,
}: {
  section: RoadmapSection
  currentLessonId: string | null
  onOpenLesson: (lessonId: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const measure = useNodeCenters(ref, section.lessons.map((l) => l.id).join(','))
  return (
    <div className="rm-path" ref={ref}>
      <RoadmapConnector measure={measure} completedCount={leadingCompleted(section)} />
      {section.lessons.map((lesson, i) => (
        <RoadmapNode
          key={lesson.id}
          lesson={lesson}
          index={i}
          isCurrent={lesson.id === currentLessonId}
          onOpen={onOpenLesson}
        />
      ))}
    </div>
  )
}

/**
 * The learning path: one section per module (banner + winding path of nodes),
 * then "More to explore" for ungrouped lessons. Order is the states function's,
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
          <ModuleBanner section={section} currentLessonId={roadmap.currentLessonId} />
          <SectionPath section={section} currentLessonId={roadmap.currentLessonId} onOpenLesson={onOpenLesson} />
        </section>
      ))}
    </div>
  )
}
