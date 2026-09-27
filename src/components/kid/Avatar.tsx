import type { AvatarAccent, AvatarBase, AvatarConfig, AvatarFace, AvatarTopper } from '@/lib/avatar'

/**
 * The one place the avatar is drawn. Every screen that shows an avatar (the
 * builder's live preview, the profile page, the nav tab) renders this same
 * component from the same `AvatarConfig` — nothing else builds SVG for it or
 * duplicates a piece of this geometry.
 *
 * An abstract emblem, not a character: a bold coloured base circle, a crest
 * ("topper") above it, a banner across it (the `face` field — the name is
 * unchanged from migration 026's stored shape, only what it draws changed:
 * it was literal eyes and a mouth, now it is a geometric band, so nothing
 * here reads as a face), and a small corner mark ("accent"). Every one of the
 * four pieces has to read on its own at nav-tab size (~28px), so each is a
 * single bold shape, never a fussy multi-part drawing.
 *
 * Pure shapes (circle, path, polygon) on a 100x100 viewBox, coloured only with
 * the locked tokens via inline `style` (an SVG presentation attribute can't
 * resolve `var()`; a style property can), so nothing here is a hex literal.
 * The whole emblem gets one candy-style drop shadow in the base colour's `-d`
 * shade, the same lift every other circular icon in the app has. `size` is
 * the rendered box in CSS pixels; the SVG itself scales to fill it.
 */
export function Avatar({
  config,
  size = 40,
  className,
  'data-testid': testId = 'avatar',
}: {
  config: AvatarConfig
  size?: number
  className?: string
  'data-testid'?: string
}) {
  const { base, topper, face, accent } = config
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Avatar"
      data-testid={testId}
      data-base={base}
      data-topper={topper}
      data-face={face}
      data-accent={accent}
      style={{ overflow: 'visible', filter: `drop-shadow(0 3px 0 var(--${base}-d))` }}
    >
      <Topper shape={topper} base={base} />
      <circle cx="50" cy="54" r="38" style={{ fill: `var(--${base})` }} />
      <Band shape={face} base={base} />
      <Accent shape={accent} />
      <circle cx="50" cy="54" r="38" style={{ fill: 'none', stroke: `var(--${base}-d)`, strokeWidth: 3 }} />
    </svg>
  )
}

/** A crest above the circle: one bold, chunky shape per option, sized to stay legible small. */
function Topper({ shape, base }: { shape: AvatarTopper; base: AvatarBase }) {
  const shadow = `var(--${base}-d)`
  switch (shape) {
    case 'spiky':
      return <polygon points="14,28 26,2 38,28 50,0 62,28 74,2 86,28 80,38 20,38" style={{ fill: shadow }} />
    case 'round':
      return <path d="M 14 32 A 36 30 0 0 1 86 32 L 86 42 L 14 42 Z" style={{ fill: shadow }} />
    case 'star':
      return (
        <polygon
          points="50,0 61,22 85,25 67,42 72,66 50,54 28,66 33,42 15,25 39,22"
          style={{ fill: shadow }}
        />
      )
    case 'antenna':
      return (
        <>
          <rect x="44" y="4" width="12" height="26" rx="6" style={{ fill: shadow }} />
          <circle cx="50" cy="6" r="9" style={{ fill: shadow }} />
        </>
      )
    case 'bow':
      return (
        <g transform="translate(50 14)">
          <polygon points="0,0 -22,-12 -22,12" style={{ fill: shadow }} />
          <polygon points="0,0 22,-12 22,12" style={{ fill: shadow }} />
        </g>
      )
    case 'none':
      return null
  }
}

/** A single geometric band across the circle: a crest banner, never eyes or a mouth. */
function Band({ shape, base }: { shape: AvatarFace; base: AvatarBase }) {
  const cream = 'var(--cream)'
  const shadow = `var(--${base}-d)`
  switch (shape) {
    case 'happy':
      return <rect x="22" y="49" width="56" height="12" rx="6" style={{ fill: cream }} />
    case 'wink':
      return <rect x="18" y="49" width="64" height="12" rx="6" transform="rotate(-10 50 55)" style={{ fill: cream }} />
    case 'silly':
      return (
        <path
          d="M 22 50 L 34 58 L 46 50 L 58 58 L 70 50 L 78 58"
          style={{ fill: 'none', stroke: cream, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }}
        />
      )
    case 'cool':
      return (
        <>
          <rect x="22" y="45" width="56" height="7" rx="3.5" style={{ fill: cream }} />
          <rect x="22" y="59" width="56" height="7" rx="3.5" style={{ fill: cream }} />
        </>
      )
    case 'sleepy':
      return (
        <>
          <rect x="24" y="51" width="14" height="9" rx="4.5" style={{ fill: cream }} />
          <rect x="43" y="51" width="14" height="9" rx="4.5" style={{ fill: cream }} />
          <rect x="62" y="51" width="14" height="9" rx="4.5" style={{ fill: cream }} />
        </>
      )
    default:
      return <rect x="22" y="49" width="56" height="12" rx="6" style={{ fill: shadow, opacity: 0 }} />
  }
}

/** A small corner mark, bottom-right — the profile page's own edit-pencil badge sits opposite it (top-right), so the two never overlap. */
function Accent({ shape }: { shape: AvatarAccent }) {
  const ink = 'var(--ink)'
  switch (shape) {
    case 'star':
      return (
        <polygon
          points="74,72 78,80 87,81 80,87 82,96 74,92 66,96 68,87 61,81 70,80"
          style={{ fill: 'var(--gold)', stroke: ink, strokeWidth: 2 }}
        />
      )
    case 'stripe':
      return (
        <rect
          x="12"
          y="48"
          width="76"
          height="11"
          rx="5.5"
          transform="rotate(-20 50 54)"
          style={{ fill: 'var(--cream)', opacity: 0.55 }}
        />
      )
    case 'dot':
      return (
        <>
          <circle cx="70" cy="72" r="4" style={{ fill: 'var(--cream)', opacity: 0.95 }} />
          <circle cx="81" cy="64" r="3.2" style={{ fill: 'var(--cream)', opacity: 0.95 }} />
          <circle cx="63" cy="82" r="2.6" style={{ fill: 'var(--cream)', opacity: 0.95 }} />
        </>
      )
    case 'heart':
      return (
        <path
          d="M 75 76 C 70 71, 62 74, 62 80 C 62 85, 75 94, 75 94 C 75 94, 88 85, 88 80 C 88 74, 80 71, 75 76 Z"
          style={{ fill: 'var(--coral)', stroke: ink, strokeWidth: 1.5 }}
        />
      )
    case 'none':
      return null
  }
}
