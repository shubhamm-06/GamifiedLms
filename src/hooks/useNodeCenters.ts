import { useEffect, useState, type RefObject } from 'react'
import type { Point } from '@/lib/roadmapPath'

export interface NodeMeasure {
  width: number
  height: number
  points: Point[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

function sameMeasure(a: NodeMeasure | null, b: NodeMeasure): boolean {
  return (
    !!a &&
    a.width === b.width &&
    a.height === b.height &&
    a.points.length === b.points.length &&
    a.points.every((p, i) => p.x === b.points[i].x && p.y === b.points[i].y)
  )
}

/**
 * Measures the centre of every `[data-rm-anchor]` element inside `ref`, relative
 * to `ref`'s own box, and re-measures whenever that box resizes (a rotation, a
 * different phone width) or `depKey` changes (the lessons changed). The anchor
 * is a static wrapper around each node (the bounce and wiggle animate an inner
 * element), so the measurement never jitters.
 */
export function useNodeCenters(ref: RefObject<HTMLElement | null>, depKey: string): NodeMeasure | null {
  const [measure, setMeasure] = useState<NodeMeasure | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const run = () => {
      const box = el.getBoundingClientRect()
      const points = Array.from(el.querySelectorAll<HTMLElement>('[data-rm-anchor]'), (a) => {
        const r = a.getBoundingClientRect()
        return { x: r1(r.left - box.left + r.width / 2), y: r1(r.top - box.top + r.height / 2) }
      })
      const next = { width: r1(box.width), height: r1(box.height), points }
      setMeasure((prev) => (sameMeasure(prev, next) ? prev : next))
    }
    const observer = new ResizeObserver(run)
    observer.observe(el) // also fires once on observe, which is the first measurement
    return () => observer.disconnect()
  }, [ref, depKey])

  return measure
}
