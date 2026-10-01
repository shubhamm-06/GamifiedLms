import type { CSSProperties, ReactNode } from 'react'
import type { AvatarBase } from '@/lib/avatar'
import { ANCHOR, lightOf, shadeOf, starPoints } from './geometry'

/**
 * Every part is one small component drawn against the anchors in geometry.ts.
 * Colours are tokens only, set through `style` (an SVG presentation attribute
 * cannot resolve `var()`; a style property can). No SVG filters anywhere (costly
 * and inconsistent in Android WebView): depth is gradients and plain shapes.
 * Strokes stay >= 2.5 units so a feature still reads at 24px.
 */
export interface PartProps {
  /** The part's colour as CSS (the student's swatch or the default). Ignored by non-tintable parts. */
  tint: string
  base: AvatarBase
  /** Unique per Avatar instance; prefix for any gradient or clipPath id a part needs. */
  uid: string
}

const INK = 'var(--ink)'
const CREAM = 'var(--cream)'
const fill = (c: string, extra?: CSSProperties): CSSProperties => ({ fill: c, ...extra })
const line = (c: string, w: number, extra?: CSSProperties): CSSProperties => ({ fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round', ...extra })
const { cx, eyeY, eyeDx, mouthY } = ANCHOR
const L = cx - eyeDx
const R = cx + eyeDx

// ------------------------------------------------------------------- eyes

const shine = (x: number, y: number, r = 1.7) => <circle cx={x} cy={y} r={r} style={fill(CREAM)} />

export const EyesRound = () => (
  <>
    <circle cx={L} cy={eyeY} r={5.6} style={fill(INK)} />
    <circle cx={R} cy={eyeY} r={5.6} style={fill(INK)} />
    {shine(L + 1.9, eyeY - 2)}
    {shine(R + 1.9, eyeY - 2)}
  </>
)

export const EyesHappy = () => (
  <>
    <path d={`M ${L - 6} ${eyeY + 2.5} Q ${L} ${eyeY - 7} ${L + 6} ${eyeY + 2.5}`} style={line(INK, 3.6)} />
    <path d={`M ${R - 6} ${eyeY + 2.5} Q ${R} ${eyeY - 7} ${R + 6} ${eyeY + 2.5}`} style={line(INK, 3.6)} />
  </>
)

export const EyesSleepy = () => (
  <>
    <path d={`M ${L - 6} ${eyeY - 1} H ${L + 6} A 6 6 0 0 1 ${L - 6} ${eyeY - 1} Z`} style={fill(INK)} />
    <path d={`M ${R - 6} ${eyeY - 1} H ${R + 6} A 6 6 0 0 1 ${R - 6} ${eyeY - 1} Z`} style={fill(INK)} />
    <path d={`M ${L - 7.5} ${eyeY + 0.5} L ${L + 7.5} ${eyeY - 2.5}`} style={line(INK, 3)} />
    <path d={`M ${R - 7.5} ${eyeY - 2.5} L ${R + 7.5} ${eyeY + 0.5}`} style={line(INK, 3)} />
  </>
)

export const EyesWink = () => (
  <>
    <circle cx={L} cy={eyeY} r={5.6} style={fill(INK)} />
    {shine(L + 1.9, eyeY - 2)}
    <path d={`M ${R - 6.5} ${eyeY - 1} Q ${R} ${eyeY + 7} ${R + 6.5} ${eyeY - 1}`} style={line(INK, 3.6)} />
  </>
)

const sparkle = (x: number) => (
  <path
    d={`M ${x} ${eyeY - 8.5} L ${x + 2.4} ${eyeY - 2.4} L ${x + 8.5} ${eyeY} L ${x + 2.4} ${eyeY + 2.4} L ${x} ${eyeY + 8.5} L ${x - 2.4} ${eyeY + 2.4} L ${x - 8.5} ${eyeY} L ${x - 2.4} ${eyeY - 2.4} Z`}
    style={fill(INK)}
  />
)
export const EyesSparkle = () => (
  <>
    {sparkle(L)}
    {sparkle(R)}
  </>
)

const wideEye = (x: number) => (
  <>
    <circle cx={x} cy={eyeY} r={7.6} style={fill(CREAM, { stroke: INK, strokeWidth: 2.6 })} />
    <circle cx={x + 0.6} cy={eyeY + 0.4} r={3.6} style={fill(INK)} />
    {shine(x + 1.8, eyeY - 1.2, 1.2)}
  </>
)
export const EyesWide = () => (
  <>
    {wideEye(L)}
    {wideEye(R)}
  </>
)

// ------------------------------------------------------------------ mouth

export const MouthSmile = () => <path d={`M ${cx - 8} ${mouthY - 2} Q ${cx} ${mouthY + 7} ${cx + 8} ${mouthY - 2}`} style={line(INK, 3.6)} />

export const MouthGrin = () => (
  <>
    <path d={`M ${cx - 11} ${mouthY - 3} Q ${cx} ${mouthY} ${cx + 11} ${mouthY - 3} Q ${cx + 9} ${mouthY + 9} ${cx} ${mouthY + 9} Q ${cx - 9} ${mouthY + 9} ${cx - 11} ${mouthY - 3} Z`} style={fill(CREAM, { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' })} />
    <path d={`M ${cx - 10} ${mouthY + 1.5} H ${cx + 10}`} style={line(INK, 1.8)} />
  </>
)

export const MouthOpen = () => (
  <>
    <path d={`M ${cx - 8} ${mouthY - 3} Q ${cx} ${mouthY - 5} ${cx + 8} ${mouthY - 3} Q ${cx + 8} ${mouthY + 9} ${cx} ${mouthY + 9} Q ${cx - 8} ${mouthY + 9} ${cx - 8} ${mouthY - 3} Z`} style={fill(INK)} />
    <ellipse cx={cx} cy={mouthY + 6.4} rx={4.6} ry={2.6} style={fill('var(--coral)')} />
  </>
)

export const MouthTongue = () => (
  <>
    <path d={`M ${cx - 3.6} ${mouthY + 2.5} H ${cx + 3.6} V ${mouthY + 7} A 3.6 3.6 0 0 1 ${cx - 3.6} ${mouthY + 7} Z`} style={fill('var(--coral)', { stroke: shadeOf('var(--coral)'), strokeWidth: 1.6 })} />
    <path d={`M ${cx - 9} ${mouthY - 2} Q ${cx} ${mouthY + 7} ${cx + 9} ${mouthY - 2}`} style={line(INK, 3.6)} />
  </>
)

export const MouthSurprised = () => (
  <>
    <ellipse cx={cx} cy={mouthY + 2.5} rx={4.6} ry={6} style={fill(INK)} />
    <ellipse cx={cx + 1.4} cy={mouthY + 0.4} rx={1.2} ry={1.6} style={fill(CREAM, { opacity: 0.8 })} />
  </>
)

export const CheeksBlush = () => (
  <>
    <ellipse cx={cx - ANCHOR.cheekDx} cy={ANCHOR.cheekY} rx={5.6} ry={3.6} style={fill('color-mix(in srgb, var(--coral) 78%, var(--cream))', { opacity: 0.85 })} />
    <ellipse cx={cx + ANCHOR.cheekDx} cy={ANCHOR.cheekY} rx={5.6} ry={3.6} style={fill('color-mix(in srgb, var(--coral) 78%, var(--cream))', { opacity: 0.85 })} />
  </>
)

// ---------------------------------------------------------------- glasses

/** Two lenses' worth of glint, shared: a short cream slash upper-left of each lens. */
const glint = (x: number, y: number) => <path d={`M ${x - 4} ${y - 2} L ${x - 1.4} ${y - 4.6}`} style={line(CREAM, 2.2, { opacity: 0.95 })} />

export const GlassesRound = ({ tint }: PartProps) => (
  <>
    <circle cx={L} cy={eyeY} r={9.4} style={fill(CREAM, { fillOpacity: 0.28, stroke: tint, strokeWidth: 3.2 })} />
    <circle cx={R} cy={eyeY} r={9.4} style={fill(CREAM, { fillOpacity: 0.28, stroke: tint, strokeWidth: 3.2 })} />
    <path d={`M ${L + 9.4} ${eyeY - 1} Q ${cx} ${eyeY - 5} ${R - 9.4} ${eyeY - 1}`} style={line(tint, 3)} />
    {glint(L - 1, eyeY - 2)}
    {glint(R - 1, eyeY - 2)}
  </>
)

const squareLens = (x: number, tint: string) => <rect x={x - 9.5} y={eyeY - 8.5} width={19} height={17} rx={5} style={fill(CREAM, { fillOpacity: 0.28, stroke: tint, strokeWidth: 3.2 })} />
export const GlassesSquare = ({ tint }: PartProps) => (
  <>
    {squareLens(L, tint)}
    {squareLens(R, tint)}
    <path d={`M ${L + 9.5} ${eyeY - 2} H ${R - 9.5}`} style={line(tint, 3)} />
    {glint(L - 1, eyeY - 2)}
    {glint(R - 1, eyeY - 2)}
  </>
)

export const GlassesStar = ({ tint }: PartProps) => (
  <>
    <polygon points={starPoints(L, eyeY + 0.5, 12.5, 6.6)} style={fill(CREAM, { fillOpacity: 0.3, stroke: tint, strokeWidth: 3, strokeLinejoin: 'round' })} />
    <polygon points={starPoints(R, eyeY + 0.5, 12.5, 6.6)} style={fill(CREAM, { fillOpacity: 0.3, stroke: tint, strokeWidth: 3, strokeLinejoin: 'round' })} />
    <path d={`M ${L + 8} ${eyeY} Q ${cx} ${eyeY - 4} ${R - 8} ${eyeY}`} style={line(tint, 2.6)} />
  </>
)

const shade = (x: number) => `M ${x - 10} ${eyeY - 7} H ${x + 10} V ${eyeY + 1} Q ${x + 10} ${eyeY + 10} ${x} ${eyeY + 10} Q ${x - 10} ${eyeY + 10} ${x - 10} ${eyeY + 1} Z`
export const GlassesSunglasses = ({ tint }: PartProps) => (
  <>
    <path d={shade(L)} style={fill('var(--ink)', { stroke: tint, strokeWidth: 3, strokeLinejoin: 'round' })} />
    <path d={shade(R)} style={fill('var(--ink)', { stroke: tint, strokeWidth: 3, strokeLinejoin: 'round' })} />
    <path d={`M ${L + 10} ${eyeY - 5} H ${R - 10}`} style={line(tint, 3)} />
    <path d={`M ${L - 6} ${eyeY - 3} L ${L - 2} ${eyeY - 5.6}`} style={line(CREAM, 2.2, { opacity: 0.85 })} />
    <path d={`M ${R - 6} ${eyeY - 3} L ${R - 2} ${eyeY - 5.6}`} style={line(CREAM, 2.2, { opacity: 0.85 })} />
  </>
)

// --------------------------------------------------------------- headwear
// Legacy toppers (ported from the first builder): the body's own -d shade, as before.

const bodyDark = (base: AvatarBase) => `var(--${base}-d)`

export const HeadSpiky = ({ base }: PartProps) => (
  <>
    <path d="M 24 44 L 27 14 L 38 32 L 50 6 L 62 32 L 73 14 L 76 44 Q 50 34 24 44 Z" style={fill(bodyDark(base), { stroke: bodyDark(base), strokeWidth: 2, strokeLinejoin: 'round' })} />
    <path d="M 30 33 L 32 22 L 37 32 Z" style={fill(CREAM, { opacity: 0.25 })} />
  </>
)

export const HeadRound = ({ base }: PartProps) => (
  <>
    <path d="M 20 46 C 20 22, 80 22, 80 46 Q 50 41 20 46 Z" style={fill(bodyDark(base))} />
    <path d="M 30 36 C 34 29, 42 27, 48 27" style={line(CREAM, 3, { opacity: 0.35 })} />
  </>
)

export const HeadStar = ({ base }: PartProps) => (
  <>
    <rect x={47} y={24} width={6} height={12} rx={2} style={fill(bodyDark(base))} />
    <polygon points={starPoints(50, 17, 15, 6.6)} style={fill(bodyDark(base), { stroke: bodyDark(base), strokeWidth: 2, strokeLinejoin: 'round' })} />
    <polygon points={starPoints(50, 17, 8, 3.6)} style={fill(CREAM, { opacity: 0.28 })} />
  </>
)

export const HeadAntenna = ({ base }: PartProps) => (
  <>
    <rect x={47.5} y={11} width={5} height={22} rx={2.5} style={fill(bodyDark(base))} />
    <circle cx={50} cy={10} r={6.4} style={fill(bodyDark(base))} />
    <circle cx={48} cy={8} r={1.8} style={fill(CREAM, { opacity: 0.55 })} />
  </>
)

export const HeadBow = ({ base }: PartProps) => (
  <>
    <polygon points="50,30 28,19 28,41" style={fill(bodyDark(base), { stroke: bodyDark(base), strokeWidth: 2, strokeLinejoin: 'round' })} />
    <polygon points="50,30 72,19 72,41" style={fill(bodyDark(base), { stroke: bodyDark(base), strokeWidth: 2, strokeLinejoin: 'round' })} />
    <circle cx={50} cy={30} r={5} style={fill(bodyDark(base))} />
    <circle cx={49} cy={28.6} r={1.6} style={fill(CREAM, { opacity: 0.45 })} />
  </>
)

// New headwear: tintable.

export const HeadCap = ({ tint }: PartProps) => (
  <>
    <path d="M 21 47 C 21 20, 79 20, 79 47 Z" style={fill(tint)} />
    <path d="M 50 24 Q 45 35 46.5 47" style={line(shadeOf(tint), 2)} />
    <circle cx={50} cy={24.5} r={2.8} style={fill(shadeOf(tint))} />
    <path d="M 30 36 C 33 30, 39 27, 45 26" style={line(lightOf(tint), 3, { opacity: 0.7 })} />
    <path d="M 20 46 Q 50 54.5 80 46 L 80 49.5 Q 50 58 20 49.5 Z" style={fill(shadeOf(tint))} />
  </>
)

export const HeadBeanie = ({ tint }: PartProps) => (
  <>
    <circle cx={50} cy={20} r={6.4} style={fill(lightOf(tint), { stroke: shadeOf(tint), strokeWidth: 1.6 })} />
    <path d="M 21 47 C 21 20, 79 20, 79 47 Z" style={fill(tint)} />
    <path d="M 30 38 C 33 30, 39 27, 45 26" style={line(lightOf(tint), 3, { opacity: 0.7 })} />
    <rect x={19} y={41} width={62} height={9} rx={4.5} style={fill(shadeOf(tint))} />
    <path d="M 29 43 V 48 M 37 43 V 48 M 45 43 V 48 M 55 43 V 48 M 63 43 V 48 M 71 43 V 48" style={line(tint, 1.8, { opacity: 0.6 })} />
  </>
)

export const HeadCrown = ({ tint }: PartProps) => (
  <>
    <path d="M 26 46 L 23 21 L 38 33 L 50 16 L 62 33 L 77 21 L 74 46 Z" style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 2, strokeLinejoin: 'round' })} />
    <rect x={25} y={41} width={50} height={7} rx={2.4} style={fill(shadeOf(tint))} />
    <circle cx={23} cy={21} r={3.4} style={fill(CREAM, { stroke: shadeOf(tint), strokeWidth: 1.4 })} />
    <circle cx={50} cy={16} r={3.6} style={fill(CREAM, { stroke: shadeOf(tint), strokeWidth: 1.4 })} />
    <circle cx={77} cy={21} r={3.4} style={fill(CREAM, { stroke: shadeOf(tint), strokeWidth: 1.4 })} />
    <circle cx={50} cy={44.6} r={2.4} style={fill(CREAM)} />
    <path d="M 31 40 L 30 31" style={line(lightOf(tint), 2.6, { opacity: 0.8 })} />
  </>
)

export const HeadWizard = ({ tint }: PartProps) => (
  <>
    <path d="M 27 45 L 45 9 Q 50 1 57 6 Q 52 16 73 45 Z" style={fill(tint)} />
    <path d="M 31 39 L 43 15" style={line(lightOf(tint), 3, { opacity: 0.6 })} />
    <polygon points={starPoints(54, 27, 5.4, 2.4)} style={fill('var(--gold)')} />
    <path d="M 27.5 41 Q 50 47 72.5 41 L 73 45 Q 50 51 27 45 Z" style={fill(shadeOf(tint))} />
    <ellipse cx={50} cy={46} rx={33} ry={5.4} style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 2 })} />
  </>
)

