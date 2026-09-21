/**
 * Pure geometry for the roadmap's winding connector. It only ever sees the
 * measured centres of the real node elements, so it holds at any width and for
 * any lesson count (nothing is hardcoded).
 */

export interface Point {
  x: number
  y: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * A smooth S-curve through the points in order: each segment leaves and
 * arrives vertically (both control points sit at the segment's mid height), so
 * the line weaves left and right between nodes without kinks. Fewer than two
 * points give an empty path.
 */
export function pathThrough(points: Point[]): string {
  if (points.length < 2) return ''
  let d = `M ${r1(points[0].x)} ${r1(points[0].y)}`
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const midY = r1((a.y + b.y) / 2)
    d += ` C ${r1(a.x)} ${midY} ${r1(b.x)} ${midY} ${r1(b.x)} ${r1(b.y)}`
  }
  return d
}

/**
 * The path up to (and including) the node at `lastIndex`: the "travelled" part
 * drawn in gold. With `lastIndex` = number of completed lessons, the gold line
 * runs from the first node through every completed one and on to the next
 * (the active) node, because finishing a lesson opens the way to the following
 * one.
 */
export function pathThroughFirst(points: Point[], lastIndex: number): string {
  return pathThrough(points.slice(0, Math.max(0, Math.min(lastIndex, points.length - 1)) + 1))
}
