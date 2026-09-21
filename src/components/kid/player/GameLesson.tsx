import { RotateCw } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { safeMediaUrl, type GameInfo } from '@/lib/lessonPlayer'
import { LessonMessage } from './LessonMessage'

/**
 * A game lesson, treated as TIME-BASED: the game runs in a sandboxed frame and the
 * lesson completes on the timer like any other, because the schema defines no
 * protocol for a game to report anything (no postMessage contract, and
 * `games.max_xp` is unused). The frame gets `sandbox="allow-scripts"` and
 * nothing else: no same-origin (so the game can neither read the app's storage or
 * session nor touch this page), no forms, popups, downloads or top navigation,
 * and no referrer. A game that needs storage or network identity will not work
 * until a protocol is designed. Only https bundle URLs load (http in dev only).
 * The rotate hint is a visual nudge; nothing locks the orientation.
 */
export function GameLesson({ game }: { game: GameInfo | null }) {
  const portrait = useMediaQuery('(orientation: portrait)')
  const src = safeMediaUrl(game?.bundleUrl, import.meta.env.DEV)
  if (!game || !src) {
    return <LessonMessage testId="game-unavailable">This game isn&rsquo;t ready yet. Please check back soon.</LessonMessage>
  }
  const wantsSideways = game.orientation === 'landscape' && portrait
  const wantsUpright = game.orientation === 'portrait' && !portrait
  return (
    <div data-testid="game-lesson">
      {wantsSideways || wantsUpright ? (
        <p className="lp-notice" role="status" data-testid="rotate-hint">
          <RotateCw className="size-5 flex-none" aria-hidden />
          {wantsSideways ? 'This game is more fun sideways. Turn your phone.' : 'This game is best played with your phone upright.'}
        </p>
      ) : null}
      <div className="lp-frame lp-game">
        <iframe
          src={src}
          title={game.title}
          sandbox="allow-scripts"
          allow=""
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>
    </div>
  )
}
