import { useEffect, useRef } from 'react'
import type { EngineProps } from '@/lib/videoPlayback'

/**
 * The three things that can sit under the controls bar. Each renders its
 * element filling the stage, reports `PlaybackState` patches and registers its
 * `PlaybackControls`. Embeds are driven over `postMessage` (no third-party
 * script is loaded): YouTube's `listening` handshake and Vimeo's
 * `addEventListener`. The iframes have `pointer-events: none` (CSS) so the
 * provider's own controls can never be tapped; ours are the only ones.
 */

/** A plain https video file (the dev/test path; production lessons are embeds). */
export function NativeEngine({ url, title, onState, register }: EngineProps) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    register({
      play: () => void v.play().catch(() => undefined),
      pause: () => v.pause(),
      seek: (t) => {
        v.currentTime = t
      },
      setVolume: (x) => {
        v.volume = x
        v.muted = false
      },
      setMuted: (m) => {
        v.muted = m
      },
    })
    return () => register(null)
  }, [register])

  return (
    <video
      ref={ref}
      className="vp-media"
      playsInline
      preload="metadata"
      src={url}
      aria-label={title}
      data-testid="video-file"
      onLoadedMetadata={(e) => onState({ ready: true, duration: e.currentTarget.duration })}
      onDurationChange={(e) => onState({ duration: e.currentTarget.duration })}
      onPlaying={() => onState({ playing: true })}
      onPlay={() => onState({ playing: true })}
      onPause={() => onState({ playing: false })}
      onWaiting={() => onState({ playing: false })}
      onEnded={() => onState({ playing: false, ended: true })}
      onTimeUpdate={(e) => onState({ current: e.currentTarget.currentTime })}
      onVolumeChange={(e) => onState({ volume: e.currentTarget.volume, muted: e.currentTarget.muted })}
      onError={() => onState({ failed: true, playing: false })}
    />
  )
}

const YT_ORIGIN = 'https://www.youtube.com'

/** A YouTube embed, chromeless (`controls=0`), driven through its postMessage API. */
export function YouTubeEngine({ id, title, onState, register }: EngineProps & { id: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const pendingPlay = useRef(false)
  const readyRef = useRef(false)

  useEffect(() => {
    const send = (func: string, args: unknown[] = []) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), YT_ORIGIN)

    register({
      play: () => (readyRef.current ? send('playVideo') : (pendingPlay.current = true)),
      pause: () => {
        pendingPlay.current = false
        send('pauseVideo')
      },
      seek: (t) => send('seekTo', [t, true]),
      setVolume: (x) => {
        send('setVolume', [Math.round(x * 100)])
        send('unMute')
      },
      setMuted: (m) => send(m ? 'mute' : 'unMute'),
    })

    // The player only starts sending state once it has been told we are listening.
    const listen = () =>
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT_ORIGIN)
    const retry = window.setInterval(() => (readyRef.current ? window.clearInterval(retry) : listen()), 400)

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      let msg: { event?: string; info?: Record<string, unknown> | number }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.event === 'onReady' || msg.event === 'initialDelivery') {
        if (!readyRef.current) {
          readyRef.current = true
          onState({ ready: true })
          if (pendingPlay.current) {
            pendingPlay.current = false
            send('playVideo')
          }
        }
      }
      if (msg.event === 'onError') onState({ failed: true, playing: false })
      const info = msg.event === 'infoDelivery' || msg.event === 'initialDelivery' ? (msg.info as Record<string, unknown> | undefined) : undefined
      const state = msg.event === 'onStateChange' ? (msg.info as number) : (info?.playerState as number | undefined)
      const patch: Parameters<typeof onState>[0] = {}
      if (info) {
        if (typeof info.currentTime === 'number') patch.current = info.currentTime
        if (typeof info.duration === 'number' && info.duration > 0) patch.duration = info.duration
        if (typeof info.volume === 'number') patch.volume = info.volume / 100
        if (typeof info.muted === 'boolean') patch.muted = info.muted
      }
      if (typeof state === 'number') {
        patch.playing = state === 1
        if (state === 0) patch.ended = true
      }
      if (Object.keys(patch).length) onState(patch)
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(retry)
      register(null)
    }
  }, [register, onState])

  const params = new URLSearchParams({
    enablejsapi: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    iv_load_policy: '3',
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
    origin: window.location.origin,
  })
  return (
    <iframe
      ref={frame}
      className="vp-media"
      src={`${YT_ORIGIN}/embed/${id}?${params}`}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      data-testid="video-embed"
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT_ORIGIN)
      }
    />
  )
}

const VM_ORIGIN = 'https://player.vimeo.com'
const VM_EVENTS = ['play', 'playing', 'pause', 'ended', 'timeupdate', 'volumechange', 'bufferstart', 'error', 'loaded']

/** A Vimeo embed, driven through its postMessage API. `controls=0` hides its own controls where the plan allows. */
export function VimeoEngine({ id, title, onState, register }: EngineProps & { id: string }) {
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const send = (method: string, value?: unknown) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), VM_ORIGIN)

    register({
      play: () => send('play'),
      pause: () => send('pause'),
      seek: (t) => send('setCurrentTime', t),
      setVolume: (x) => {
        send('setVolume', x)
        onState({ volume: x, muted: false })
      },
      setMuted: (m) => {
        send('setVolume', m ? 0 : 1)
        onState({ muted: m, ...(m ? {} : { volume: 1 }) })
      },
    })

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== VM_ORIGIN || e.source !== frame.current?.contentWindow) return
      let msg: { event?: string; data?: { seconds?: number; duration?: number } }
      try {
        msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      switch (msg.event) {
        case 'ready':
        case 'loaded':
          onState({ ready: true })
          break
        case 'play':
        case 'playing':
          onState({ ready: true, playing: true })
          break
        case 'pause':
        case 'bufferstart':
          onState({ playing: false })
          break
        case 'ended':
          onState({ playing: false, ended: true })
          break
        case 'error':
          onState({ failed: true, playing: false })
          break
        case 'timeupdate':
          onState({
            ready: true,
            ...(typeof msg.data?.seconds === 'number' ? { current: msg.data.seconds } : {}),
            ...(typeof msg.data?.duration === 'number' ? { duration: msg.data.duration } : {}),
          })
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      register(null)
    }
  }, [register, onState])

  const params = new URLSearchParams({ api: '1', controls: '0', title: '0', byline: '0', portrait: '0', playsinline: '1' })
  return (
    <iframe
      ref={frame}
      className="vp-media"
      src={`${VM_ORIGIN}/video/${id}?${params}`}
      title={title}
      allow="autoplay; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      data-testid="video-embed"
      onLoad={() => {
        for (const value of VM_EVENTS) {
          frame.current?.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value }), VM_ORIGIN)
        }
      }}
    />
  )
}
