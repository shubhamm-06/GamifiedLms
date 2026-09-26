import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Gamepad2, PartyPopper, RotateCw } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isFromGame, originOf, parseGameMessage } from '@/lib/gameBridge'
import { loadGameEntry, withBase, type GameEntry } from '@/lib/gameCache'
import { lockGameOrientation, unlockGameOrientation } from '@/lib/gameOrientation'
import { safeMediaUrl, type GameInfo } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { PlayerError } from './PlayerError'

const LOAD_TIMEOUT_MS = 10_000

interface Props {
  game: GameInfo | null
  courseId: string
  /** A game reported it was finished (a valid message from the game's own frame). The page decides what that means. */
  onComplete: (score: number) => void
  /** A light acknowledgment to show over the game (a replay of a finished lesson), or null. */
  ack: string | null
}

/**
 * A game lesson's host: a full-bleed sandboxed frame around the game the admin
 * registered (`games.bundle_url`), with nothing else on screen. It
 *  - shows the entry page from a copy on this device when the game's
 *    `bundle_version` matches (`gameCache`, best effort, entry page only), else
 *    loads it from its URL; a cached copy is shown through `srcdoc` in a sandbox
 *    WITHOUT same-origin, a live one through `src` with `allow-scripts
 *    allow-same-origin` (safe: the game is on another origin, so it still cannot
 *    touch this app);
 *  - locks the device to the game's orientation while it is mounted (native
 *    plugin) and unlocks on the way out;
 *  - listens for the completion message (`gameBridge`), accepting only one
 *    from this frame's own window and origin, and hands it to the page.
 * A frame that has not fired `load` within 10 seconds becomes the shared load
 * failure with Try again. Known limit: a cross-origin frame fires `load` for an
 * error page too, so a broken URL that still answers cannot be told from a game.
 */
export function GameLesson({ game, courseId, onComplete, ack }: Props) {
  const portrait = useMediaQuery('(orientation: portrait)')
  const src = game ? safeMediaUrl(game.bundleUrl, import.meta.env.DEV) : null
  const [attempt, setAttempt] = useState(0)
  const [entry, setEntry] = useState<GameEntry | null | undefined>(undefined) // undefined: still deciding
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const completeRef = useRef(onComplete)
  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  // The entry page: from this device's copy, or fetched (and stored), or null = load it straight from its URL.
  const gameId = game?.id
  const gameUrl = game?.bundleUrl
  const gameVersion = game?.bundleVersion
  useEffect(() => {
    if (!gameId || !gameUrl || !src) return
    let cancelled = false
    void loadGameEntry({ id: gameId, bundleUrl: gameUrl, bundleVersion: gameVersion ?? '' }).then((e) => {
      if (!cancelled) setEntry(e)
    })
    return () => {
      cancelled = true
    }
  }, [gameId, gameUrl, gameVersion, src, attempt])

  // The device orientation, only while the game is on screen.
  const orientation = game?.orientation
  useEffect(() => {
    if (orientation !== 'portrait' && orientation !== 'landscape') return
    void lockGameOrientation(orientation)
    return () => void unlockGameOrientation()
  }, [orientation])

  // Only this game, from its own frame and origin, can say it is finished.
  const servedFromCopy = !!entry // a stored or freshly fetched entry page is shown through srcdoc
  const bundleOrigin = gameUrl ? originOf(gameUrl) : null
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isFromGame(e, frame.current?.contentWindow, bundleOrigin, servedFromCopy)) return
      const msg = parseGameMessage(e.data)
      if (msg) completeRef.current(msg.score)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [bundleOrigin, servedFromCopy])

  // A game that never loads becomes an error with Try again.
  useEffect(() => {
    if (!src || entry === undefined || loaded || timedOut) return
    const id = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [src, entry, loaded, timedOut, attempt])

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
            setEntry(undefined)
            setAttempt((n) => n + 1)
          },
        }}
        testId="game-failed"
      />
    )
  }

  // On a native shell the lock does this; in a browser a hint says what the game wants.
  const native = Capacitor.isNativePlatform()
  const wantsSideways = !native && game.orientation === 'landscape' && portrait
  const wantsUpright = !native && game.orientation === 'portrait' && !portrait

  return (
    <div className="lp-game-stage" data-testid="game-lesson" data-source={entry?.source ?? (entry === null ? 'direct' : 'pending')}>
      {entry !== undefined ? (
        <iframe
          key={`${attempt}-${entry === null ? 'direct' : entry.source}`}
          ref={frame}
          className="lp-game-frame"
          title={game.title}
          {...(entry
            ? { srcDoc: withBase(entry.html, game.bundleUrl), sandbox: 'allow-scripts' }
            : { src, sandbox: 'allow-scripts allow-same-origin' })}
          allow="autoplay"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
        />
      ) : null}
      {!loaded ? (
        <div className="lp-game-loading" role="status" data-testid="game-loading">
          <span className="lp-primary-spinner" aria-hidden />
          {playerCopy.game.loading}
        </div>
      ) : null}
      {wantsSideways || wantsUpright ? (
        <p className="lp-notice lp-game-hint" role="status" data-testid="rotate-hint">
          <RotateCw className="size-5 flex-none" aria-hidden />
          {wantsSideways ? playerCopy.game.rotateSideways : playerCopy.game.rotateUpright}
        </p>
      ) : null}
      {ack ? (
        <p className="lp-game-ack" role="status" data-testid="replay-ack">
          <PartyPopper className="size-5 flex-none" aria-hidden />
          {ack}
        </p>
      ) : null}
    </div>
  )
}