export const HeadGrad = ({ tint }: PartProps) => (
  <>
    <path d="M 30 35 V 46 Q 50 53 70 46 V 35 Q 50 43 30 35 Z" style={fill(shadeOf(tint))} />
    <path d="M 50 19 L 87 32 L 50 45 L 13 32 Z" style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 2, strokeLinejoin: 'round' })} />
    <path d="M 26 32 L 45 25.6" style={line(lightOf(tint), 2.6, { opacity: 0.7 })} />
    <circle cx={50} cy={32} r={2.6} style={fill('var(--gold)')} />
    <path d="M 50 32 Q 78 33 82 41" style={line('var(--gold)', 2.2)} />
    <rect x={79.5} y={40} width={5} height={9} rx={2.2} style={fill('var(--gold)')} />
  </>
)

export const HeadPhones = ({ tint }: PartProps) => (
  <>
    <path d="M 20 60 C 14 6, 86 6, 80 60" style={line(tint, 5.4)} />
    <path d="M 26 40 C 32 20, 44 15, 50 15" style={line(lightOf(tint), 2.2, { opacity: 0.6 })} />
    <rect x={9} y={50} width={14} height={24} rx={7} style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 2 })} />
    <rect x={77} y={50} width={14} height={24} rx={7} style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 2 })} />
    <rect x={15} y={55} width={5} height={14} rx={2.5} style={fill(shadeOf(tint))} />
    <rect x={80} y={55} width={5} height={14} rx={2.5} style={fill(shadeOf(tint))} />
  </>
)

