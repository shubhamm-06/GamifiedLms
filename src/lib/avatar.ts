/**
 * The procedural avatar's data: every option in every slot (the catalogue), the
 * config shape, and `normalizeAvatarConfig`, the ONE function that turns anything
 * read from `profiles.avatar_config` into a config that is always safe to render.
 * Pure TypeScript with no React, so a plain script can run it (scripts/check-avatar.mjs).
 * The drawing lives in `components/kid/avatar/`; each catalogue row below needs
 * exactly one matching entry in that registry (the compiler enforces it).
 *
 * The database mirrors these sets in `public.avatar_config_is_valid` (migration
 * 032) — change both together. Never an image: an avatar is this small config.
 *
 * Phase 1: every option is free and open to every student. Nothing here knows
 * about XP, badges or ownership; unlocks are a deliberately deferred later phase.
 *
 * Kid-safe rule (docs/rules.md): no facial hair, brand logos, weapons, political
 * or religious symbols, or anything age-inappropriate. Parts stay friendly and
 * neutral, and none is gender-coded.
 */

/** Bump only with a migration that still accepts every older shape. */
const AVATAR_VERSION = 2

/** The body colours: the locked brand tokens, each with its `-d` shade for depth. */
const AVATAR_BASES = ['gold', 'teal', 'coral', 'plum'] as const
export type AvatarBase = (typeof AVATAR_BASES)[number]

/** Swatches for a tintable part: the four brand colours plus ink and cream as neutrals. */
export const AVATAR_SWATCHES = [
  { id: 'gold', label: 'Gold' },
  { id: 'teal', label: 'Teal' },
  { id: 'coral', label: 'Coral' },
  { id: 'plum', label: 'Plum' },
  { id: 'ink', label: 'Ink' },
  { id: 'cream', label: 'Cream' },
] as const
type AvatarSwatch = (typeof AVATAR_SWATCHES)[number]['id']

interface PartMeta<Id extends string = string> {
  id: Id
  /** Kid-friendly, self-contained ("Round glasses"): the tile's aria-label and the avatar's description. */
  label: string
  /** Has a colour swatch row. Non-tintable parts keep their own fixed colours. */
  tintable?: boolean
  /** Used until the student picks a swatch. Only meaningful when tintable. */
  defaultTint?: AvatarSwatch
}

const EYES = [
  { id: 'round', label: 'Round eyes' },
  { id: 'happy', label: 'Happy eyes' },
  { id: 'sleepy', label: 'Sleepy eyes' },
  { id: 'wink', label: 'Winking eyes' },
  { id: 'sparkle', label: 'Sparkly eyes' },
  { id: 'wide', label: 'Wide eyes' },
] as const satisfies readonly PartMeta[]

const MOUTH = [
  { id: 'smile', label: 'Smile' },
  { id: 'grin', label: 'Big grin' },
  { id: 'open', label: 'Open mouth' },
  { id: 'tongue', label: 'Tongue out' },
  { id: 'surprised', label: 'Surprised mouth' },
] as const satisfies readonly PartMeta[]

const GLASSES = [
  { id: 'none', label: 'No glasses' },
  { id: 'round', label: 'Round glasses', tintable: true, defaultTint: 'ink' },
  { id: 'square', label: 'Square glasses', tintable: true, defaultTint: 'coral' },
  { id: 'star', label: 'Star glasses', tintable: true, defaultTint: 'gold' },
  { id: 'sunglasses', label: 'Sunglasses', tintable: true, defaultTint: 'ink' },
] as const satisfies readonly PartMeta[]

/** The five toppers from the first builder are ported first (same ids), then the new headwear. */
const HEAD = [
  { id: 'none', label: 'No headwear' },
  { id: 'spiky', label: 'Spiky hair' },
  { id: 'round', label: 'Round cap' },
  { id: 'star', label: 'Star topper' },
  { id: 'antenna', label: 'Antenna' },
  { id: 'bow', label: 'Hair bow' },
  { id: 'cap', label: 'Baseball cap', tintable: true, defaultTint: 'coral' },
  { id: 'beanie', label: 'Beanie', tintable: true, defaultTint: 'teal' },
  { id: 'crown', label: 'Crown', tintable: true, defaultTint: 'gold' },
  { id: 'wizard', label: 'Wizard hat', tintable: true, defaultTint: 'plum' },
  { id: 'grad', label: 'Graduation cap', tintable: true, defaultTint: 'ink' },
  { id: 'phones', label: 'Headphones', tintable: true, defaultTint: 'ink' },
] as const satisfies readonly PartMeta[]

