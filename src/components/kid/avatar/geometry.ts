/**
 * Shared geometry for every avatar part. One fixed viewBox and a handful of
 * anchor points: every part is drawn against these, never against another part,
 * so any headwear fits any head and any glasses fit any eyes on any body colour
 * with no per-combination special cases.
 */

export const AVATAR_VIEWBOX = 100

/** The zoomed view the builder's Eyes / Mouth / Glasses tiles use so the detail is legible. */
export const AVATAR_FACE_VIEWBOX = '20 34 60 60'

export const ANCHOR = {
  cx: 50,
  /** The body is a circle: centre and radius. Its top is `headTop`, its bottom `bodyBottom`. */
  bodyCy: 61,
  bodyR: 34,
  headTop: 27,
  bodyBottom: 95,
  /** The pale face plate the features sit on (keeps them legible on every body colour). */
  plateCy: 65,
  plateRx: 27,
  plateRy: 20,
  eyeY: 59,
  eyeDx: 12,
  cheekY: 68,
  cheekDx: 21,
  mouthY: 72,
  /** Where a bow tie or scarf sits. */
  chestY: 84,
  /** Headwear must not come lower than this: below it is the eye line. */
  hatFloor: 50,
  backdropR: 49,
} as const

/**
 * Back to front. A part declares the layer it lives in; the avatar draws layers in exactly this order.
 * `extras-behind` is drawn before `body` on purpose: a cape is BEHIND the character.
 */
export const AVATAR_LAYERS = ['backdrop', 'extras-behind', 'body', 'eyes', 'mouth', 'cheeks', 'glasses', 'headwear', 'extras-front'] as const
export type AvatarLayer = (typeof AVATAR_LAYERS)[number]

/** Points of a regular star, for the star glasses, the star topper and the star badge. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const out: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / points
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return out.join(' ')
}

/** A tint (a brand token name) as a CSS colour. Tokens only; `-d` shades exist for the four brand colours, the rest are mixed. */
export const cssColor = (name: string) => `var(--${name})`
/** Darker shade for shading and outlines: 68% the colour, 32% ink. */
export const shadeOf = (css: string) => `color-mix(in srgb, ${css} 68%, var(--ink))`
/** Lighter shade for highlights. */
export const lightOf = (css: string) => `color-mix(in srgb, ${css} 60%, var(--cream))`