// ----------------------------------------------------------------- extras

export const ExtraStar = () => (
  <polygon points={starPoints(73, 81, 10.5, 4.6)} style={fill('var(--gold)', { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' })} />
)

export const ExtraStripe = () => (
  <rect x={12} y={76} width={76} height={9} rx={4.5} transform="rotate(-20 50 80)" style={fill(CREAM, { opacity: 0.6 })} />
)

export const ExtraDot = () => (
  <>
    <circle cx={70} cy={80} r={4} style={fill(CREAM, { opacity: 0.95 })} />
    <circle cx={80} cy={71} r={3.2} style={fill(CREAM, { opacity: 0.95 })} />
    <circle cx={62} cy={88} r={2.6} style={fill(CREAM, { opacity: 0.95 })} />
  </>
)

export const ExtraHeart = () => (
  <path
    d="M 73 84 C 69 79, 62 82, 62 87.4 C 62 91, 73 98, 73 98 C 73 98, 84 91, 84 87.4 C 84 82, 77 79, 73 84 Z"
    transform="translate(0 -6)"
    style={fill('var(--coral)', { stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round' })}
  />
)

export const ExtraBowtie = ({ tint }: PartProps) => (
  <>
    <path d={`M 50 ${ANCHOR.chestY} L 35 ${ANCHOR.chestY - 8} V ${ANCHOR.chestY + 8} Z`} style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 1.8, strokeLinejoin: 'round' })} />
    <path d={`M 50 ${ANCHOR.chestY} L 65 ${ANCHOR.chestY - 8} V ${ANCHOR.chestY + 8} Z`} style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 1.8, strokeLinejoin: 'round' })} />
    <rect x={46} y={ANCHOR.chestY - 5} width={8} height={10} rx={3.4} style={fill(shadeOf(tint))} />
    <path d={`M 39 ${ANCHOR.chestY - 4} L 44 ${ANCHOR.chestY - 1}`} style={line(lightOf(tint), 1.8, { opacity: 0.7 })} />
  </>
)

