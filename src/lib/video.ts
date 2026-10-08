/**
 * The one parser for `lessons.video_url`, shared by the student player and the
 * admin lesson editor. It accepts a direct video file URL, a share/watch/embed
 * URL from an allowlisted provider, or a pasted `<iframe>` snippet, and returns
 * a normalised source. The column only ever stores `source.url` (a plain https
 * URL), never pasted markup (`rules.md`).
 *
 * Snippets are never injected: the text is only scanned for a single iframe's
 * `src`, and anything that could run code (a script tag, an `on*` attribute, a
 * `javascript:` URL) or any tag beyond a plain wrapper makes the whole input
 * invalid. The extracted src then goes through exactly the same URL rules as a
 * pasted link, so a snippet can never reach a host a link could not.
 */

export type VideoProvider = 'file' | 'youtube' | 'vimeo' | 'loom' | 'wistia'

export type VideoSource =
  | { provider: 'file'; url: string }
  | { provider: Exclude<VideoProvider, 'file'>; id: string; url: string }

export type VideoParseError = 'empty' | 'unsafe' | 'insecure' | 'unsupported'

export type VideoParseResult = { ok: true; source: VideoSource } | { ok: false; error: VideoParseError }

/** Display names for the admin editor's "Detected" line. */
export const VIDEO_PROVIDER_LABEL: Record<VideoProvider, string> = {
  file: 'Video file',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  loom: 'Loom',
  wistia: 'Wistia',
}

/** Messages for the admin editor; the student page shows one friendly line for all of them. */
export const VIDEO_PARSE_MESSAGE: Record<VideoParseError, string> = {
  empty: 'Add a video link or embed code.',
  unsafe: 'That embed code has scripts or extra markup. Paste just the link, or only the <iframe> tag.',
  insecure: 'Use an https link.',
  unsupported: 'Use a YouTube, Vimeo, Loom or Wistia link, or a direct .mp4 / .webm file link.',
}

/** File extensions a browser's own <video> plays. */
const FILE_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov)$/i

/** Tags a provider's snippet may wrap its iframe in; anything else is refused. */
const WRAPPER_TAGS = new Set(['iframe', 'div', 'p', 'span', 'br'])

const fail = (error: VideoParseError): VideoParseResult => ({ ok: false, error })

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

/** The `src` of the single iframe in a pasted snippet, or an error. */
function srcFromSnippet(html: string): string | VideoParseError {
  if (/<\s*script/i.test(html) || /\son[a-z]+\s*=/i.test(html)) return 'unsafe'
  for (const m of html.matchAll(/<\/?\s*([a-z][\w-]*)/gi)) {
    if (!WRAPPER_TAGS.has(m[1].toLowerCase())) return 'unsafe'
  }
  const frames = [...html.matchAll(/<iframe\b([^>]*)>/gi)]
  if (frames.length !== 1) return 'unsupported'
  const src = frames[0][1].match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i)
  const value = src ? (src[1] ?? src[2] ?? src[3] ?? '') : ''
  return value ? decodeEntities(value.trim()) : 'unsupported'
}

function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function providerFrom(u: URL): VideoSource | null {
  const host = u.hostname.toLowerCase()
  const path = u.pathname

  if (hostIs(host, 'youtube.com') || hostIs(host, 'youtube-nocookie.com') || host === 'youtu.be') {
    const id =
      host === 'youtu.be'
        ? path.split('/')[1]
        : path === '/watch'
          ? u.searchParams.get('v')
          : path.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1]
    if (!id || !/^[\w-]{11}$/.test(id)) return null
    return { provider: 'youtube', id, url: `https://www.youtube-nocookie.com/embed/${id}` }
  }

  if (hostIs(host, 'vimeo.com')) {
    // vimeo.com/123, vimeo.com/123/abcdef (unlisted hash), vimeo.com/channels/x/123,
    // player.vimeo.com/video/123?h=abcdef
    const m = host === 'player.vimeo.com' ? path.match(/^\/video\/(\d+)\/?$/) : path.match(/\/(\d+)(?:\/([\da-f]+))?\/?$/i)
    if (!m) return null
    const hash = m[2] ?? u.searchParams.get('h')
    const safeHash = hash && /^[\da-f]+$/i.test(hash) ? hash : null
    return {
      provider: 'vimeo',
      id: m[1],
      url: `https://player.vimeo.com/video/${m[1]}${safeHash ? `?h=${safeHash}` : ''}`,
    }
  }

  if (hostIs(host, 'loom.com')) {
    const id = path.match(/^\/(?:share|embed)\/([\da-f]{32})\/?$/i)?.[1]
    return id ? { provider: 'loom', id, url: `https://www.loom.com/embed/${id.toLowerCase()}` } : null
  }

  if (hostIs(host, 'wistia.com') || hostIs(host, 'wistia.net') || host === 'wi.st') {
    const id = path.match(/^\/(?:medias|embed\/iframe|embed\/medias)\/([a-z\d]{10})(?:\.jsonp)?\/?$/i)?.[1]
    return id ? { provider: 'wistia', id, url: `https://fast.wistia.net/embed/iframe/${id}` } : null
  }

  return null
}

/**
 * Parse whatever an admin pasted (or what the column holds) into a playable source.
 * `allowHttp` admits http file links in development only; embeds are https always.
 */
export function parseVideoSource(input: string | null | undefined, opts: { allowHttp?: boolean } = {}): VideoParseResult {
  const raw = (input ?? '').trim()
  if (!raw) return fail('empty')

  const fromSnippet = raw.startsWith('<')
  let candidate = raw
  if (fromSnippet) {
    const src = srcFromSnippet(raw)
    if (src === 'unsafe' || src === 'unsupported' || src === 'empty' || src === 'insecure') return fail(src)
    candidate = src.startsWith('//') ? `https:${src}` : src
  }

  let u: URL
  try {
    u = new URL(candidate)
  } catch {
    return fail('unsupported')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return fail(fromSnippet ? 'unsafe' : 'unsupported')
  if (u.username || u.password) return fail('unsupported')

  const provider = providerFrom(u)
  if (provider) return u.protocol === 'https:' ? { ok: true, source: provider } : fail('insecure')

  // A snippet must point at an allowlisted provider; a file is a link, not an embed.
  if (fromSnippet || !FILE_EXT.test(u.pathname)) return fail('unsupported')
  if (u.protocol === 'http:' && !opts.allowHttp) return fail('insecure')
  return { ok: true, source: { provider: 'file', url: u.toString() } }
}

/**
 * Whether the player can see this source play and end (completion then needs the
 * end, and active time counts only while it plays). Loom and Wistia expose no
 * lightweight event API, so those lessons finish with a "Mark as complete" button.
 */
export function tracksPlayback(source: VideoSource): boolean {
  return source.provider === 'file' || source.provider === 'youtube' || source.provider === 'vimeo'
}
