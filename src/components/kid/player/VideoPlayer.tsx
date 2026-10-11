import { useEffect, useRef, useState, type RefObject } from 'react'
import { useBackClosable } from '@/hooks/useBackClosable'
import { useKeepAwake } from '@/hooks/useKeepAwake'
import type { VideoSource } from '@/lib/video'
import { playerCopy } from '@/lib/playerCopy'

export interface VideoEvents {
  /** True while the video is actually playing (not paused, buffering or ended). */
  onPlayingChange?: (playing: boolean) => void
  /** The video played to its end. */
  onEnded?: () => void
  /** The video's length in seconds, once the player knows it. */
  onDuration?: (seconds: number) => void
}

const YT_ORIGIN = 'https://www.youtube-nocookie.com'
const VM_ORIGIN = 'https://player.vimeo.com'

/**
 * Standard players only: the browser's own <video controls> for a file, the
 * provider's own player in an iframe for an embed. We never draw controls, never
 * overlay the video and never pass parameters that restyle the provider's UI.
 * For YouTube and Vimeo the player's postMessage API (the protocol their official
 * JS libraries use) is only listened to, to learn play / pause / end; nothing is
 * ever sent that changes playback. Loom and Wistia report nothing here.
 *
 * `source` must come from `parseVideoSource`; `null` (an empty, unsupported or
 * unsafe value) shows the friendly unavailable state inside the same frame.
 */
/** The container clamps to this range so a very wide or very tall clip never makes
 * the frame itself absurdly short or tall — ui.md "Lesson pages redesign" follow-up. */
const MIN_RATIO = 4 / 3
const MAX_RATIO = 16 / 9

export function VideoPlayer({ source, title, ...events }: { source: VideoSource | null; title: string } & VideoEvents) {
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  // null until loadedmetadata: the container stays 16:9 (aspect-video) so nothing jumps.
  const [frame, setFrame] = useState<{ ratio: number; narrow: boolean } | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const ref = useRef(events)
  useEffect(() => {
    ref.current = events
  })

  const report = (p: boolean) => {
    setPlaying(p)
    ref.current.onPlayingChange?.(p)
  }
  const ended = () => {
    report(false)
    ref.current.onEnded?.()
  }

  // The screen stays on only while the video is actually playing.
  useKeepAwake(playing)
  useFullscreenBack()
  useEmbedEvents(frameRef, source, report, ended, (s) => ref.current.onDuration?.(s))

  let body
  if (!source || failed) {
    body = (
      <div className="flex size-full items-center justify-center p-6 text-center" data-testid="video-unavailable">
        <p className="text-lg font-bold text-white">{playerCopy.video.unavailable}</p>
      </div>
    )
  } else if (source.provider === 'file') {
    body = (
      <video
        // Narrow (portrait/square) source: cropping to fill would cut the picture too
        // much, so it keeps the whole frame visible (contain) on an ink letterbox
        // instead. Every other clip fills the rounded container completely (cover) —
        // the container's own aspect ratio already matches the clip, clamped to
        // 4:3-16:9, so this almost never actually crops a meaningful part of the frame.
        className={frame?.narrow ? 'size-full bg-ink object-contain' : 'size-full object-cover'}
        src={source.url}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        data-testid="video-file"
        onPlaying={() => report(true)}
        onPause={() => report(false)}
        onWaiting={() => report(false)}
        onEnded={ended}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          ref.current.onDuration?.(v.duration)
          if (v.videoWidth > 0 && v.videoHeight > 0) {
            const natural = v.videoWidth / v.videoHeight
            setFrame({ ratio: Math.min(MAX_RATIO, Math.max(MIN_RATIO, natural)), narrow: natural < MIN_RATIO })
          }
        }}
        onError={() => setFailed(true)}
      />
    )
  } else {
    body = (
      <iframe
        ref={frameRef}
        className="size-full border-0"
        src={embedSrc(source)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        data-testid="video-embed"
        data-provider={source.provider}
      />
    )
  }

  // Embeds (iframe) keep a fixed 16:9 frame always — only a file's own <video> adapts
  // to the clip's natural ratio, since that is the only case we control the pixels in.
  const ratio = source?.provider === 'file' && frame ? frame.ratio : 16 / 9
  return (
    <div
      className="w-full overflow-hidden rounded-[26px] bg-black shadow-[var(--kid-shadow)]"
      style={{ aspectRatio: ratio }}
      data-testid="video-player"
      data-frame-narrow={frame?.narrow ? 'true' : undefined}
    >
      {body}
    </div>
  )
}