export const ExtraScarf = ({ tint, uid }: PartProps) => (
  <>
    <clipPath id={`${uid}-scarf`}>
      <circle cx={ANCHOR.cx} cy={ANCHOR.bodyCy} r={ANCHOR.bodyR} />
    </clipPath>
    <g clipPath={`url(#${uid}-scarf)`}>
      <path d="M 10 74 Q 50 92 90 74 L 90 86 Q 50 104 10 86 Z" style={fill(tint)} />
      <path d="M 10 79 Q 50 97 90 79" style={line(shadeOf(tint), 2.2, { opacity: 0.8 })} />
      <path d="M 10 74 Q 50 92 90 74" style={line(lightOf(tint), 2.4, { opacity: 0.55 })} />
    </g>
    <path d="M 60 88 L 73 84 L 75 96 L 63 98 Z" style={fill(shadeOf(tint), { stroke: shadeOf(tint), strokeWidth: 1.4, strokeLinejoin: 'round' })} />
  </>
)

/** Behind the body: only the flare at each side and the bottom shows. */
export const ExtraCape = ({ tint }: PartProps) => (
  <>
    <path d="M 24 66 L 8 95 Q 50 102 92 95 L 76 66 Z" style={fill(tint, { stroke: shadeOf(tint), strokeWidth: 2, strokeLinejoin: 'round' })} />
    <path d="M 22 72 L 13 91" style={line(lightOf(tint), 3, { opacity: 0.7 })} />
    <path d="M 78 72 L 87 91" style={line(shadeOf(tint), 3, { opacity: 0.45 })} />
  </>
)

