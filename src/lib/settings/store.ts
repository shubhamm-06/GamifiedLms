/**
 * The live settings, outside React: a snapshot, a subscription, the localStorage
 * cache and the document side effects (theme variables, title, favicon, meta).
 *
 * Boot order (`bootSettings`, called in main.tsx before React renders): read the
 * cached public settings (one versioned key, validated), apply the theme and title
 * synchronously, so a returning visitor sees no flash. With no cache the defaults
 * apply. `SettingsProvider` then fetches `get_public_settings()` and calls
 * `setSettings` with the result, which re-applies and refreshes the cache.
 */
import { supabase } from '@/lib/supabase'
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, deriveTokens } from '@/lib/theme'
import { loadFont, resolveFamily } from './fonts'
import { setActiveTerminology } from './termsCore'
import { DEFAULT_SETTINGS, SECTION_KEYS, readPublicSettings, type SectionKey, type Settings, type StoredSettings } from './schema'

const CACHE_KEY = 'skillxp.settings.v1'

/** react-query key of `get_public_settings()`; the admin Settings page invalidates it after a save. */
export const publicSettingsQueryKey = ['public-settings'] as const

let current: StoredSettings = {
  settings: structuredClone(DEFAULT_SETTINGS),
  versions: { branding: 0, theme: 0, terminology: 0, features: 0 },
}
const listeners = new Set<() => void>()

export function getSettingsSnapshot(): Settings {
  return current.settings
}

export function getSettingsVersions(): Record<SectionKey, number> {
  return current.versions
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Replace the live settings (from the server, the cache or a fresh admin save). */
export function setSettings(next: StoredSettings, opts: { cache?: boolean } = {}): void {
  current = next
  setActiveTerminology(next.settings.terminology)
  applyToDocument(next.settings)
  if (opts.cache !== false) writeCache(next)
  for (const fn of listeners) fn()
}

/** The raw `get_public_settings()` payload, as the cache stores it. */
function writeCache(s: StoredSettings): void {
  try {
    const payload = Object.fromEntries(Object.entries(s.settings).map(([k, v]) => [k, { value: v, version: s.versions[k as SectionKey] }]))
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode or blocked storage: the next load just fetches */
  }
}

export function readCache(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? readPublicSettings(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/**
 * Ask the server now (at most `timeoutMs`), apply the answer, and return the live settings.
 * For decisions that must not rest on a stale cache (a route redirect); on a failure or a
 * slow answer the current settings stand.
 */
export async function refreshSettings(timeoutMs = 3000): Promise<Settings> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('settings timeout')), timeoutMs))
    const call = supabase.rpc('get_public_settings').then(({ data, error }) => {
      if (error) throw error
      return data
    })
    const next = readPublicSettings(await Promise.race([call, timeout]))
    if (SECTION_KEYS.some((k) => next.versions[k] !== current.versions[k])) setSettings(next)
  } catch {
    /* offline or slow: keep what we have */
  }
  return current.settings
}

/** Before React: the cached settings (validated), else the defaults, applied to the document. */
export function bootSettings(): void {
  const cached = readCache()
  if (cached) current = cached
  setActiveTerminology(current.settings.terminology)
  applyToDocument(current.settings)
}

// ---------------------------------------------------------------- document side effects

let defaultFavicon: string | null = null

function setMeta(name: string, content: string | null): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!content) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

/** Pages with their own title (`document.title = "<page> | <product>"`) read the name from the snapshot. */
export function productTitle(page?: string): string {
  const name = current.settings.branding.productName
  return page ? `${page} | ${name}` : name
}

function applyToDocument(s: Settings): void {
  const root = document.documentElement.style
  const primary = deriveTokens(s.theme.primary)
  const secondary = deriveTokens(s.theme.secondary)
  // At the default colour the locked values in styles.css apply untouched (exact -d values);
  // an override sets the role's three variables on <html>.
  const role = (name: 'gold' | 'teal', t: typeof primary, isDefault: boolean) => {
    for (const [suffix, value] of [['', t.base], ['-d', t.dark], ['-fg', t.fg]] as const) {
      if (isDefault) root.removeProperty(`--${name}${suffix}`)
      else root.setProperty(`--${name}${suffix}`, value)
    }
  }
  role('gold', primary, primary.base === DEFAULT_PRIMARY)
  role('teal', secondary, secondary.base === DEFAULT_SECONDARY)

  // Fonts: a CSS variable per role (never on :root alone — the admin's own boundary,
  // `.admin-shell { --learner-font-heading: initial; --learner-font-body: initial; }` in
  // styles.css, is the real leak guard; see ui.md "Settings system > Fonts"). Named
  // `--learner-font-*` (not `--font-heading`/`--font-body`) because Tailwind's own
  // `@theme inline` in index.css already owns `--font-heading` as a utility token
  // (`font-heading` class, bound to `--font-sans`/Geist) — reusing that name here would
  // make "default" silently resolve to Geist instead of truly falling through, since
  // that unlayered Tailwind value always beats our `@layer components` one once there is
  // no inline style to out-rank it. "default" removes the property, so the pre-existing
  // chains (--font-kid, --font-ui-desktop, the auth page's inherited Geist) render
  // unchanged. The chosen fonts are also loaded now (idempotent, never throws);
  // font-display: swap covers the moment before they land.
  const headingFamily = resolveFamily(s.theme.fonts.heading)
  const bodyFamily = resolveFamily(s.theme.fonts.body)
  if (headingFamily) root.setProperty('--learner-font-heading', headingFamily)
  else root.removeProperty('--learner-font-heading')
  if (bodyFamily) root.setProperty('--learner-font-body', bodyFamily)
  else root.removeProperty('--learner-font-body')
  void loadFont(s.theme.fonts.heading)
  void loadFont(s.theme.fonts.body)

  // The title: keep a page-specific prefix ("Course | Old name") when one is set.
  const parts = document.title.split(' | ')
  document.title = parts.length > 1 ? `${parts.slice(0, -1).join(' | ')} | ${s.branding.productName}` : s.branding.productName
  setMeta('description', s.branding.tagline || null)
  setMeta('theme-color', primary.base)

  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (icon) {
    defaultFavicon ??= icon.getAttribute('href')
    const href = s.branding.faviconUrl || defaultFavicon || '/favicon.svg'
    if (icon.getAttribute('href') !== href) {
      icon.href = href
      icon.removeAttribute('type')
    }
  }
}
