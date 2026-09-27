import type { AvatarAccent, AvatarBase, AvatarConfig, AvatarFace, AvatarTopper } from '@/lib/avatar'

/**
 * The one place the avatar is drawn. Every screen that shows an avatar (the
 * builder's live preview, the profile page, the nav tab) renders this same
 * component from the same `AvatarConfig` — nothing else builds SVG for it or
 * duplicates a piece of this geometry. Pure shapes (circle, path, polygon) on
 * a 100x100 viewBox, coloured only with the locked tokens via inline `style`
 * (an SVG presentation attribute can't resolve `var()`; a style property can),
 * so nothing here is a hex literal. `size` is the rendered box in CSS pixels;
 * the SVG itself scales to fill it.
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
    >
      <Topper shape={topper} base={base} />
      <circle cx="50" cy="54" r="38" style={{ fill: `var(--${base})` }} />
      <Accent shape={accent} />
      <Face shape={face} />
      <circle cx="50" cy="54" r="38" style={{ fill: 'none', stroke: `var(--${base}-d)`, strokeWidth: 3 }} />
    </svg>
  )
}

function Topper({ shape, base }: { shape: AvatarTopper; base: AvatarBase }) {
  const shadow = `var(--${base}-d)`
  switch (shape) {
    case 'spiky':
      return (
        <polygon
          points="16,26 24,4 32,26 40,2 48,26 56,2 64,26 72,4 80,26 76,34 20,34"
          style={{ fill: shadow }}
        />
      )
    case 'round':
      return <path d="M 16 30 A 34 26 0 0 1 84 30 L 84 40 L 16 40 Z" style={{ fill: shadow }} />
    case 'star':
      return (
        <polygon
          points="50,2 58,20 78,22 63,35 68,55 50,44 32,55 37,35 22,22 42,20"
          style={{ fill: shadow }}
        />
      )
    case 'antenna':
      return (
        <>
          <line x1="34" y1="22" x2="30" y2="4" style={{ stroke: shadow, strokeWidth: 4, strokeLinecap: 'round' }} />
          <line x1="66" y1="22" x2="70" y2="4" style={{ stroke: shadow, strokeWidth: 4, strokeLinecap: 'round' }} />
          <circle cx="30" cy="4" r="6" style={{ fill: shadow }} />
          <circle cx="70" cy="4" r="6" style={{ fill: shadow }} />
        </>
      )
    case 'bow':
      return (
        <g transform="translate(50 10)">
          <polygon points="0,0 -18,-9 -18,9" style={{ fill: shadow }} />
          <polygon points="0,0 18,-9 18,9" style={{ fill: shadow }} />
          <circle cx="0" cy="0" r="5" style={{ fill: shadow }} />
        </g>
      )
    case 'none':
      return null
  }
}

function Face({ shape }: { shape: AvatarFace }) {
  const eyeWhite = 'var(--cream)'
  const ink = 'var(--ink)'
  switch (shape) {
    case 'happy':
      return (
        <>
          <circle cx="38" cy="50" r="7" style={{ fill: eyeWhite }} />
          <circle cx="62" cy="50" r="7" style={{ fill: eyeWhite }} />
          <circle cx="38" cy="51" r="3.5" style={{ fill: ink }} />
          <circle cx="62" cy="51" r="3.5" style={{ fill: ink }} />
          <path d="M 36 66 Q 50 78 64 66" style={{ fill: 'none', stroke: ink, strokeWidth: 4, strokeLinecap: 'round' }} />
        </>
      )
    case 'wink':
      return (
        <>
          <circle cx="38" cy="50" r="7" style={{ fill: eyeWhite }} />
          <circle cx="38" cy="51" r="3.5" style={{ fill: ink }} />
          <path d="M 57 50 Q 62 46 67 50" style={{ fill: 'none', stroke: ink, strokeWidth: 4, strokeLinecap: 'round' }} />
          <path d="M 36 66 Q 50 76 64 66" style={{ fill: 'none', stroke: ink, strokeWidth: 4, strokeLinecap: 'round' }} />
        </>
      )
    case 'silly':
      return (
        <>
          <circle cx="37" cy="49" r="7" style={{ fill: eyeWhite }} />
          <circle cx="63" cy="49" r="7" style={{ fill: eyeWhite }} />
          <circle cx="35" cy="47" r="3.5" style={{ fill: ink }} />
          <circle cx="65" cy="47" r="3.5" style={{ fill: ink }} />
          <path d="M 34 64 Q 50 80 66 64 Z" style={{ fill: ink }} />
          <path d="M 45 70 Q 50 82 55 70 Z" style={{ fill: 'var(--coral)' }} />
        </>
      )
    case 'cool':
      return (
        <>
          <rect x="28" y="45" width="44" height="10" rx="5" style={{ fill: ink }} />
          <path d="M 40 66 Q 50 70 60 66" style={{ fill: 'none', stroke: ink, strokeWidth: 4, strokeLinecap: 'round' }} />
        </>
      )
    case 'sleepy':
      return (
        <>
          <path d="M 32 50 Q 38 54 44 50" style={{ fill: 'none', stroke: ink, strokeWidth: 4, strokeLinecap: 'round' }} />
          <path d="M 56 50 Q 62 54 68 50" style={{ fill: 'none', stroke: ink, strokeWidth: 4, strokeLinecap: 'round' }} />
          <circle cx="50" cy="68" r="4" style={{ fill: ink }} />
        </>
      )
  }
}

function Accent({ shape }: { shape: AvatarAccent }) {
  const ink = 'var(--ink)'
  switch (shape) {
    case 'star':
      return (
        <polygon
          points="76,74 79,80 86,81 81,86 82,93 76,90 70,93 71,86 66,81 73,80"
          style={{ fill: 'var(--gold)', stroke: ink, strokeWidth: 1.5 }}
        />
      )
    case 'stripe':
      return (
        <rect
          x="14"
          y="49"
          width="72"
          height="10"
          rx="5"
          transform="rotate(-18 50 54)"
          style={{ fill: 'var(--cream)', opacity: 0.85 }}
        />
      )
    case 'dot':
      return (
        <>
          <circle cx="72" cy="70" r="3" style={{ fill: 'var(--cream)', opacity: 0.9 }} />
          <circle cx="80" cy="62" r="2.4" style={{ fill: 'var(--cream)', opacity: 0.9 }} />
          <circle cx="65" cy="78" r="2" style={{ fill: 'var(--cream)', opacity: 0.9 }} />
        </>
      )
    case 'heart':
      return (
        <path
          d="M 78 78 C 74 74, 68 76, 68 81 C 68 85, 78 92, 78 92 C 78 92, 88 85, 88 81 C 88 76, 82 74, 78 78 Z"
          style={{ fill: 'var(--coral)', stroke: ink, strokeWidth: 1.2 }}
        />
      )
    case 'none':
      return null
  }
}
