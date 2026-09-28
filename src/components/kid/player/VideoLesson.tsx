import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useBackClosable } from '@/hooks/useBackClosable'
import { videoSource } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import {
  INITIAL_PLAYBACK,
  parseEmbed,
  playbackClock,
  type PlaybackControls,
  type PlaybackState,
} from '@/lib/videoPlayback'
import { PlayerError } from './PlayerError'
import { NativeEngine, VimeoEngine, YouTubeEngine } from './VideoEngines'

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> }

/** Landscape in, released out. Throws are swallowed: an unsupported browser or a page not yet fullscreen. */
async function orientate(fullscreen: boolean): Promise<void> {
  try {
    const o = window.screen?.orientation as LockableOrientation | undefined
    if (fullscreen) await o?.lock?.('landscape')
    else o?.unlock?.()
  } catch {
    /* no orientation control here: playback is unaffected */
  }
}

/** iPhone and iPad, including an iPad that reports itself as a Mac. */
function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

interface Props {
  url: string | null
  title: string
  courseId: string
  /** True only while the video is actually playing (not paused, buffering or ended). Gates the lesson clock. */
  onPlayingChange: (playing: boolean) => void
  /** The video played to its end (at least once). */
  onEnded: () => void
}

/**
 * The video lesson's player: a chromeless stage (a native file, or a YouTube or
 * Vimeo embed driven over postMessage) with our own controls beneath it: play or
 * pause, a scrubber that seeks freely (forward included), volume, and full
 * screen. There is deliberately no speed control. It reports two facts to the
 * lesson page and decides nothing else: whether the video is playing right now
 * (the active-time clock only counts then) and whether it has reached its end
 * (completion needs both that and the minimum time; the server checks the time).
 */
