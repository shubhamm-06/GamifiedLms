import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

/**
 * Best-effort on-device copy of a game's ENTRY PAGE, keyed to `bundle_version`.
 *
 * What this is: the first successful load fetches the entry document and stores
 * it (Capacitor Filesystem: real files on iOS and Android, IndexedDB in a
 * browser); later visits show that copy unless the game's `bundle_version` or
 * `bundle_url` has changed, in which case it is fetched again and replaced.
 *
 * What this is NOT: offline support. Only the entry document is stored. Whatever
 * the page pulls in (scripts, images, audio) still comes from the game's host,
 * through that host's own cache headers and the WebView's HTTP cache; a
 * cross-origin frame's subresources are not something this app can intercept or
 * keep. A game whose entry page needs the network for everything else will not
 * work offline, cached entry page or not. Any failure here (a host that sends no
 * CORS headers to a browser, offline, a full disk) returns null and the caller
 * loads the game straight from its URL.
 */

const DIR = Directory.Cache
const MAX_BYTES = 2_000_000
const FETCH_TIMEOUT_MS = 8_000

export interface GameEntryKey {
  id: string
  bundleUrl: string
  bundleVersion: string
}

export type GameEntry = { html: string; source: 'cache' | 'network' }

const htmlPath = (id: string) => `gamebundles/${id}.html`
const metaPath = (id: string) => `gamebundles/${id}.json`

async function readText(path: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({ path, directory: DIR, encoding: Encoding.UTF8 })
    return typeof r.data === 'string' ? r.data : null
  } catch {
    return null
  }
}

async function fetchEntry(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { credentials: 'omit', signal: controller.signal })
    if (!res.ok) return null
    const text = await res.text()
    // A page, not a download: reject something empty or unreasonably large.
    if (!text.trim() || text.length > MAX_BYTES) return null
    return text
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

const inFlight = new Map<string, Promise<GameEntry | null>>()

/**
 * The entry page from the copy on this device when it is current, else fetched and stored; null
 * when neither works. Two calls for the same game and version at once share one load (React
 * strict mode in development mounts an effect twice), so a game is never fetched twice together.
 */
export function loadGameEntry(key: GameEntryKey): Promise<GameEntry | null> {
  const id = `${key.id}|${key.bundleVersion}|${key.bundleUrl}`
  const running = inFlight.get(id)
  if (running) return running
  const p = load(key).finally(() => inFlight.delete(id))
  inFlight.set(id, p)
  return p
}

async function load(key: GameEntryKey): Promise<GameEntry | null> {
  const metaText = await readText(metaPath(key.id))
  if (metaText) {
    try {
      const meta = JSON.parse(metaText) as { version?: string; url?: string }
      if (meta.version === key.bundleVersion && meta.url === key.bundleUrl) {
        const html = await readText(htmlPath(key.id))
        if (html) return { html, source: 'cache' }
      }
    } catch {
      /* a damaged meta file: treat as no cache */
    }
  }

  const html = await fetchEntry(key.bundleUrl)
  if (html === null) return null
  try {
    await Filesystem.writeFile({ path: htmlPath(key.id), data: html, directory: DIR, encoding: Encoding.UTF8, recursive: true })
    await Filesystem.writeFile({
      path: metaPath(key.id),
      data: JSON.stringify({ version: key.bundleVersion, url: key.bundleUrl }),
      directory: DIR,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  } catch {
    /* could not store it: still usable this once */
  }
  return { html, source: 'network' }
}

/**
 * The entry page with a `<base>` pointing at the game's own folder, so the relative links inside it
 * (`game.js`, `art/hero.png`) still load from the host when the page is shown from a stored copy.
 */
export function withBase(html: string, bundleUrl: string): string {
  if (/<base\s/i.test(html)) return html
  let href: string
  try {
    href = new URL('./', bundleUrl).toString()
  } catch {
    return html
  }
  const tag = `<base href="${href.replace(/"/g, '&quot;')}">`
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`) : `${tag}${html}`
}
