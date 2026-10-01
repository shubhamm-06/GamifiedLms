import { useEffect, useId, useState, type ReactNode } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { tintFor, type AvatarConfig, type AvatarTintSlot } from '@/lib/avatar'
import { ANCHOR, AVATAR_FACE_VIEWBOX, AVATAR_LAYERS, AVATAR_VIEWBOX, cssColor, lightOf, type AvatarLayer } from './avatar/geometry'
import { lookupPart } from './avatar/registry'

/**
 * The one place the avatar is drawn. Every screen that shows an avatar (the
 * builder's preview and option tiles, the profile page, the nav tab, the desktop
 * sidebar) renders this component from a config that has already been through
 * `normalizeAvatarConfig` (useKidProfile does that).
 *
 * A small geometric mascot: a gradient body with a soft highlight, a pale face
 * plate, and parts drawn back to front in the fixed AVATAR_LAYERS order against
 * the shared anchors (avatar/geometry.ts), so any combination fits. Parts come
 * from the registry (avatar/registry.tsx). Colours are tokens only, set through
 * `style`. NO SVG filters (costly and inconsistent in Android WebView): depth is
 * gradients and plain shapes.
 *
 * Gradient and clipPath ids are prefixed with a per-instance `useId`, because
 * dozens of avatars share one page (nav, hero, builder tiles); a shared id would
 * make every one of them pick up the first instance's gradient.
 *
 * `animated` (the builder's big preview only): a slow idle bob, an occasional
 * blink, and a small pop when `popKey` changes. All of it is off under
 * prefers-reduced-motion, and a static avatar is a plain <svg> with no motion code.
 * `view="face"` zooms the viewBox into the face for the Eyes/Mouth/Glasses tiles.
 */
export function Avatar({
  config,
  size = 40,
  className,
  animated = false,
  popKey,
  view = 'full',
  label = 'Avatar',
  'data-testid': testId = 'avatar',
}: {
  config: AvatarConfig
  size?: number
  className?: string
  animated?: boolean
  popKey?: number
  view?: 'full' | 'face'
  /** Accessible name. Pass `null`-ish "" via aria-hidden on a wrapper for decorative tiles instead. */
  label?: string
  'data-testid'?: string
}) {
  const uid = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const reduced = useReducedMotion()
  const live = animated && !reduced
  const blink = useBlink(live)
  const pop = useAnimationControls()
  useEffect(() => {
    if (live && popKey) void pop.start({ scale: [1, 1.06, 1], transition: { duration: 0.3, ease: 'easeOut' } })
  }, [live, popKey, pop])

  const byLayer = collectLayers(config, uid)
  const svg = (
    <svg
      viewBox={view === 'face' ? AVATAR_FACE_VIEWBOX : `0 0 ${AVATAR_VIEWBOX} ${AVATAR_VIEWBOX}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label}
      data-testid={testId}
      data-base={config.base}
      data-eyes={config.eyes}
      data-mouth={config.mouth}
      data-glasses={config.glasses}
      data-head={config.head}
      data-extra={config.extra}
      data-backdrop={config.backdrop}
      style={{ display: 'block' }}
    >
      {AVATAR_LAYERS.map((layer) => {
        if (layer === 'body') return <Body key={layer} base={config.base} uid={uid} />
        const nodes = byLayer[layer]
        if (nodes.length === 0) return null
        if (layer === 'eyes') {
          return (
            <g key={layer} data-layer={layer} style={{ transform: blink ? 'scaleY(0.1)' : 'none', transformOrigin: `50px ${ANCHOR.eyeY}px`, transition: 'transform 90ms ease-out' }}>
              {nodes}
            </g>
          )
        }
        return (
          <g key={layer} data-layer={layer}>
            {nodes}
          </g>
        )
      })}
    </svg>
  )

  if (!animated) return svg
  return (
    <motion.div animate={pop} style={{ width: size, height: size }}>
      <motion.div animate={live ? { y: [0, -2.5, 0] } : { y: 0 }} transition={live ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : undefined}>
        {svg}
      </motion.div>
    </motion.div>
  )
}

/** True for ~130ms about every 4s (a little jittered so it does not look mechanical); always false when not live. */
function useBlink(live: boolean): boolean {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (!live) return
    let closer: ReturnType<typeof setTimeout>
    let opener: ReturnType<typeof setTimeout>
    const schedule = () => {
      closer = setTimeout(() => {
        setBlink(true)
        opener = setTimeout(() => {
          setBlink(false)
          schedule()
        }, 130)
      }, 3400 + Math.random() * 1400)
    }
    schedule()
    return () => {
      clearTimeout(closer)
      clearTimeout(opener)
    }
  }, [live])
  return live && blink
}

/** Every chosen part's node, grouped by the layer it draws in. */
function collectLayers(config: AvatarConfig, uid: string): Record<AvatarLayer, ReactNode[]> {
  const out = Object.fromEntries(AVATAR_LAYERS.map((l) => [l, [] as ReactNode[]])) as unknown as Record<AvatarLayer, ReactNode[]>
  const add = (category: 'eyes' | 'mouth' | 'glasses' | 'head' | 'extra' | 'backdrop', slot?: AvatarTintSlot) => {
    const entry = lookupPart(category, config[category])
    if (!entry) return
    const tint = slot ? tintFor(config, slot) : null
    out[entry.layer].push(<entry.Render key={`${category}-${config[category]}`} tint={cssColor(tint ?? 'ink')} base={config.base} uid={uid} />)
  }
  add('backdrop', 'backdrop')
  add('extra', 'extra')
  add('eyes')
  add('mouth')
  add('glasses', 'glasses')
  add('head', 'head')
  return out
}

/** Gradient body, ground shadow, soft highlight and the pale plate the face sits on. */
function Body({ base, uid }: { base: AvatarConfig['base']; uid: string }) {
  const body = `var(--${base})`
  const dark = `var(--${base}-d)`
  const { cx, bodyCy, bodyR, plateCy, plateRx, plateRy } = ANCHOR
  return (
    <g data-layer="body">
      <defs>
        <radialGradient id={`${uid}-body`} cx="36%" cy="28%" r="90%">
          <stop offset="0" style={{ stopColor: lightOf(body) }} />
          <stop offset="0.5" style={{ stopColor: body }} />
          <stop offset="1" style={{ stopColor: dark }} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={ANCHOR.bodyBottom + 1} rx={24} ry={3.2} style={{ fill: 'var(--ink)', opacity: 0.16 }} />
      <circle cx={cx} cy={bodyCy} r={bodyR} style={{ fill: `url(#${uid}-body)`, stroke: dark, strokeWidth: 2.4 }} />
      <ellipse cx={36} cy={41} rx={10} ry={5.4} transform="rotate(-32 36 41)" style={{ fill: 'var(--cream)', opacity: 0.32 }} />
      <ellipse cx={cx} cy={plateCy} rx={plateRx} ry={plateRy} style={{ fill: `color-mix(in srgb, ${body} 14%, var(--cream))` }} />
    </g>
  )
}
