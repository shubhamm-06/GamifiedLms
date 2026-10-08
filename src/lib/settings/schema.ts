/**
 * The admin Settings model (Phase 1): branding, theme, terminology, features. One
 * source of truth for the shape, the defaults and the rules.
 *
 * Two schemas per section:
 *  - `strict` validates what an admin is about to save (clear messages, nothing coerced);
 *  - `lenient` reads whatever is stored: every field has `.catch(default)`, so a
 *    partial, stale or hand-edited row falls back per field and can never break the app.
 * Reading = deep-merge the stored value over the defaults, then `lenient.parse`.
 *
 * Every text is plain text: trimmed, control characters stripped, `<` and `>` refused,
 * and only ever rendered as React text. Nothing here may be a secret: the whole
 * table is public through `get_public_settings()`.
 *
 * No `@/` imports (scripts/check-settings.mjs runs this file under Node directly).
 */
import { z } from 'zod'
import { APP_NAME } from '../brand.ts'
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, HEX, checkTheme } from '../theme.ts'
import { FONT_IDS, type FontId } from './fonts.ts'

// ---------------------------------------------------------------- shared rules

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]/g
const clean = (s: string) => s.replace(CONTROL, '').trim()

/** Plain text between `min` and `max` characters, no markup. */
const text = (max: number, min = 0, label = 'This field') =>
  z
    .string()
    .transform(clean)
    .refine((s) => !/[<>]/.test(s), `${label} can't contain < or >.`)
    .refine((s) => s.length >= min, min > 0 ? `${label} needs at least ${min} characters.` : 'Required.')
    .refine((s) => s.length <= max, `${label} can be at most ${max} characters.`)

