import { useMemo, useRef } from 'react'
import type { Roadmap } from '@/lib/roadmap'
import { useModuleSpy } from '@/hooks/useModuleSpy'
import { useNodeCenters } from '@/hooks/useNodeCenters'
import { ModuleBar } from './ModuleBar'
import { PathDecor } from './PathDecor'
import { RoadmapConnector } from './RoadmapConnector'
import { RoadmapNode } from './RoadmapNode'

/**
 * The learning path: ONE continuous winding road through every lesson in the
 * states function's order, with no per-module boxes. Module boundaries are
 * invisible on the road itself; the slim sticky `ModuleBar` names whichever
 * module is in view (scroll-spy over each row's module key). The connector is
 * one SVG through all node centres, teal up to the next-up node, and the decor
 * layer sits behind it.
 */
export function RoadmapPath({
  roadmap,
  onOpenLesson,
}: {
  roadmap: Roadmap
  onOpenLesson: (lessonId: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(
    () => roadmap.sections.flatMap((s) => s.lessons.map((lesson) => ({ lesson, section: s }))),
    [roadmap],
  )
  const idKey = rows.map((r) => r.lesson.id).join(',')
  const measure = useNodeCenters(pathRef, idKey)
  const activeKey = useModuleSpy(rootRef, roadmap.sections[0]?.key ?? '', idKey)
  const active = roadmap.sections.find((s) => s.key === activeKey) ?? roadmap.sections[0]

  // Completed lessons always form a prefix of the course order.
  let completed = 0
  for (const { lesson } of rows) {
    if (lesson.state !== 'completed') break
    completed += 1
  }

  return (
    <div className="rm" data-testid="roadmap" ref={rootRef}>
      {active ? <ModuleBar section={active} /> : null}
      <div className="rm-path" ref={pathRef}>
        <PathDecor rows={rows.length} />
        <RoadmapConnector measure={measure} completedCount={completed} />
        {rows.map(({ lesson, section }, i) => (
          <RoadmapNode
            key={lesson.id}
            lesson={lesson}
            index={i}
            moduleKey={section.key}
            isCurrent={lesson.id === roadmap.currentLessonId}
            onOpen={onOpenLesson}
          />
        ))}
      </div>
    </div>
  )
}