/** The four accents from the first builder are ported (same ids), then the new extras. */
const EXTRA = [
  { id: 'none', label: 'No extra' },
  { id: 'star', label: 'Gold star' },
  { id: 'stripe', label: 'Tape stripe' },
  { id: 'dot', label: 'Dots' },
  { id: 'heart', label: 'Heart' },
  { id: 'bowtie', label: 'Bow tie', tintable: true, defaultTint: 'coral' },
  { id: 'scarf', label: 'Scarf', tintable: true, defaultTint: 'gold' },
  { id: 'cape', label: 'Cape', tintable: true, defaultTint: 'coral' },
  { id: 'blush', label: 'Blush cheeks' },
] as const satisfies readonly PartMeta[]

const BACKDROP = [
  { id: 'none', label: 'No backdrop' },
  { id: 'solid', label: 'Solid backdrop', tintable: true, defaultTint: 'gold' },
  { id: 'dots', label: 'Dotty backdrop', tintable: true, defaultTint: 'teal' },
  { id: 'stripes', label: 'Striped backdrop', tintable: true, defaultTint: 'coral' },
  { id: 'rays', label: 'Sunburst backdrop', tintable: true, defaultTint: 'gold' },
  { id: 'rings', label: 'Ringed backdrop', tintable: true, defaultTint: 'plum' },
] as const satisfies readonly PartMeta[]

const BASE_META = AVATAR_BASES.map((id) => ({ id, label: `${id[0].toUpperCase()}${id.slice(1)} body` })) as readonly PartMeta<AvatarBase>[]

export const AVATAR_CATALOG = { base: BASE_META, eyes: EYES, mouth: MOUTH, glasses: GLASSES, head: HEAD, extra: EXTRA, backdrop: BACKDROP } as const

export type AvatarCategory = keyof typeof AVATAR_CATALOG
/** Tab order in the builder. */
export const AVATAR_CATEGORIES = ['base', 'eyes', 'mouth', 'glasses', 'head', 'extra', 'backdrop'] as const satisfies readonly AvatarCategory[]

export type AvatarEyes = (typeof EYES)[number]['id']
export type AvatarMouth = (typeof MOUTH)[number]['id']
export type AvatarGlasses = (typeof GLASSES)[number]['id']
export type AvatarHead = (typeof HEAD)[number]['id']
export type AvatarExtra = (typeof EXTRA)[number]['id']
export type AvatarBackdrop = (typeof BACKDROP)[number]['id']

/** The slots that carry a stored colour. */
const AVATAR_TINT_SLOTS = ['glasses', 'head', 'extra', 'backdrop'] as const
export type AvatarTintSlot = (typeof AVATAR_TINT_SLOTS)[number]

export interface AvatarConfig {
  v: typeof AVATAR_VERSION
  base: AvatarBase
  eyes: AvatarEyes
  mouth: AvatarMouth
  glasses: AvatarGlasses
  head: AvatarHead
  extra: AvatarExtra
  backdrop: AvatarBackdrop
  /** Only slots the student has coloured; anything else uses the part's default tint. */
  tints: Partial<Record<AvatarTintSlot, AvatarSwatch>>
}

export const isTintSlot = (c: AvatarCategory): c is AvatarTintSlot => (AVATAR_TINT_SLOTS as readonly string[]).includes(c)

function partMeta(category: AvatarCategory, id: string): PartMeta | undefined {
  return (AVATAR_CATALOG[category] as readonly PartMeta[]).find((p) => p.id === id)
}

/** The colour a slot renders in: the student's pick, else the part's default. Null when the part is not tintable. */
export function tintFor(config: AvatarConfig, slot: AvatarTintSlot): AvatarSwatch | null {
  const meta = partMeta(slot, config[slot])
  if (!meta?.tintable) return null
  return config.tints[slot] ?? meta.defaultTint ?? 'ink'
}

// ---------------------------------------------------------------- legacy (v1)

/** The shape migration 026 stored: {base, topper, face, accent}. Still accepted on read and by the database. */
const LEGACY_TOPPERS = ['spiky', 'round', 'star', 'antenna', 'bow', 'none'] as const
const LEGACY_FACES = ['happy', 'wink', 'silly', 'cool', 'sleepy'] as const
const LEGACY_ACCENTS = ['star', 'stripe', 'dot', 'heart', 'none'] as const

/**
 * Each old "face" was a cream band, not a real face; these pairs are the nearest
 * new look (the mood the band suggested). "cool" was two bars, i.e. shades.
 */
const LEGACY_FACE_MAP: Record<(typeof LEGACY_FACES)[number], { eyes: AvatarEyes; mouth: AvatarMouth; glasses: AvatarGlasses }> = {
  happy: { eyes: 'happy', mouth: 'smile', glasses: 'none' },
  wink: { eyes: 'wink', mouth: 'grin', glasses: 'none' },
  silly: { eyes: 'wide', mouth: 'tongue', glasses: 'none' },
  cool: { eyes: 'round', mouth: 'smile', glasses: 'sunglasses' },
  sleepy: { eyes: 'sleepy', mouth: 'smile', glasses: 'none' },
}

