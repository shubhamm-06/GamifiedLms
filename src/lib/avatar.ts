/**
 * The procedural avatar's shape, and the ONLY place its option sets are
 * defined (the database's CHECK constraint on `profiles.avatar_config`,
 * migration 026, mirrors these exactly — change both together). Never an
 * image: every avatar anywhere in the app is this small config, rendered by
 * the one shared `Avatar` component. Pure customization for now, deliberately
 * flat — no option is unlocked by XP or progress (a natural later step, not
 * built here).
 */

export const AVATAR_BASES = ['gold', 'teal', 'coral', 'plum'] as const
export type AvatarBase = (typeof AVATAR_BASES)[number]

export const AVATAR_TOPPERS = ['spiky', 'round', 'star', 'antenna', 'bow', 'none'] as const
export type AvatarTopper = (typeof AVATAR_TOPPERS)[number]

export const AVATAR_FACES = ['happy', 'wink', 'silly', 'cool', 'sleepy'] as const
export type AvatarFace = (typeof AVATAR_FACES)[number]

export const AVATAR_ACCENTS = ['star', 'stripe', 'dot', 'heart', 'none'] as const
export type AvatarAccent = (typeof AVATAR_ACCENTS)[number]

export interface AvatarConfig {
  base: AvatarBase
  topper: AvatarTopper
  face: AvatarFace
  accent: AvatarAccent
}

/** Shown for a student who has never opened the builder. Deliberately fixed, not random: stable across visits. */
export const DEFAULT_AVATAR: AvatarConfig = { base: 'teal', topper: 'round', face: 'happy', accent: 'none' }

const isOneOf = <T extends string>(set: readonly T[], v: unknown): v is T => typeof v === 'string' && (set as readonly string[]).includes(v)

/** A config read back from `profiles.avatar_config` (any JSON value, or null/missing). The CHECK constraint means a
 * stored row is always well-formed, but this is the one place that stops trusting that and actually checks. */
export function parseAvatarConfig(value: unknown): AvatarConfig {
  if (!value || typeof value !== 'object') return DEFAULT_AVATAR
  const v = value as Record<string, unknown>
  if (!isOneOf(AVATAR_BASES, v.base) || !isOneOf(AVATAR_TOPPERS, v.topper) || !isOneOf(AVATAR_FACES, v.face) || !isOneOf(AVATAR_ACCENTS, v.accent)) {
    return DEFAULT_AVATAR
  }
  return { base: v.base, topper: v.topper, face: v.face, accent: v.accent }
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** For the builder's Shuffle button: one random pick per category. */
export function randomAvatarConfig(): AvatarConfig {
  return { base: pick(AVATAR_BASES), topper: pick(AVATAR_TOPPERS), face: pick(AVATAR_FACES), accent: pick(AVATAR_ACCENTS) }
}