/** The public URL prefix of this project's `branding` bucket, or null outside the app (Node). */
export function brandingUrlPrefix(): string | null {
  const base = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL
  return base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/branding/` : null
}

/** Empty, or a public file URL from this project's own branding bucket. Any other host is refused. */
const brandingUrl = z
  .string()
  .transform(clean)
  .refine((s) => {
    if (s === '') return true
    const prefix = brandingUrlPrefix()
    return !!prefix && s.startsWith(prefix) && !/[\s"'<>]/.test(s)
  }, 'Upload the file here; links to other sites are not allowed.')

const hex = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => HEX.test(s), 'Use a 6-digit hex colour like #2563EB.')

const email = z
  .string()
  .transform(clean)
  .refine((s) => s === '' || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s), 'Enter a valid email address, or leave it empty.')

const httpsUrl = z
  .string()
  .transform(clean)
  .refine((s) => {
    if (s === '') return true
    try {
      const u = new URL(s)
      return u.protocol === 'https:' && !/[\s"'<>]/.test(s)
    } catch {
      return false
    }
  }, 'Use a full https:// link, or leave it empty.')

// ---------------------------------------------------------------- defaults

export const TERM_KEYS = ['course', 'module', 'lesson', 'xp', 'badge', 'streak', 'level'] as const
export type TermKey = (typeof TERM_KEYS)[number]

export const FEATURE_KEYS = ['gamification', 'xp', 'streaks', 'badges', 'levels', 'avatars', 'celebrations', 'publicCoursePages'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const DEFAULT_SETTINGS = {
  branding: {
    productName: APP_NAME,
    tagline: '',
    supportEmail: '',
    helpUrl: '',
    footerText: '',
    logoUrl: '',
    faviconUrl: '',
    login: { background: { type: 'none' as 'none' | 'color' | 'image', color: '#FFFFFF', imageUrl: '' } },
    loginHeading: '',
    loginSubline: '',
    registerHeading: '',
    registerSubline: '',
  },
  theme: {
    preset: 'default',
    primary: DEFAULT_PRIMARY,
    secondary: DEFAULT_SECONDARY,
    fonts: { heading: 'default' as FontId, body: 'default' as FontId },
  },
  terminology: {
    course: { singular: 'Course', plural: 'Courses' },
    module: { singular: 'Module', plural: 'Modules' },
    lesson: { singular: 'Lesson', plural: 'Lessons' },
    xp: { singular: 'XP', plural: 'XP' },
    badge: { singular: 'Badge', plural: 'Badges' },
    streak: { singular: 'Streak', plural: 'Streaks' },
    level: { singular: 'Level', plural: 'Levels' },
  } as Record<TermKey, { singular: string; plural: string }>,
  features: {
    gamification: true,
    xp: true,
    streaks: true,
    badges: true,
    levels: true,
    avatars: true,
    celebrations: true,
    publicCoursePages: true,
  } as Record<FeatureKey, boolean>,
}

export type Settings = typeof DEFAULT_SETTINGS
export type SectionKey = keyof Settings
export const SECTION_KEYS: SectionKey[] = ['branding', 'theme', 'terminology', 'features']

// ---------------------------------------------------------------- strict schemas (saving)

const D = DEFAULT_SETTINGS

const termWord = z
  .string()
  .transform(clean)
  .refine((s) => s.length >= 1 && s.length <= 24, 'Use 1 to 24 characters.')
  .refine((s) => /^[\p{L}\p{N} '’-]+$/u.test(s), 'Letters, numbers, spaces, hyphens and apostrophes only.')

const background = z.object({
  type: z.enum(['none', 'color', 'image']),
  color: hex,
  imageUrl: brandingUrl,
})

export const strictSchemas = {
  branding: z
    .object({
      productName: text(30, 2, 'The product name'),
      tagline: text(80),
      supportEmail: email,
      helpUrl: httpsUrl,
      footerText: text(120),
      logoUrl: brandingUrl,
      faviconUrl: brandingUrl,
      login: z.object({ background }),
      loginHeading: text(60),
      loginSubline: text(60),
      registerHeading: text(60),
      registerSubline: text(60),
    })
    .refine((b) => b.login.background.type !== 'image' || b.login.background.imageUrl !== '', {
      message: 'Upload a background image, or pick another background.',
      path: ['login', 'background', 'imageUrl'],
    }),
  // Fonts are ids from the fixed catalog only (lib/settings/fonts.ts) — never a URL or a free-text family.
  theme: z
    .object({
      preset: z.string().max(40),
      primary: hex,
      secondary: hex,
      fonts: z.object({ heading: z.enum(FONT_IDS), body: z.enum(FONT_IDS) }),
    })
    .superRefine((t, ctx) => {
      for (const message of checkTheme(t.primary, t.secondary).errors) ctx.addIssue({ code: 'custom', message, path: ['primary'] })
    }),
  terminology: z.object(
    Object.fromEntries(TERM_KEYS.map((k) => [k, z.object({ singular: termWord, plural: termWord })])) as Record<
      TermKey,
      z.ZodObject<{ singular: typeof termWord; plural: typeof termWord }>
    >,
  ),
  features: z.object(Object.fromEntries(FEATURE_KEYS.map((k) => [k, z.boolean()])) as Record<FeatureKey, z.ZodBoolean>),
}

// ---------------------------------------------------------------- lenient schemas (reading)

const lenientBranding = z.object({
  productName: text(30, 2).catch(D.branding.productName),
  tagline: text(80).catch(''),
  supportEmail: email.catch(''),
  helpUrl: httpsUrl.catch(''),
  footerText: text(120).catch(''),
  logoUrl: brandingUrl.catch(''),
  faviconUrl: brandingUrl.catch(''),
  login: z
    .object({
      background: z
        .object({
          type: z.enum(['none', 'color', 'image']).catch('none'),
          color: hex.catch(D.branding.login.background.color),
          imageUrl: brandingUrl.catch(''),
        })
        .catch(D.branding.login.background),
    })
    .catch(D.branding.login),
  loginHeading: text(60).catch(''),
  loginSubline: text(60).catch(''),
  registerHeading: text(60).catch(''),
  registerSubline: text(60).catch(''),
})

const lenientTheme = z
  .object({
    preset: z.string().max(40).catch(D.theme.preset),
    primary: hex.catch(D.theme.primary),
    secondary: hex.catch(D.theme.secondary),
    // Old rows without `fonts`, or one with an unknown/removed id, fall back to "default" per field.
    fonts: z
      .object({ heading: z.enum(FONT_IDS).catch('default'), body: z.enum(FONT_IDS).catch('default') })
      .catch(D.theme.fonts),
  })
  // A stored pair that breaks the contrast rules is never applied: readability wins.
  .transform((t) => (checkTheme(t.primary, t.secondary).errors.length ? { ...D.theme } : t))

const lenientTerminology = z.object(
  Object.fromEntries(
    TERM_KEYS.map((k) => [
      k,
      z.object({ singular: termWord.catch(D.terminology[k].singular), plural: termWord.catch(D.terminology[k].plural) }).catch(D.terminology[k]),
    ]),
  ),
)

const lenientFeatures = z.object(Object.fromEntries(FEATURE_KEYS.map((k) => [k, z.boolean().catch(true)])))

const lenient = { branding: lenientBranding, theme: lenientTheme, terminology: lenientTerminology, features: lenientFeatures }

// ---------------------------------------------------------------- merge + parse

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Stored values over defaults, recursively; arrays and scalars replace. Unknown keys are dropped by the parse. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObject(base) || !isObject(over)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? deepMerge((base as Record<string, unknown>)[k], v) : v
  return out as T
}

/** One section from whatever is stored (anything at all), always valid. */
export function readSection<K extends SectionKey>(key: K, stored: unknown): Settings[K] {
  const merged = deepMerge(structuredClone(D[key]), isObject(stored) ? stored : {})
  const parsed = lenient[key].safeParse(merged)
  return (parsed.success ? parsed.data : structuredClone(D[key])) as Settings[K]
}

export interface StoredSettings {
  settings: Settings
  versions: Record<SectionKey, number>
}

/** The `get_public_settings()` payload (or a cached copy of it) into valid settings. */
export function readPublicSettings(payload: unknown): StoredSettings {
  const p = isObject(payload) ? payload : {}
  const settings = {} as Settings
  const versions = {} as Record<SectionKey, number>
  for (const key of SECTION_KEYS) {
    const entry = isObject(p[key]) ? (p[key] as Record<string, unknown>) : {}
    ;(settings as Record<SectionKey, unknown>)[key] = readSection(key, entry.value)
    versions[key] = typeof entry.version === 'number' ? entry.version : 0
  }
  return { settings, versions }
}

/**
 * The switches as the app should obey them: gamification is the master switch (off
 * turns xp, streaks, badges and levels off); xp off turns levels off. Avatars,
 * celebrations and public course pages are independent.
 */
export function effectiveFeatures(f: Settings['features']): Settings['features'] {
  const gam = f.gamification
  const xp = gam && f.xp
  return { ...f, xp, streaks: gam && f.streaks, badges: gam && f.badges, levels: xp && f.levels }
}
