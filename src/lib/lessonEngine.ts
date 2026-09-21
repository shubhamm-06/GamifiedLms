import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

/**
 * Thin typed wrappers around the four student-facing lesson-engine functions
 * (migration 017): `fn_lesson_heartbeat`, `fn_complete_lesson`,
 * `fn_submit_quiz`, `fn_course_lesson_states`. They are the ONLY way a student's
 * browser changes lesson progress, quiz attempts or XP — those tables have no
 * client write path (`rules.md`). Every rule (enrollment, unlock order, minimum
 * time, pass mark, XP once) is enforced in the database; this file only calls
 * and translates. Nothing here decides anything.
 */

type Fns = Database['public']['Functions']

/**
 * The stable codes the functions raise (as both the error message and hint),
 * plus two the client adds. `internal_error` is the database's catch-all for
 * something unexpected (the detail is in the Postgres log, not the response).
 */
export type LessonEngineErrorCode =
  | 'not_enrolled' // no session, trashed user, or no active enrollment in the lesson's course
  | 'locked' // an earlier lesson in the course order is not completed yet
  | 'too_early' // active time on the lesson is below its minimum time
  | 'quiz_not_passed' // a quiz lesson has no passed attempt yet
  | 'lesson_unavailable' // missing, trashed, unpublished, in a draft/trashed course, wrong type, or no questions
  | 'invalid_answers' // quiz answers don't match the lesson's questions/options
  | 'internal_error'
  | 'network' // client-side: the request never got an answer
  | 'unknown' // anything else (e.g. an expired session)

const SERVER_CODES: ReadonlySet<string> = new Set<LessonEngineErrorCode>([
  'not_enrolled',
  'locked',
  'too_early',
  'quiz_not_passed',
  'lesson_unavailable',
  'invalid_answers',
  'internal_error',
])

/** Codes worth retrying automatically: the request may simply not have arrived. */
const RETRYABLE: ReadonlySet<LessonEngineErrorCode> = new Set<LessonEngineErrorCode>([
  'network',
  'internal_error',
])

export class LessonEngineError extends Error {
  readonly code: LessonEngineErrorCode
  constructor(code: LessonEngineErrorCode, message?: string) {
    super(message ?? describeEngineError(code))
    this.name = 'LessonEngineError'
    this.code = code
  }
  get retryable() {
    return RETRYABLE.has(this.code)
  }
}

export function isRetryableEngineError(error: unknown): boolean {
  return error instanceof LessonEngineError && error.retryable
}

