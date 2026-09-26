import type { CSSProperties } from 'react'
import { weaveOffset } from '@/lib/roadmapWeave'

const KINDS = ['blob', 'dots', 'squiggle', 'ring', 'sparkle'] as const

/**
 * The path's background: soft procedural shapes (blobs, dot clusters, a
 * squiggle, a ring, a sparkle) drawn from the colour tokens with low opacity,
 * one per row, on whichever side the row's node is NOT. Pure CSS/SVG, no
 * artwork, no motion, aria-hidden and behind everything (it is a texture, not
 * a focal point). Placement is a function of the row index alone, so it is
 * stable and needs no measuring; rows are a fixed height (`--rm-row-h`).
 */
export function PathDecor({ rows }: { rows: number }) {
  return (
    <div className="rm-decor" aria-hidden="true" data-testid="path-decor">
      {Array.from({ length: rows }, (_, i) => {
        const off = weaveOffset(i)
        // Opposite the node; for a centred node alternate sides.
        const side = off > 0 ? 'left' : off < 0 ? 'right' : i % 2 === 0 ? 'left' : 'right'
        const kind = KINDS[(i * 3 + 1) % KINDS.length]
        return (
          <span
            key={i}
            className={`rm-decor-item rm-decor-${kind}`}
            data-side={side}
            style={{ '--i': i, '--v': i % 3 } as CSSProperties}
          >
            {kind === 'squiggle' ? (
              <svg viewBox="0 0 80 24" width="100%" height="100%" focusable="false">
                <path d="M2 14 C 12 2, 22 2, 30 12 S 50 24, 60 12 S 72 4, 78 10" />
              </svg>
            ) : null}
            {kind === 'sparkle' ? (
              <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false">
                <path d="M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4 Z" />
              </svg>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