export function VideoLesson({ url, title, courseId, onPlayingChange, onEnded }: Props) {
  const source = videoSource(url, import.meta.env.DEV)
  const [state, setState] = useState<PlaybackState>(INITIAL_PLAYBACK)
  const [attempt, setAttempt] = useState(0)
  const controls = useRef<PlaybackControls | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const onState = useCallback((patch: Partial<PlaybackState>) => setState((s) => ({ ...s, ...patch })), [setState])
  const register = useCallback((c: PlaybackControls | null) => {
    controls.current = c
  }, [])

  // Playing is reported at once, but a stop only after a second: a buffering blip must not
  // stop the lesson clock (every stop costs a quiet period before counting resumes).
  useEffect(() => {
    if (state.playing) {
      onPlayingChange(true)
      return
    }
    const t = window.setTimeout(() => onPlayingChange(false), 1000)
    return () => window.clearTimeout(t)
  }, [state.playing, onPlayingChange])
  useEffect(() => {
    if (state.ended) onEnded()
  }, [state.ended, onEnded])

  // Fullscreen (the custom overlay path): landscape on the way in, released on the way out,
  // driven by the event so Esc and the system back gesture are covered too. Best effort: the
  // lock throws where the API is missing, and must never touch playback.
  useEffect(() => {
    const change = () => {
      const on = document.fullscreenElement === frame.current
      setFullscreen(on)
      void orientate(on)
    }
    document.addEventListener('fullscreenchange', change)
    return () => {
      document.removeEventListener('fullscreenchange', change)
      void orientate(false)
    }
  }, [])

  // Android Back leaves fullscreen first, before anything navigates.
  useBackClosable(fullscreen, () => {
    if (document.fullscreenElement) void document.exitFullscreen()
  })

  if (!source) {
    return (
      <div className="lp-frame">
        <PlayerError
          heading={playerCopy.video.unavailable.heading}
          body={playerCopy.video.unavailable.body}
          action={{ kind: 'back', courseId }}
          testId="video-unavailable"
        />
      </div>
    )
  }

  if (state.failed) {
    return (
      <div className="lp-frame">
        <PlayerError
          heading={playerCopy.video.failed.heading}
          body={playerCopy.video.failed.body}
          action={{
            kind: 'retry',
            onRetry: () => {
              setState(INITIAL_PLAYBACK)
              setAttempt((n) => n + 1)
            },
          }}
          testId="video-failed"
        />
      </div>
    )
  }

  const embed = source.kind === 'embed' ? parseEmbed(source.url) : null
  const engineProps = { url: source.url, title, onState, register }
  const copy = playerCopy.video.controls
  // iOS Safari cannot lock orientation for a custom player, so a file there goes to the OS's own
  // player (`webkitEnterFullscreen`), which rotates by itself. An embed has no such path on iOS.
  const nativeOnly = isIOS() && source.kind === 'file'
  const canFullscreen = nativeOnly || document.fullscreenEnabled === true
  const togglePlay = () => (state.playing ? controls.current?.pause() : controls.current?.play())
  const replay = () => {
    controls.current?.seek(0)
    controls.current?.play()
  }
  const toggleFullscreen = () => {
    if (nativeOnly) controls.current?.nativeFullscreen?.()
    else if (document.fullscreenElement) void document.exitFullscreen()
    else void frame.current?.requestFullscreen()
  }
  const shownVolume = state.muted ? 0 : state.volume

  return (
    <div className="vp" ref={frame} data-testid="video-player" data-playing={state.playing ? 'true' : undefined}>
      <div className="vp-stage">
        {embed?.provider === 'youtube' ? (
          <YouTubeEngine key={attempt} {...engineProps} id={embed.id} />
        ) : embed?.provider === 'vimeo' ? (
          <VimeoEngine key={attempt} {...engineProps} id={embed.id} />
        ) : (
          <NativeEngine key={attempt} {...engineProps} />
        )}
        <button type="button" className="vp-tap kid-tap" onClick={togglePlay} aria-label={state.playing ? copy.pause : copy.play} data-testid="video-tap">
          {state.playing ? null : (
            <span className="vp-bigplay" aria-hidden="true">
              <Play className="size-9" fill="currentColor" strokeWidth={0} />
            </span>
          )}
        </button>
      </div>
      <div className="vp-controls" role="group" aria-label={copy.group}>
        <button type="button" className="vp-btn kid-tap" onClick={togglePlay} aria-label={state.playing ? copy.pause : copy.play} data-testid="video-play">
          {state.playing ? <Pause className="size-6" fill="currentColor" strokeWidth={0} /> : <Play className="size-6" fill="currentColor" strokeWidth={0} />}
        </button>
        <button type="button" className="vp-btn kid-tap" onClick={replay} aria-label={copy.replay} data-testid="video-replay">
          <RotateCcw className="size-6" strokeWidth={2.5} />
        </button>
        <span className="vp-time kid-num" data-testid="video-time">
          {playbackClock(state.current)}
          <span className="vp-time-total"> / {playbackClock(state.duration)}</span>
        </span>
        <input
          type="range"
          className="vp-range vp-seek"
          min={0}
          max={state.duration > 0 ? state.duration : 1}
          step={0.1}
          value={Math.min(state.current, state.duration > 0 ? state.duration : 1)}
          onChange={(e) => {
            const t = Number(e.target.value)
            setState((s) => ({ ...s, current: t }))
            controls.current?.seek(t)
          }}
          aria-label={copy.seek}
          aria-valuetext={`${playbackClock(state.current)} of ${playbackClock(state.duration)}`}
          data-testid="video-seek"
        />
        <button
          type="button"
          className="vp-btn kid-tap"
          onClick={() => controls.current?.setMuted(!(state.muted || state.volume === 0))}
          aria-label={state.muted || state.volume === 0 ? copy.unmute : copy.mute}
          data-testid="video-mute"
        >
          {state.muted || state.volume === 0 ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
        </button>
        <input
          type="range"
          className="vp-range vp-volume"
          min={0}
          max={1}
          step={0.05}
          value={shownVolume}
          onChange={(e) => controls.current?.setVolume(Number(e.target.value))}
          aria-label={copy.volume}
          data-testid="video-volume"
        />
        {canFullscreen ? (
          <button type="button" className="vp-btn kid-tap" onClick={toggleFullscreen} aria-label={fullscreen ? copy.exitFullscreen : copy.fullscreen} data-testid="video-fullscreen">
            {fullscreen ? <Minimize className="size-6" /> : <Maximize className="size-6" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}
