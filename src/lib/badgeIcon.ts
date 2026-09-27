/**
 * Badge icons are drawn from a small, closed set of colour+glyph
 * combinations rather than pasted image URLs — a filled circle, a darker
 * stroke ring, one cream glyph, exactly the shape the six hand-seeded
 * badges already used (extracted from their real `icon_url` rows, not
 * invented). The generated SVG is saved as a `data:image/svg+xml;base64,`
 * URI, the same shape those rows already have, so the kid-facing Badges
 * screen (which just renders `icon_url` as an `<img>`) needs no changes.
 *
 * A data URI has no access to the app's CSS custom properties — an SVG
 * `fill="var(--gold)"` only resolves inside a document that defines that
 * property, and a standalone image has no such document. The hex values
 * below are therefore a necessary, deliberate exception to "never hardcode
 * hex": this is the one place the four locked tokens' literal values live
 * outside `styles.css`, and if that file's tokens ever change, this map is
 * what needs updating to match.
 */

export const BADGE_COLORS = ['gold', 'teal', 'coral', 'plum'] as const
export type BadgeColor = (typeof BADGE_COLORS)[number]

export const BADGE_GLYPHS = ['checkmark', 'flame', 'spark', 'trophy', 'star', 'dots'] as const
export type BadgeGlyph = (typeof BADGE_GLYPHS)[number]

const TOKEN_HEX: Record<BadgeColor, { base: string; dark: string }> = {
  gold: { base: '#F2B233', dark: '#C98A0D' },
  teal: { base: '#2FA3A0', dark: '#1E6765' },
  coral: { base: '#F0705A', dark: '#D73014' },
  plum: { base: '#7A5FA8', dark: '#57427A' },
}

const CREAM = '#FFF7EA'

// Each fragment reuses the exact path data the six existing badges already
// draw (century-club's spark, first-steps' checkmark, getting-started's
// dots, on-a-roll's flame) or, for the two glyphs no existing badge has
// (trophy, star), a new shape in the same style: a cream glyph centred in
// the 160x160 circle, thick enough to read small. Trophy is composed from
// the same pieces course-champion's cap already used (a bowl, two curled
// handles, a stem, a base) — that badge's icon already _is_ a trophy shape.
const GLYPH_MARKUP: Record<BadgeGlyph, string> = {
  checkmark: `<path d="M50 82 L70 102 L112 58" fill="none" stroke="${CREAM}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`,
  flame: `<path d="M80 40c8 18-10 22-10 38a18 18 0 0 0 36 0c0-10-6-14-6-22 8 6 14 18 14 30a26 26 0 0 1-52 0c0-24 18-28 18-46z" fill="${CREAM}"/>`,
  spark: `<path d="M80 34 L90 68 L124 78 L90 88 L80 122 L70 88 L36 78 L70 68 Z" fill="${CREAM}"/>`,
  trophy: `<path d="M58 44h44v24a22 22 0 0 1-44 0z" fill="${CREAM}"/><path d="M58 50c-10 0-16 6-16 15s7 15 16 15" fill="none" stroke="${CREAM}" stroke-width="7" stroke-linecap="round"/><path d="M102 50c10 0 16 6 16 15s-7 15-16 15" fill="none" stroke="${CREAM}" stroke-width="7" stroke-linecap="round"/><rect x="72" y="88" width="16" height="16" fill="${CREAM}"/><rect x="58" y="104" width="44" height="10" rx="4" fill="${CREAM}"/>`,
  star: `<path d="M80,38 L90.6,65.4 L119.9,67 L97.1,85.6 L104.7,114 L80,98 L55.3,114 L62.9,85.6 L40.1,67 L69.4,65.4 Z" fill="${CREAM}"/>`,
  dots: `<circle cx="52" cy="80" r="11" fill="${CREAM}"/><circle cx="80" cy="80" r="11" fill="${CREAM}"/><circle cx="108" cy="80" r="11" fill="${CREAM}"/>`,
}

export function buildBadgeIconSvg(color: BadgeColor, glyph: BadgeGlyph): string {
  const { base, dark } = TOKEN_HEX[color]
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">` +
    `<circle cx="80" cy="80" r="72" fill="${base}"/>` +
    `<circle cx="80" cy="80" r="72" fill="none" stroke="${dark}" stroke-width="6"/>` +
    GLYPH_MARKUP[glyph] +
    `</svg>`
  )
}

/** The exact bytes saved to `icon_url` — the live preview renders this same string, so "what you see" and "what gets saved" can never drift apart. */
export function buildBadgeIconDataUri(color: BadgeColor, glyph: BadgeGlyph): string {
  // The SVG is pure ASCII (hex colours, path commands, no user-supplied
  // text), so btoa's Latin1-only limitation is never in play here.
  return `data:image/svg+xml;base64,${btoa(buildBadgeIconSvg(color, glyph))}`
}

/**
 * Reverse lookup for editing an existing badge: an exact match means this
 * icon was already produced by this builder (including a fresh save through
 * it), so the picker can preselect the real combination. A badge whose icon
 * predates the builder (the six hand-seeded rows, or anything pasted in
 * directly) won't match anything here — there is no reliable way to guess a
 * colour+glyph back out of an arbitrary image. The caller defaults the
 * picker in that case; saving then normalises that badge onto the builder's
 * output, a deliberate consequence of moving off ad-hoc icon_url values.
 */
export function detectBadgeIcon(iconUrl: string | null): { color: BadgeColor; glyph: BadgeGlyph } | null {
  if (!iconUrl) return null
  for (const color of BADGE_COLORS) {
    for (const glyph of BADGE_GLYPHS) {
      if (buildBadgeIconDataUri(color, glyph) === iconUrl) return { color, glyph }
    }
  }
  return null
}
