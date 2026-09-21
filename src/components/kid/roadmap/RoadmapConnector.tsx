import { pathThrough, pathThroughFirst } from '@/lib/roadmapPath'
import type { NodeMeasure } from '@/hooks/useNodeCenters'

/**
 * The winding line behind a module's nodes: a solid rounded stroke through the
 * measured node centres, muted tan for the way still to go and gold for the way
 * already travelled. Decorative (aria-hidden); the states live on the nodes.
 * Not animated, so there is nothing for prefers-reduced-motion to switch off.
 */
export function RoadmapConnector({
  measure,
  completedCount,
}: {
  measure: NodeMeasure | null
  completedCount: number
}) {
  if (!measure || measure.points.length < 2) return null
  const full = pathThrough(measure.points)
  const done = completedCount > 0 ? pathThroughFirst(measure.points, completedCount) : ''
  return (
    <svg
      className="rm-svg"
      width={measure.width}
      height={measure.height}
      viewBox={`0 0 ${measure.width} ${measure.height}`}
      aria-hidden="true"
      focusable="false"
      data-testid="roadmap-connector"
    >
      <path className="rm-line rm-line-base" d={full} data-testid="connector-base" />
      {done ? <path className="rm-line rm-line-done" d={done} data-testid="connector-done" /> : null}
    </svg>
  )
}
