/**
 * The admin-editable font catalog (Settings > Appearance > Fonts). A fixed allowlist —
 * no uploads, no URLs, no free-text names, no Google Fonts links. Only an id is ever
 * stored (`site_config.theme.fonts`); this file is the only place that turns an id into
 * an actual family, a loader and a fallback stack.
 *
 * Two roles: HEADING (page/section titles, buttons, stat numbers, badge/reward text —
 * see `ui.md` "Settings system > Fonts" for where the current UI puts each role, which
 * in a few spots follows the EXISTING code's split rather than this list, by design) and
 * BODY (everything else). "default" means exactly today's look: it resolves no CSS
 * variable at all, so the pre-existing hardcoded chains (`--font-kid`, `--font-ui-desktop`,
 * the auth page's inherited Geist) render unchanged — a fresh install or a cleared
 * setting is pixel-identical to before this feature existed.
 *
 * Every non-default entry is self-hosted (`@fontsource[-variable]/<pkg>`, OFL-1.1),
 * lazy-loaded (one chunk per font — `load()` is a plain dynamic `import()` so Vite can
 * split it), `font-display: swap`, and never fetches from a CDN. A static package
 * (no variable build exists) only imports the weight files the UI actually uses
 * (400/500/600/700/800); a font missing one of those weights (Atkinson Hyperlegible:
 * 400/700 only) falls back to the nearest weight the browser's own font matching
 * picks within the family — no synthesized fake bold (`font-synthesis-weight: none`
 * on the scoped roots).
 *
 * No `@/` imports: `scripts/check-settings.mjs` runs this file directly under Node.
 */

export type FontId =
  | 'default'
  | 'baloo-2'
  | 'fredoka'
  | 'nunito'
  | 'poppins'
  | 'inter'
  | 'geist'
  | 'dm-sans'
  | 'plus-jakarta-sans'
  | 'manrope'
  | 'lexend'
  | 'atkinson-hyperlegible'
  | 'source-serif-4'

export const FONT_IDS = [
  'default',
  'baloo-2',
  'fredoka',
  'nunito',
  'poppins',
  'inter',
  'geist',
  'dm-sans',
  'plus-jakarta-sans',
  'manrope',
  'lexend',
  'atkinson-hyperlegible',
  'source-serif-4',
] as const satisfies readonly FontId[]

export type FontCategory = 'Default' | 'Playful' | 'Friendly' | 'Geometric' | 'Clean' | 'Modern' | 'Readable' | 'Accessible' | 'Serif'

export interface FontEntry {
  id: FontId
  label: string
  category: FontCategory
  /** Which role this face is usually picked for — shown as a hint, never a restriction. */
  roleHint: 'heading' | 'body' | 'both'
  /** The self-hosted package this loads (for the docs/summary); null for "default" (nothing loads). */
  package: string | null
  /** The @font-face family name the package declares; '' for "default" (no override). */
  cssFamily: string
  /** The fallback stack after the family name, used while it loads and if it fails. */
  fallbackStack: string
  /** Weights actually shipped for this family; the UI uses 400/500/600/700/800. */
  weights: number[]
  /** Has a Devanagari (Hindi) subset. */
  devanagari: boolean
  /** Lazy-loads the font's CSS (one chunk). Idempotent, never throws — see `loadFont`. */
  load: () => Promise<unknown>
}

const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const SYSTEM_ROUNDED = 'ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif'
const SYSTEM_SERIF = 'Georgia, "Times New Roman", serif'

const noop = () => Promise.resolve()

