/**
 * Shared types and small helpers for the video lesson's player. Three engines
 * (a native file, a YouTube embed, a Vimeo embed) each report the same
 * `PlaybackState` and register the same `PlaybackControls`, so the controls bar
 * and the lesson page never care which one is underneath.
 */

export interface PlaybackState {
  /** The engine can take commands (an embed is ready, or the file's metadata loaded). */
  ready: boolean
  /** Actually playing right now: not paused, not buffering, not ended. */
  playing: boolean
  /** The video reached its end at least once. Stays true if the child seeks back. */
  ended: boolean
  current: number
  duration: number
  /** 0 to 1. */
  volume: number
  muted: boolean
  /** The video cannot be loaded or played. */
  failed: boolean
}

export const INITIAL_PLAYBACK: PlaybackState = {
  ready: false,
  playing: false,
  ended: false,
  current: 0,
  duration: 0,
  volume: 1,
  muted: false,
  failed: false,
}

export interface PlaybackControls {
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
}

export interface EngineProps {
  url: string
  title: string
  onState: (patch: Partial<PlaybackState>) => void
  register: (controls: PlaybackControls | null) => void
}

export type EmbedRef = { provider: 'youtube' | 'vimeo'; id: string }

/** The provider and video id of a normalized embed URL (`lib/video.ts`), or null for anything else. */
export function parseEmbed(url: string): EmbedRef | null {
  const yt = url.match(/^https:\/\/www\.youtube\.com\/embed\/([\w-]{11})$/)
  if (yt) return { provider: 'youtube', id: yt[1] }
  const vm = url.match(/^https:\/\/player\.vimeo\.com\/video\/(\d+)$/)
  if (vm) return { provider: 'vimeo', id: vm[1] }
  return null
}

/** "1:05", "12:30". Whole seconds, rounded down; never negative or NaN. */
export function playbackClock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
