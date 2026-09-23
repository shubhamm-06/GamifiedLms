import { useEffect, useRef, useState } from 'react'
import { Gamepad2, Play, RotateCw } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { safeMediaUrl, type GameInfo } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { PlayerError } from './PlayerError'

const LOAD_TIMEOUT_MS = 10_000

/**
 * A game lesson, treated as TIME-BASED: the game runs in a sandboxed frame and
 * the lesson completes on the timer like any other, because the schema
 * defines no protocol for a game to report anything (no postMessage contract).
 * The frame gets `sandbox="allow-scripts"` and nothing else: no same-origin
 * (so the game can neither read the app's storage or session nor touch this
 * page), no forms, popups, downloads or top navigation, and no referrer. A
 * "Play" start card is shown first (spec Part B6) so the iframe is not even
 * created, and so cannot grab audio or focus, until the child taps it. If it
 * has not loaded within 10 seconds, a friendly error replaces it.
 */
export function GameLesson({ game, courseId }: { game: GameInfo | null; courseId: string }) {
  const portrait = useMediaQuery('(orientation: portrait)')
  const src = safeMediaUrl(game?.bundleUrl, import.meta.env.DEV)
  const [started, setStarted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!started || loaded) return
    timer.current = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [started, loaded])

  if (!game || !src) {
    return (
      <div className="lp-game-start">
        <PlayerError
          heading={playerCopy.game.unavailable.heading}
          body={playerCopy.game.unavailable.body}
          icon={<Gamepad2 className="size-7" />}
          action={{ kind: 'back', courseId }}
          testId="game-unavailable"
        />
      </div>
    )
  }

  const wantsSideways = game.orientation === 'landscape' && portrait
  const wantsUpright = game.orientation === 'portrait' && !portrait

  if (timedOut) {
    return (
      <div className="lp-game-start">
        <PlayerError
          heading={playerCopy.game.failed.heading}
          body={playerCopy.game.failed.body}
          icon={<Gamepad2 className="size-7" />}
          action={{
            kind: 'retry',
            onRetry: () => {
              setTimedOut(false)
              setLoaded(false)
              setStarted(false)
            },
          }}
          testId="game-failed"
        />
      </div>
    )
  }

  if (!started) {
    return (
      <div className="lp-game-start" data-testid="game-start">
        <span className="lp-error-icon" aria-hidden="true">
          <Gamepad2 className="size-7" />
        </span>
        <p className="lp-game-start-title">{game.title}</p>
        <p className="lp-game-start-hint">{playerCopy.game.playHint}</p>
        <button type="button" className="candy-btn kid-tap" onClick={() => setStarted(true)} data-testid="game-play">
          <Play className="size-5" fill="currentColor" strokeWidth={0} aria-hidden />
          {playerCopy.button.playGame}
        </button>
      </div>
    )
  }

  return (
    <div data-testid="game-lesson">
      {wantsSideways || wantsUpright ? (
        <p className="lp-notice" role="status" data-testid="rotate-hint">
          <RotateCw className="size-5 flex-none" aria-hidden />
          {wantsSideways ? playerCopy.game.rotateSideways : playerCopy.game.rotateUpright}
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
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}
