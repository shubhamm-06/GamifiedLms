import { useEffect, useRef, useState } from 'react'
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_RESUME_QUIET_MS,
  LessonEngineError,
  heartbeatLesson,
  type LessonEngineErrorCode,
  type LessonHeartbeat,
} from '@/lib/lessonEngine'

/**
 * Why the clock is not running right now.
 * - `hidden`: the tab or app is in the background.
 * - `offline`: the device has no connection.
 * - `resuming`: back in the foreground, waiting out the quiet period (below).
 * - `connection`: a beat failed and is being retried.
 */
export type ClockPause = 'hidden' | 'offline' | 'resuming' | 'connection'

const FATAL: ReadonlySet<LessonEngineErrorCode> = new Set<LessonEngineErrorCode>([
  'locked',
  'not_enrolled',
  'lesson_unavailable',
])

export interface LessonClock {
  /** Active seconds as the SERVER last reported them. The only value that ever counts. */
  serverSeconds: number
  /** serverSeconds plus a little local smoothing between beats; display only. */
  displaySeconds: number
  minTimeSeconds: number
  /** The server said the minimum time is met. Gates the Finish button (the server re-checks). */
  timeMet: boolean
  running: boolean
  pause: ClockPause | null
  /** The server refused the lesson (locked, not enrolled, unavailable): stop and route away. */
  fatal: LessonEngineErrorCode | null
  /** The server said the lesson was already completed (for example in another tab). */
  completedRemotely: boolean
}

interface Options {
  lessonId: string
  /** False in replay mode, on the done screen and while the lesson is not ready. */
  enabled: boolean
  initialSeconds: number
  minTimeSeconds: number
}

/**
 * The lesson's active-time clock. It sends a heartbeat when the lesson opens and
 * then every HEARTBEAT_INTERVAL_MS, but only while the page is visible, the device
 * is online and `enabled` is true; it stops on unmount and when the server says
 * the lesson is complete.
 *
 * The server counts a beat only if it arrives within 30 s of the previous one,
 * crediting at most the seconds since then (capped at 15). It cannot know whether
 * the child was looking, so this hook enforces "pauses while backgrounded" itself:
 * after a pause it waits until HEARTBEAT_RESUME_QUIET_MS after its last beat before
 * sending the next, so that beat lands past the server's 30 s window and credits 0
 * instead of crediting time spent away. (Queueing beats while offline would be
 * pointless: the server uses its own clock, so a late beat earns nothing.)
 *
 * Nothing here decides completion. `timeMet` and the seconds come from server
 * replies; the smoothed `displaySeconds` never reaches the minimum before the
 * server confirms it.
 */
export function useLessonClock({ lessonId, enabled, initialSeconds, minTimeSeconds }: Options): LessonClock {
  const [server, setServer] = useState({
    seconds: initialSeconds,
    min: minTimeSeconds,
    timeMet: initialSeconds >= minTimeSeconds,
  })
  const [pause, setPause] = useState<ClockPause | null>(null)
  const [running, setRunning] = useState(false)
  const [fatal, setFatal] = useState<LessonEngineErrorCode | null>(null)
  const [completedRemotely, setCompletedRemotely] = useState(false)
  const [display, setDisplay] = useState(initialSeconds)

  const serverRef = useRef(server)
  const runningRef = useRef(false)
  const arrivedAtRef = useRef(0)

  useEffect(() => {
    serverRef.current = server
  }, [server])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let timer: number | undefined
    let inFlight = false
    let failures = 0
    let lastSentAt = 0

    const clear = () => window.clearTimeout(timer)
    const visible = () => document.visibilityState === 'visible'
    const setRun = (v: boolean) => {
      runningRef.current = v
      setRunning(v)
    }
    const pauseFor = (reason: ClockPause) => {
      clear()
      setRun(false)
      setPause(reason)
    }

    /** Start or resume: apply the visibility and network gates, then the quiet period. */
    function start() {
      if (stopped) return
      if (!visible()) return pauseFor('hidden')
      if (!navigator.onLine) return pauseFor('offline')
      const quiet = lastSentAt ? Math.max(0, lastSentAt + HEARTBEAT_RESUME_QUIET_MS - Date.now()) : 0
      clear()
      if (quiet > 0) {
        setRun(false)
        setPause('resuming')
        timer = window.setTimeout(beat, quiet)
      } else {
        void beat()
      }
    }

    async function beat() {
      if (stopped || inFlight) return
      if (!visible() || !navigator.onLine) return start()
      inFlight = true
      const sentAt = Date.now()
      lastSentAt = sentAt // the request may reach the server even if the reply is lost
      let reply: LessonHeartbeat
      try {
        reply = await heartbeatLesson(lessonId)
      } catch (e) {
        inFlight = false
        if (stopped) return
        const code = e instanceof LessonEngineError ? e.code : 'unknown'
        failures += 1
        if (FATAL.has(code) || (code !== 'network' && failures > 4)) {
          stopped = true
          setRun(false)
          setFatal(FATAL.has(code) ? code : 'unknown')
          return
        }
        setRun(false)
        setPause('connection')
        timer = window.setTimeout(beat, Math.min(3000 * 2 ** (failures - 1), 15000))
        return
      }
      inFlight = false
      if (stopped) return
      failures = 0
      arrivedAtRef.current = Date.now()
      setServer({ seconds: reply.activeSeconds, min: reply.minTimeSeconds, timeMet: reply.timeMet })
      if (reply.completed) {
        stopped = true
        setRun(false)
        setPause(null)
        setCompletedRemotely(true)
        return
      }
      if (!visible() || !navigator.onLine) return start()
      setPause(null)
      setRun(true)
      timer = window.setTimeout(beat, Math.max(1000, HEARTBEAT_INTERVAL_MS - (Date.now() - sentAt)))
    }

    const onVisibility = () => (visible() ? start() : pauseFor('hidden'))
    const onHide = () => pauseFor('hidden')
    const onOffline = () => pauseFor('offline')
    const onOnline = () => start()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    start()

    return () => {
      stopped = true
      clear()
      runningRef.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [lessonId, enabled])

  // Display smoothing: between beats, show up to one interval of local time on top
  // of the last server value, but never reach the minimum before the server says so.
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      const s = serverRef.current
      const extra = runningRef.current ? Math.min((Date.now() - arrivedAtRef.current) / 1000, HEARTBEAT_INTERVAL_MS / 1000) : 0
      let d = Math.floor(s.seconds + extra)
      if (!s.timeMet && s.min > 0 && d >= s.min) d = s.min - 1
      setDisplay((prev) => (prev === d ? prev : d))
    }, 500)
    return () => window.clearInterval(id)
  }, [enabled])

  return {
    serverSeconds: server.seconds,
    displaySeconds: Math.max(display, enabled ? 0 : server.seconds),
    minTimeSeconds: server.min,
    timeMet: server.timeMet,
    running,
    pause,
    fatal,
    completedRemotely,
  }
}
