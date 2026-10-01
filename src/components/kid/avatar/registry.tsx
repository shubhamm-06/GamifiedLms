import type { ReactNode } from 'react'
import type { AvatarBackdrop, AvatarEyes, AvatarExtra, AvatarGlasses, AvatarHead, AvatarMouth } from '@/lib/avatar'
import type { AvatarLayer } from './geometry'
import * as P from './parts'
import type { PartProps } from './parts'

/**
 * The part registry. One entry per option: which layer it draws in and the small
 * component that draws it. `Record<Id, ...>` makes the compiler refuse a build
 * where a catalogue id (lib/avatar.ts) has no entry here, or the reverse. Label,
 * tintable and default colour live with the id in the catalogue, so a new part is
 * one catalogue row, one entry here and one SVG component (plus the database's
 * option list, migration 032). No unlock or ownership logic: Phase 1 is all free.
 * "none" is not an entry: it draws nothing.
 */
export interface PartEntry {
  layer: AvatarLayer
  Render: (props: PartProps) => ReactNode
}

const at = (layer: AvatarLayer, Render: PartEntry['Render']): PartEntry => ({ layer, Render })

export const PART_REGISTRY: {
  eyes: Record<AvatarEyes, PartEntry>
  mouth: Record<AvatarMouth, PartEntry>
  glasses: Record<Exclude<AvatarGlasses, 'none'>, PartEntry>
  head: Record<Exclude<AvatarHead, 'none'>, PartEntry>
  extra: Record<Exclude<AvatarExtra, 'none'>, PartEntry>
  backdrop: Record<Exclude<AvatarBackdrop, 'none'>, PartEntry>
} = {
  eyes: {
    round: at('eyes', P.EyesRound),
    happy: at('eyes', P.EyesHappy),
    sleepy: at('eyes', P.EyesSleepy),
    wink: at('eyes', P.EyesWink),
    sparkle: at('eyes', P.EyesSparkle),
    wide: at('eyes', P.EyesWide),
  },
  mouth: {
    smile: at('mouth', P.MouthSmile),
    grin: at('mouth', P.MouthGrin),
    open: at('mouth', P.MouthOpen),
    tongue: at('mouth', P.MouthTongue),
    surprised: at('mouth', P.MouthSurprised),
  },
  glasses: {
    round: at('glasses', P.GlassesRound),
    square: at('glasses', P.GlassesSquare),
    star: at('glasses', P.GlassesStar),
    sunglasses: at('glasses', P.GlassesSunglasses),
  },
  head: {
    spiky: at('headwear', P.HeadSpiky),
    round: at('headwear', P.HeadRound),
    star: at('headwear', P.HeadStar),
    antenna: at('headwear', P.HeadAntenna),
    bow: at('headwear', P.HeadBow),
    cap: at('headwear', P.HeadCap),
    beanie: at('headwear', P.HeadBeanie),
    crown: at('headwear', P.HeadCrown),
    wizard: at('headwear', P.HeadWizard),
    grad: at('headwear', P.HeadGrad),
    phones: at('headwear', P.HeadPhones),
  },
  extra: {
    star: at('extras-front', P.ExtraStar),
    stripe: at('extras-front', P.ExtraStripe),
    dot: at('extras-front', P.ExtraDot),
    heart: at('extras-front', P.ExtraHeart),
    bowtie: at('extras-front', P.ExtraBowtie),
    scarf: at('extras-front', P.ExtraScarf),
    cape: at('extras-behind', P.ExtraCape),
    blush: at('cheeks', P.CheeksBlush),
  },
  backdrop: {
    solid: at('backdrop', P.BackdropSolid),
    dots: at('backdrop', P.BackdropDots),
    stripes: at('backdrop', P.BackdropStripes),
    rays: at('backdrop', P.BackdropRays),
    rings: at('backdrop', P.BackdropRings),
  },
}

export function lookupPart(category: keyof typeof PART_REGISTRY, id: string): PartEntry | undefined {
  return (PART_REGISTRY[category] as Record<string, PartEntry>)[id]
}