/** The iframe URL: the stored embed URL plus, for YouTube, only what its event API needs. */
function embedSrc(source: VideoSource): string {
  if (source.provider !== 'youtube') return source.url
  const params = new URLSearchParams({ enablejsapi: '1', origin: window.location.origin })
  return `${source.url}?${params}`
}

/** Listen (never command) to a YouTube or Vimeo embed's postMessage events. */
function useEmbedEvents(
  frameRef: RefObject<HTMLIFrameElement | null>,
  source: VideoSource | null,
  onPlaying: (playing: boolean) => void,
  onEnded: () => void,
  onDuration: (seconds: number) => void,
) {
  const cb = useRef({ onPlaying, onEnded, onDuration })
  useEffect(() => {
    cb.current = { onPlaying, onEnded, onDuration }
  })
  const provider = source?.provider
  const url = source?.url

  useEffect(() => {
    if (provider !== 'youtube' && provider !== 'vimeo') return
    const origin = provider === 'youtube' ? YT_ORIGIN : VM_ORIGIN
    const frame = () => frameRef.current?.contentWindow ?? null
    const post = (msg: object) => frame()?.postMessage(JSON.stringify(msg), origin)

    // Ask the player to send its events. YouTube needs the "listening" handshake, repeated
    // until it answers. Vimeo announces "ready" by itself, and then takes one
    // addEventListener per event (re-sent on every "ready", e.g. after a reload).
    let answered = false
    const listenYouTube = () => post({ event: 'listening', id: 1, channel: 'widget' })
    const subscribeVimeo = () => {
      for (const value of ['play', 'playing', 'pause', 'ended', 'bufferstart', 'bufferend']) post({ method: 'addEventListener', value })
      post({ method: 'getDuration' })
    }
    const timer =
      provider === 'youtube' ? window.setInterval(() => (answered ? window.clearInterval(timer) : listenYouTube()), 500) : undefined

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame()) return
      let msg: { event?: string; info?: unknown; method?: string; value?: unknown }
      try {
        msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      answered = true
      if (provider === 'youtube') {
        const info = (msg.event === 'infoDelivery' || msg.event === 'initialDelivery' ? msg.info : null) as
          | { playerState?: number; duration?: number }
          | null
        const state = msg.event === 'onStateChange' ? (msg.info as number) : info?.playerState
        if (typeof info?.duration === 'number' && info.duration > 0) cb.current.onDuration(info.duration)
        if (state === 1) cb.current.onPlaying(true)
        else if (state === 0) cb.current.onEnded()
        else if (state === 2 || state === 3) cb.current.onPlaying(false)
      } else {
        if (msg.event === 'play' || msg.event === 'playing' || msg.event === 'bufferend') cb.current.onPlaying(true)
        else if (msg.event === 'pause' || msg.event === 'bufferstart') cb.current.onPlaying(false)
        else if (msg.event === 'ended') cb.current.onEnded()
        else if (msg.event === 'ready') subscribeVimeo()
        else if (msg.method === 'getDuration' && typeof msg.value === 'number') cb.current.onDuration(msg.value)
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [frameRef, provider, url])
}

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> }

/**
 * The player's own full screen (native controls or the provider's button): Android
 * Back leaves it first, and on a phone the screen turns sideways while it lasts.
 * Best effort: a browser without the API, or one that refuses the lock, stays as it was.
 */
function useFullscreenBack() {
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const change = () => {
      const on = !!document.fullscreenElement
      setFullscreen(on)
      const o = window.screen?.orientation as LockableOrientation | undefined
      try {
        if (on) void o?.lock?.('landscape').catch(() => undefined)
        else o?.unlock?.()
      } catch {
        /* no orientation control here */
      }
    }
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])
  useBackClosable(fullscreen, () => {
    if (document.fullscreenElement) void document.exitFullscreen()
  })
}
