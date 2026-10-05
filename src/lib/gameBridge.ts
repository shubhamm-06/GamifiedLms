/**
 * The contract between a hosted game and the app, and the rules for trusting a
 * message from it. A game reports one thing, that the child finished it:
 *
 *   window.parent.postMessage({ type: 'game:complete', score: 12 }, '*')
 *
 * `score` is a finite number >= 0 (it is XP: the server floors it and clamps it
 * to the game's `max_xp`, so a game may report any positive number without
 * being able to over-award). Anything else is ignored. The app never credits
 * XP from the message itself; it forwards the score to `fn_complete_game`.
 * Documented for game authors in `docs/ui.md`.
 */

const GAME_COMPLETE = 'game:complete'

interface GameComplete {
  score: number
}

/** A well-formed completion message, or null (wrong shape, wrong type, NaN, negative, not a number). */
export function parseGameMessage(data: unknown): GameComplete | null {
  if (!data || typeof data !== 'object') return null
  const m = data as { type?: unknown; score?: unknown }
  if (m.type !== GAME_COMPLETE) return null
  if (typeof m.score !== 'number' || !Number.isFinite(m.score) || m.score < 0) return null
  return { score: m.score }
}

/** The origin of a bundle URL ("https://games.example.com"), or null when it is not a URL. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Whether a `message` event may count as this game speaking. It must come from THE game frame's
 * own window (a stray message from another frame, a popup or the app itself never matches) and
 * from the game's own origin. The one exception is an entry page shown from a stored or freshly
 * fetched copy: it is shown through `srcdoc` in a sandbox WITHOUT same-origin (so it can never reach the app), which gives the
 * frame an opaque origin and its messages the origin string "null"; the window check is what
 * identifies it there.
 */
export function isFromGame(
  event: { source: unknown; origin: string },
  frameWindow: unknown,
  bundleOrigin: string | null,
  servedFromCopy: boolean,
): boolean {
  if (!frameWindow || event.source !== frameWindow) return false
  if (servedFromCopy) return event.origin === 'null'
  return !!bundleOrigin && event.origin === bundleOrigin
}