// --------------------------------------------------------------- backdrops
// Circle behind the character, sized like the old white ring. Patterns are clipped to it.

const bdFill = (tint: string) => `color-mix(in srgb, ${tint} 30%, var(--surface))`
const bdInk = (tint: string) => `color-mix(in srgb, ${tint} 55%, var(--surface))`

function Backdrop({ tint, uid, children }: PartProps & { children?: (ink: string) => ReactNode }) {
  return (
    <>
      <clipPath id={`${uid}-bd`}>
        <circle cx={50} cy={50} r={ANCHOR.backdropR} />
      </clipPath>
      <circle cx={50} cy={50} r={ANCHOR.backdropR} style={fill(bdFill(tint))} />
      {children ? <g clipPath={`url(#${uid}-bd)`}>{children(bdInk(tint))}</g> : null}
    </>
  )
}

export const BackdropSolid = (p: PartProps) => <Backdrop {...p} />

export const BackdropDots = (p: PartProps) => (
  <Backdrop {...p}>
    {(ink) => (
      <>
        {[10, 30, 50, 70, 90].flatMap((x, i) => [8, 26, 44, 62, 80, 98].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y + (i % 2 ? 9 : 0)} r={3.4} style={fill(ink)} />))}
      </>
    )}
  </Backdrop>
)

