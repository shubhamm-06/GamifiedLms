/**
 * Canonical helpers for `lessons.video_url`. There is no separate column
 * marking a video as "embedded" — the column stores either a direct file/
 * stream URL or a normalized YouTube/Vimeo embed URL, and `isEmbedUrl` is
 * how any consumer (this admin form today, the student-facing player later)
 * tells the two apart without re-guessing URL shapes independently.
 *
 * Deliberately narrow: only YouTube and Vimeo share links are recognized.
 * Raw `<iframe>`/HTML embed code is never accepted here — these functions
 * only ever extract a video id via regex and reconstruct a plain URL, so
 * even if someone pastes a full iframe tag, nothing beyond the id is kept.
 */

interface EmbedMatch {
  embedUrl: string
}

function matchYouTube(url: string): EmbedMatch | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
  )
  return match ? { embedUrl: `https://www.youtube.com/embed/${match[1]}` } : null
}

function matchVimeo(url: string): EmbedMatch | null {
  const match = url.match(/(?:player\.vimeo\.com\/video\/|vimeo\.com\/)(\d+)/)
  return match ? { embedUrl: `https://player.vimeo.com/video/${match[1]}` } : null
}

/** True if `url` is already a normalized YouTube/Vimeo embed URL. */
export function isEmbedUrl(url: string): boolean {
  return (
    /^https:\/\/www\.youtube\.com\/embed\/[\w-]{11}$/.test(url) ||
    /^https:\/\/player\.vimeo\.com\/video\/\d+$/.test(url)
  )
}

/**
 * Normalizes a pasted YouTube/Vimeo share link (or an already-normalized
 * embed URL) into the canonical embeddable form. Returns `null` if the URL
 * doesn't match a recognized pattern — callers must treat that as a
 * validation failure, never save the unrecognized value as if it were valid.
 */
export function normalizeEmbedUrl(url: string): string | null {
  const trimmed = url.trim()
  const match = matchYouTube(trimmed) ?? matchVimeo(trimmed)
  return match?.embedUrl ?? null
}