// ------------------------------------------------------------------ normalize

const isOneOf = <T extends string>(set: readonly T[], v: unknown): v is T => typeof v === 'string' && (set as readonly string[]).includes(v)
const idsOf = <T extends string>(list: readonly PartMeta<T>[]): readonly T[] => list.map((p) => p.id)

/** Shown for a student who has never opened the builder. Fixed, not random: stable across visits. It is the old default (teal, round cap, happy face), mapped. */
export const DEFAULT_AVATAR: AvatarConfig = {
  v: AVATAR_VERSION,
  base: 'teal',
  eyes: 'happy',
  mouth: 'smile',
  glasses: 'none',
  head: 'round',
  extra: 'none',
  backdrop: 'none',
  tints: {},
}

function normalizeTints(raw: unknown): AvatarConfig['tints'] {
  const out: AvatarConfig['tints'] = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  const swatches = AVATAR_SWATCHES.map((s) => s.id)
  for (const slot of AVATAR_TINT_SLOTS) {
    const v = (raw as Record<string, unknown>)[slot]
    if (isOneOf(swatches, v)) out[slot] = v
  }
  return out
}

/**
 * Anything in, a renderable config out. Never throws, never returns something
 * that renders blank. Unknown, removed or malformed VALUES fall back per field
 * (so one bad key does not reset the whole avatar); a missing or non-object
 * value is the default avatar. A v1 config (no `v`, has topper/face/accent)
 * is mapped: the face becomes an eyes+mouth(+glasses) pair, topper becomes
 * headwear and accent becomes the extra, with the same ids. Use it everywhere a
 * config is read (useKidProfile does; the nav, sidebar and profile get the result).
 */
export function normalizeAvatarConfig(raw: unknown): AvatarConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_AVATAR, tints: {} }
  const r = raw as Record<string, unknown>
  const base = isOneOf(AVATAR_BASES, r.base) ? r.base : DEFAULT_AVATAR.base

  // A future or unknown version is read as v2 on a best-effort basis; only a missing `v` means legacy.
  const isLegacy = r.v === undefined || r.v === null
  if (isLegacy) {
    const face = isOneOf(LEGACY_FACES, r.face) ? r.face : 'happy'
    const topper = isOneOf(LEGACY_TOPPERS, r.topper) ? r.topper : 'round'
    const accent = isOneOf(LEGACY_ACCENTS, r.accent) ? r.accent : 'none'
    return { ...DEFAULT_AVATAR, base, ...LEGACY_FACE_MAP[face], head: topper, extra: accent, tints: {} }
  }

  return {
    v: AVATAR_VERSION,
    base,
    eyes: isOneOf(idsOf(EYES), r.eyes) ? r.eyes : DEFAULT_AVATAR.eyes,
    mouth: isOneOf(idsOf(MOUTH), r.mouth) ? r.mouth : DEFAULT_AVATAR.mouth,
    glasses: isOneOf(idsOf(GLASSES), r.glasses) ? r.glasses : 'none',
    head: isOneOf(idsOf(HEAD), r.head) ? r.head : 'none',
    extra: isOneOf(idsOf(EXTRA), r.extra) ? r.extra : 'none',
    backdrop: isOneOf(idsOf(BACKDROP), r.backdrop) ? r.backdrop : 'none',
    tints: normalizeTints(r.tints),
  }
}

// -------------------------------------------------------------------- builder

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** For Shuffle: a random pick in every slot, and a random colour for every tintable pick. All options are kid-safe by construction. */
export function randomAvatarConfig(): AvatarConfig {
  const config: AvatarConfig = {
    v: AVATAR_VERSION,
    base: pick(AVATAR_BASES),
    eyes: pick(idsOf(EYES)),
    mouth: pick(idsOf(MOUTH)),
    glasses: pick(idsOf(GLASSES)),
    head: pick(idsOf(HEAD)),
    extra: pick(idsOf(EXTRA)),
    backdrop: pick(idsOf(BACKDROP)),
    tints: {},
  }
  for (const slot of AVATAR_TINT_SLOTS) {
    if (partMeta(slot, config[slot])?.tintable) config.tints[slot] = pick(AVATAR_SWATCHES).id
  }
  return config
}

/** "Your avatar: teal body, happy eyes, smile, round glasses, baseball cap" for the live preview's accessible description. */
export function describeAvatar(config: AvatarConfig): string {
  const label = (c: AvatarCategory, id: string) => partMeta(c, id)?.label.toLowerCase() ?? id
  const parts = [`${config.base} body`, label('eyes', config.eyes), label('mouth', config.mouth)]
  for (const c of ['glasses', 'head', 'extra', 'backdrop'] as const) if (config[c] !== 'none') parts.push(label(c, config[c]))
  return `Your avatar: ${parts.join(', ')}`
}