export const BackdropStripes = (p: PartProps) => (
  <Backdrop {...p}>
    {(ink) => (
      <g transform="rotate(-35 50 50)">
        {[-20, 0, 20, 40, 60, 80, 100].map((y) => <rect key={y} x={-20} y={y} width={140} height={9} style={fill(ink)} />)}
      </g>
    )}
  </Backdrop>
)

export const BackdropRays = (p: PartProps) => (
  <Backdrop {...p}>
    {(ink) => (
      <>
        {Array.from({ length: 10 }, (_, i) => {
          const a1 = (i * 36 * Math.PI) / 180
          const a2 = ((i * 36 + 18) * Math.PI) / 180
          const r = 80
          return <path key={i} d={`M 50 50 L ${50 + r * Math.cos(a1)} ${50 + r * Math.sin(a1)} L ${50 + r * Math.cos(a2)} ${50 + r * Math.sin(a2)} Z`} style={fill(ink)} />
        })}
      </>
    )}
  </Backdrop>
)

export const BackdropRings = (p: PartProps) => (
  <Backdrop {...p}>
    {(ink) => (
      <>
        <circle cx={50} cy={50} r={40} style={line(ink, 5)} />
        <circle cx={50} cy={50} r={26} style={line(ink, 5)} />
      </>
    )}
  </Backdrop>
)
