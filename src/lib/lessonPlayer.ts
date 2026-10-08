import type { LessonStateRow } from '@/lib/lessonEngine'
import { formatClock } from '@/lib/lessonSettings'

/**
 * Pure helpers for the lesson player. No I/O and no decisions about completion,
 * XP or unlocking: the server decides those (rules.md); this only prepares what
 * is shown.
 */

type PlayerLessonType = 'video' | 'text' | 'quiz' | 'game'

/** play: earning; replay: opened already completed; done: completed this visit. */
export type PlayerMode = 'play' | 'replay' | 'done'

export interface LessonContent {
  id: string
  courseId: string
  title: string
  summary: string | null
  type: PlayerLessonType
  videoUrl: string | null
  contentHtml: string | null
  gameId: string | null
  minTimeSeconds: number
  /** NULL for every non-quiz lesson (migration 028) — a quiz lesson always has a value. */
  passPercentage: number | null
  /** Effective XP from `lesson_effective_xp`; null when unknown. */
  xp: number | null
  gamificationEnabled: boolean
}

export interface GameInfo {
  id: string
  title: string
  bundleUrl: string
  /** `games.bundle_version`: the key the stored copy of the entry page is valid for. */
  bundleVersion: string
  orientation: 'portrait' | 'landscape' | 'any'
}

interface QuizOptionView {
  id: string
  text: string
}

export interface QuizQuestionView {
  id: string
  prompt: string
  options: QuizOptionView[]
}

export function asPlayerType(value: string): PlayerLessonType {
  return value === 'video' || value === 'quiz' || value === 'game' ? value : 'text'
}

/**
 * Options are stored as `{ id, text }` objects (a bare string is tolerated and
 * is its own id), the same shapes `fn_submit_quiz` accepts. Anything that is not
 * an array or has no usable text is dropped.
 */
export function parseQuizOptions(value: unknown): QuizOptionView[] {
  if (!Array.isArray(value)) return []
  const out: QuizOptionView[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ id: item, text: item })
    } else if (item && typeof item === 'object') {
      const o = item as { id?: unknown; text?: unknown }
      if (typeof o.id === 'string' && typeof o.text === 'string' && o.text.trim()) {
        out.push({ id: o.id, text: o.text })
      }
    }
  }
  return out
}

/**
 * A URL the player is willing to load in a frame or a video tag: https only
 * (http only in `dev`, so a local test page works). Everything else, including
 * `javascript:` and `data:`, is refused and the lesson shows a friendly message.
 */
export function safeMediaUrl(url: string | null | undefined, allowHttp = false): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    if (u.protocol === 'https:' || (allowHttp && u.protocol === 'http:')) return u.toString()
  } catch {
    /* not a URL */
  }
  return null
}

/** The lesson right after this one in course order, if it is open (not locked). */
export function nextOpenLesson(states: LessonStateRow[], lessonId: string): LessonStateRow | null {
  const current = states.find((s) => s.lessonId === lessonId)
  if (!current) return null
  const next = states.find((s) => s.sortIndex === current.sortIndex + 1)
  return next && next.state !== 'locked' ? next : null
}

/** "1:05" for the ring and helper text. */
export const clockText = formatClock

/** Spoken form for assistive tech: "1 minute 5 seconds". */
export function spokenDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  if (s > 0 || parts.length === 0) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`)
  return parts.join(' ')
}

export interface DocTheme {
  ink: string
  cream: string
  surface: string
  teal: string
  fontFamily: string
}

/**
 * The document a `text` lesson is shown in. It runs inside a sandboxed frame
 * (no scripts), and this adds a second layer: a Content-Security-Policy that
 * forbids scripts and connections altogether and only allows https images,
 * media and inline styles. The admin's HTML is placed in the body untouched.
 * Colours come from the caller (read from the root CSS tokens at run time), so
 * nothing here hardcodes a palette.
 */
export function buildDocSrcDoc(html: string, theme: DocTheme): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline'; font-src https: data:">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html,body{margin:0;padding:0;background:${theme.surface};color:${theme.ink};}
body{padding:20px;font-family:${theme.fontFamily};font-size:18px;line-height:1.56;overflow-wrap:anywhere;}
h1,h2,h3,h4{line-height:1.25;margin:1em 0 .4em;}
h1{font-size:1.5em}h2{font-size:1.3em}h3{font-size:1.15em}
p,ul,ol,blockquote{margin:.7em 0}
img,video,iframe,table{max-width:100%;height:auto}
a{color:${theme.teal};font-weight:700}
blockquote{border-left:4px solid ${theme.cream};padding-left:12px;margin-left:0}
</style></head><body>${html}</body></html>`
}