/** Plain-English fallback text for a code. A screen may of course say it its own way. */
export function describeEngineError(code: LessonEngineErrorCode): string {
  switch (code) {
    case 'not_enrolled':
      return "You're not enrolled in this course."
    case 'locked':
      return 'Finish the earlier lessons first.'
    case 'too_early':
      return "You haven't spent enough time on this lesson yet."
    case 'quiz_not_passed':
      return "You haven't passed this quiz yet."
    case 'lesson_unavailable':
      return "This lesson isn't available."
    case 'invalid_answers':
      return "Those answers don't match this quiz."
    case 'network':
      return "Couldn't reach the server. Check your connection and try again."
    case 'internal_error':
      return 'Something went wrong on our side. Please try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

interface RpcError {
  message?: string | null
  hint?: string | null
  code?: string | null
}

/** Maps any PostgREST-style error (an RPC or a table read) to a LessonEngineError. */
export function toEngineError(error: RpcError): LessonEngineError {
  const hint = error.hint ?? ''
  const message = error.message ?? ''
  if (SERVER_CODES.has(hint)) return new LessonEngineError(hint as LessonEngineErrorCode)
  if (SERVER_CODES.has(message)) return new LessonEngineError(message as LessonEngineErrorCode)
  // supabase-js reports a request that never completed as a message like
  // "TypeError: Failed to fetch" with no Postgres code.
  if (!error.code && /fetch|network|timeout|abort/i.test(message)) return new LessonEngineError('network')
  return new LessonEngineError('unknown', message || undefined)
}

function firstRow<T>(data: T[] | null): T {
  const row = data?.[0]
  if (!row) throw new LessonEngineError('internal_error')
  return row
}

// ---------------------------------------------------------------- heartbeat

/**
 * How the server counts time, so a caller can pace itself. A beat adds
 * `min(whole seconds since the previous beat, 15)`; the FIRST beat, or a beat
 * more than 30 s after the previous one (app backgrounded, screen locked,
 * connection dropped), adds nothing — it only restarts the clock. So call once
 * when a lesson opens, then about every `HEARTBEAT_INTERVAL_MS` while the
 * lesson is actually in the foreground, and stop while it isn't. Whole seconds
 * only are credited, so beating faster than this earns no more time.
 */
export const HEARTBEAT_INTERVAL_MS = 12_000

/**
 * The server credits a beat only if it arrives within 30 s of the previous one
 * (and at most 15 s of it). A client that was away (backgrounded, offline) must
 * therefore not send its first beat back until this long after its last beat, or
 * the server would credit up to 15 s for the time it was away. Slightly over 30 s
 * to allow for network latency.
 */
export const HEARTBEAT_RESUME_QUIET_MS = 32_000

export interface LessonHeartbeat {
  activeSeconds: number
  minTimeSeconds: number
  timeMet: boolean
  /** True when the lesson was already completed (nothing is recorded then). */
  completed: boolean
}

export async function heartbeatLesson(lessonId: string): Promise<LessonHeartbeat> {
  const { data, error } = await supabase.rpc('fn_lesson_heartbeat', { p_lesson_id: lessonId })
  if (error) throw toEngineError(error)
  const r = firstRow(data)
  return {
    activeSeconds: r.active_seconds,
    minTimeSeconds: r.min_time_seconds,
    timeMet: r.time_met,
    completed: r.completed,
  }
}

// ----------------------------------------------------------------- complete

export interface LessonCompletion {
  completed: true
  /** True when the lesson was already completed: success, but no XP this time. */
  alreadyCompleted: boolean
  completedAt: string | null
  /** XP awarded by THIS call (0 on a replay, or when the course has gamification off). */
  xpAwarded: number
}

/** Safe to retry: a second call after success returns `alreadyCompleted` with 0 XP. */
export async function completeLesson(lessonId: string): Promise<LessonCompletion> {
  const { data, error } = await supabase.rpc('fn_complete_lesson', { p_lesson_id: lessonId })
  if (error) throw toEngineError(error)
  const r = firstRow(data)
  return {
    completed: true,
    alreadyCompleted: r.already_completed,
    completedAt: r.completed_at ?? null,
    xpAwarded: r.xp_awarded,
  }
}

// --------------------------------------------------------------------- quiz

/** `{ [question id]: chosen option id }` — one entry for EVERY question of the lesson. */
export type QuizAnswers = Record<string, string>

export interface QuizQuestionResult {
  questionId: string
  correct: boolean
  /**
   * The admin's explanation for this question, sent only inside a graded result
   * and only once migration 020 (section A) is applied. Null when none was
   * written, and always null until then. The correct option is never sent.
   */
  explanation: string | null
}

/**
 * The server tells you which questions were right or wrong (and, after
 * migration 020, each question's explanation) and never sends the correct option.
 */
export interface QuizResult {
  score: number
  maxScore: number
  /** Whole percent, rounded down. */
  percentage: number
  passed: boolean
  /** One entry per question, in question order. */
  results: QuizQuestionResult[]
  /** True when this attempt completed the lesson (or it was already completed). */
  completed: boolean
  /** Whether the lesson's minimum time is met. Passed but not time-met means: keep going, then `completeLesson`. */
  timeMet: boolean
  xpAwarded: number
}

function parseQuizResults(value: unknown): QuizQuestionResult[] {
  if (!Array.isArray(value)) throw new LessonEngineError('internal_error')
  return value.map((item) => {
    const o = item as { question_id?: unknown; correct?: unknown; explanation?: unknown }
    if (typeof o?.question_id !== 'string' || typeof o.correct !== 'boolean') {
      throw new LessonEngineError('internal_error')
    }
    const explanation = typeof o.explanation === 'string' && o.explanation.trim() ? o.explanation : null
    return { questionId: o.question_id, correct: o.correct, explanation }
  })
}

/** Every call records an attempt; retries are unlimited. */
export async function submitQuiz(lessonId: string, answers: QuizAnswers): Promise<QuizResult> {
  const { data, error } = await supabase.rpc('fn_submit_quiz', {
    p_lesson_id: lessonId,
    p_answers: answers,
  })
  if (error) throw toEngineError(error)
  const r = firstRow(data)
  return {
    score: r.score,
    maxScore: r.max_score,
    percentage: r.percentage,
    passed: r.passed,
    results: parseQuizResults(r.results),
    completed: r.completed,
    timeMet: r.time_met,
    xpAwarded: r.xp_awarded,
  }
}

// ------------------------------------------------------------------- states

export type LessonState = 'locked' | 'available' | 'in_progress' | 'completed'

export interface LessonStateRow {
  lessonId: string
  /** Null for a lesson that isn't inside a topic. */
  moduleId: string | null
  state: LessonState
  activeSeconds: number
  minTimeSeconds: number
  completedAt: string | null
  /** 1-based position in the course order (topics by position, then ungrouped lessons). */
  sortIndex: number
}

type StatesRow = Fns['fn_course_lesson_states']['Returns'][number]

function toLessonState(value: string): LessonState {
  if (value === 'locked' || value === 'available' || value === 'in_progress' || value === 'completed') return value
  throw new LessonEngineError('internal_error')
}

/**
 * One row per live, published lesson in course order — the single source of
 * truth for what is locked. The generated types mark `module_id` and
 * `completed_at` as non-null (that is how Supabase types every RETURNS TABLE
 * column); they are null for ungrouped / not-yet-completed lessons, so this
 * maps them explicitly.
 */
export async function fetchCourseLessonStates(courseId: string): Promise<LessonStateRow[]> {
  const { data, error } = await supabase.rpc('fn_course_lesson_states', { p_course_id: courseId })
  if (error) throw toEngineError(error)
  return (data ?? []).map((r: StatesRow) => ({
    lessonId: r.lesson_id,
    moduleId: (r.module_id as string | null) ?? null,
    state: toLessonState(r.state),
    activeSeconds: r.active_seconds,
    minTimeSeconds: r.min_time_seconds,
    completedAt: (r.completed_at as string | null) ?? null,
    sortIndex: r.sort_index,
  }))
}