export const FONT_CATALOG: Record<FontId, FontEntry> = {
  default: {
    id: 'default',
    label: 'Default',
    category: 'Default',
    roleHint: 'both',
    package: null,
    cssFamily: '',
    fallbackStack: '',
    weights: [],
    devanagari: false,
    load: noop,
  },
  'baloo-2': {
    id: 'baloo-2',
    label: 'Baloo 2',
    category: 'Playful',
    roleHint: 'heading',
    package: '@fontsource-variable/baloo-2',
    cssFamily: 'Baloo 2 Variable',
    fallbackStack: SYSTEM_ROUNDED,
    weights: [400, 500, 600, 700, 800],
    devanagari: true,
    load: () => import('@fontsource-variable/baloo-2'),
  },
  fredoka: {
    id: 'fredoka',
    label: 'Fredoka',
    category: 'Playful',
    roleHint: 'heading',
    package: '@fontsource-variable/fredoka',
    cssFamily: 'Fredoka Variable',
    fallbackStack: SYSTEM_ROUNDED,
    weights: [400, 500, 600, 700],
    devanagari: false,
    load: () => import('@fontsource-variable/fredoka'),
  },
  nunito: {
    id: 'nunito',
    label: 'Nunito',
    category: 'Friendly',
    roleHint: 'both',
    package: '@fontsource-variable/nunito',
    cssFamily: 'Nunito Variable',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    load: () => import('@fontsource-variable/nunito'),
  },
  poppins: {
    id: 'poppins',
    label: 'Poppins',
    category: 'Geometric',
    roleHint: 'heading',
    package: '@fontsource/poppins',
    cssFamily: 'Poppins',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: true,
    load: () =>
      Promise.all([
        import('@fontsource/poppins/400.css'),
        import('@fontsource/poppins/500.css'),
        import('@fontsource/poppins/600.css'),
        import('@fontsource/poppins/700.css'),
        import('@fontsource/poppins/800.css'),
      ]),
  },
  inter: {
    id: 'inter',
    label: 'Inter',
    category: 'Clean',
    roleHint: 'both',
    package: '@fontsource-variable/inter',
    cssFamily: 'Inter Variable',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    load: () => import('@fontsource-variable/inter'),
  },
  geist: {
    id: 'geist',
    label: 'Geist',
    category: 'Clean',
    roleHint: 'both',
    package: '@fontsource-variable/geist',
    cssFamily: 'Geist Variable',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    // Already loaded globally (index.css, the admin face) — this just confirms it's ready.
    load: () => import('@fontsource-variable/geist'),
  },
  'dm-sans': {
    id: 'dm-sans',
    label: 'DM Sans',
    category: 'Clean',
    roleHint: 'both',
    package: '@fontsource-variable/dm-sans',
    cssFamily: 'DM Sans Variable',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    load: () => import('@fontsource-variable/dm-sans'),
  },
  'plus-jakarta-sans': {
    id: 'plus-jakarta-sans',
    label: 'Plus Jakarta Sans',
    category: 'Modern',
    roleHint: 'both',
    package: '@fontsource-variable/plus-jakarta-sans',
    cssFamily: 'Plus Jakarta Sans Variable',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    load: () => import('@fontsource-variable/plus-jakarta-sans'),
  },
  manrope: {
    id: 'manrope',
    label: 'Manrope',
    category: 'Modern',
    roleHint: 'both',
    package: '@fontsource-variable/manrope',
    cssFamily: 'Manrope Variable',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    load: () => import('@fontsource-variable/manrope'),
  },
  lexend: {
    id: 'lexend',
    label: 'Lexend',
    category: 'Readable',
    roleHint: 'body',
    package: '@fontsource-variable/lexend',
    cssFamily: 'Lexend Variable',
    fallbackStack: SYSTEM_SANS,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    load: () => import('@fontsource-variable/lexend'),
  },
  'atkinson-hyperlegible': {
    id: 'atkinson-hyperlegible',
    label: 'Atkinson Hyperlegible',
    category: 'Accessible',
    roleHint: 'body',
    package: '@fontsource/atkinson-hyperlegible',
    cssFamily: 'Atkinson Hyperlegible',
    fallbackStack: SYSTEM_SANS,
    // Only 400 and 700 are published; 500/600 land on 400, 800 lands on 700 (the
    // browser's own nearest-weight match across the two @font-face rules below —
    // never a synthesized fake bold).
    weights: [400, 700],
    devanagari: false,
    load: () => Promise.all([import('@fontsource/atkinson-hyperlegible/400.css'), import('@fontsource/atkinson-hyperlegible/700.css')]),
  },
  'source-serif-4': {
    id: 'source-serif-4',
    label: 'Source Serif 4',
    category: 'Serif',
    roleHint: 'body',
    package: '@fontsource-variable/source-serif-4',
    cssFamily: 'Source Serif 4 Variable',
    fallbackStack: SYSTEM_SERIF,
    weights: [400, 500, 600, 700, 800],
    devanagari: false,
    load: () => import('@fontsource-variable/source-serif-4'),
  },
}

export function getFont(id: string | null | undefined): FontEntry {
  return (id && id in FONT_CATALOG ? FONT_CATALOG[id as FontId] : undefined) ?? FONT_CATALOG.default
}

/** The CSS `font-family` value for a catalog id, or `null` for "default" (nothing to set). */
export function resolveFamily(id: string | null | undefined): string | null {
  const f = getFont(id)
  if (f.id === 'default') return null
  return `'${f.cssFamily}', ${f.fallbackStack}`
}

const loading = new Map<FontId, Promise<void>>()

/**
 * Loads a catalog font's CSS (idempotent: a second call for the same id returns the
 * same in-flight/resolved promise). Never throws — offline or a blocked request just
 * means the fallback stack keeps rendering; nothing here can crash the page.
 */
export function loadFont(id: string | null | undefined): Promise<void> {
  const f = getFont(id)
  if (f.id === 'default') return Promise.resolve()
  const cached = loading.get(f.id)
  if (cached) return cached
  const p = f
    .load()
    .then(() => undefined)
    .catch(() => undefined)
  loading.set(f.id, p)
  return p
}
