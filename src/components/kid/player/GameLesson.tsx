import { useEffect, useState } from 'react'
import { Gamepad2, RotateCw } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { safeMediaUrl, type GameInfo } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { PlayerError } from './PlayerError'

const LOAD_TIMEOUT_MS = 10_000


/**
 * A game lesson, treated as TIME-BASED: the game runs in a sandboxed frame and
 * the lesson completes on the timer, because the schema defines no protocol
 * for a game to report anything. The frame gets `sandbox="allow-scripts"` and
 * nothing else (no same-origin, forms, popups or top navigation) and no
 * referrer. It is mounted only after the child taps Play on the activity
 * card, so it cannot grab audio or focus before then. A frame that has not
 * fired `load` within 10 seconds is replaced by a friendly error.
 *
 * Known limit: a cross-origin frame fires `load` for an error page too, so a
 * bundle URL that answers with a blank or broken page cannot be told apart
 * from a working game (see state.md: the games in the database have
 * placeholder bundle URLs).
 */
export function GameLesson({ game, courseId }: { game: GameInfo | null; courseId: string }) {
  const portrait = useMediaQuery('(orientation: portrait)')
  const src = game ? safeMediaUrl(game.bundleUrl, import.meta.env.DEV) : null
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!src || loaded || timedOut) return
    const id = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [src, loaded, timedOut, attempt])

  if (!game || !src) {
    return (
      <PlayerError
        heading={playerCopy.game.unavailable.heading}
        body={playerCopy.game.unavailable.body}
        icon={<Gamepad2 className="size-7" />}
        action={{ kind: 'back', courseId }}
        testId="game-unavailable"
      />
    )
  }

  if (timedOut) {
    return (
      <PlayerError
        heading={playerCopy.game.failed.heading}
        body={playerCopy.game.failed.body}
        icon={<Gamepad2 className="size-7" />}
        action={{
          kind: 'retry',
          onRetry: () => {
            setLoaded(false)
            setTimedOut(false)
            setAttempt((n) => n + 1)
          },
        }}
        testId="game-failed"
      />
    )
  }

  const wantsSideways = game.orientation === 'landscape' && portrait
  const wantsUpright = game.orientation === 'portrait' && !portrait

  return (
    <div className="flex flex-col gap-3" data-testid="game-lesson">
      {wantsSideways || wantsUpright ? (
        <p className="lp-notice" role="status" data-testid="rotate-hint">
          <RotateCw className="size-5 flex-none" aria-hidden />
          {wantsSideways ? playerCopy.game.rotateSideways : playerCopy.game.rotateUpright}
        </p>
      ) : null}
      <div className="lp-frame lp-game">
        <iframe
          key={attempt}
          src={src}
          title={game.title}
          sandbox="allow-scripts"
          allow=""
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}
