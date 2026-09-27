/**
 * Admin-configurable lesson and game settings (migration 015). `min_time_seconds`
 * is still stored-only. `pass_percentage` is enforced server-side by
 * `fn_submit_quiz` (migration 017) and is now quiz-only (migration 028):
 * NULL for every non-quiz lesson, required for a quiz one — see `schema.md`.
 */

/** Mirrors `lessons_min_time_seconds_check`. */
export const MIN_TIME_MAX_SECONDS = 3600
/** Mirrors the `min_time_seconds` column default (still a real column default; `pass_percentage` no longer has one — see below). */
export const DEFAULT_MIN_TIME_SECONDS = 90
/**
 * What a new (or never-set) quiz lesson's pass mark starts at. Migration 028
 * dropped the column's own `DEFAULT 60`, since that default used to apply to
 * every lesson type, not just quizzes — this is now purely a client-side
 * pre-fill for the form, applied only while the lesson is a quiz.
 */
export const DEFAULT_PASS_PERCENTAGE = 70

export const GAME_ORIENTATIONS = [
  { value: 'any', label: 'Any' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
] as const

export type GameOrientation = (typeof GAME_ORIENTATIONS)[number]['value']

/** Quick picks for the minimum-time field. 0 is "Off". */
export const MIN_TIME_CHIPS = [
  { label: 'Off', seconds: 0 },
  { label: '30s', seconds: 30 },
  { label: '1 min', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
] as const

/**
 * What a new lesson's minimum time starts at: quizzes have no timer, every
 * other type (video, game, and text — which the spec left unstated) starts at
 * the column default.
 */
export function defaultMinTimeFor(contentType: string): number {
  return contentType === 'quiz' ? 0 : DEFAULT_MIN_TIME_SECONDS
}

/** `90` → `1:30`, `30` → `0:30`, `3600` → `60:00`. */
export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** A form string that must be a whole number (an optional sign is tolerated only so it can be range-checked). */
const WHOLE_NUMBER = /^-?\d+$/

/** Returns a readable message for a bad value, or null. Same range as the DB check. */
export function validateMinTime(text: string): string | null {
  const value = text.trim()
  if (value === '') return 'Enter the minimum time in seconds (0 for none).'
  if (!WHOLE_NUMBER.test(value)) return 'Enter a whole number of seconds.'
  const n = Number(value)
  if (n < 0 || n > MIN_TIME_MAX_SECONDS) {
    return `Must be between 0 and ${MIN_TIME_MAX_SECONDS} seconds.`
  }
  return null
}

/** Same range as `lessons_pass_percentage_check` (only called for a quiz lesson — see `lessons_pass_percentage_quiz_only_check`). */
export function validatePassPercentage(text: string): string | null {
  const value = text.trim()
  if (value === '') return 'Enter a pass mark from 0 to 100.'
  if (!WHOLE_NUMBER.test(value)) return 'Enter a whole percent, like 70.'
  const n = Number(value)
  if (n < 0 || n > 100) return 'Must be between 0 and 100.'
  return null
}

/** The XP override is optional; when given it must be a whole number, 0 or more. */
export function validateXpOverride(text: string): string | null {
  const value = text.trim()
  if (value === '') return null
  if (!/^\d+$/.test(value)) return 'Enter a whole number, 0 or more — or leave it blank.'
  return null
}

/**
 * The XP a lesson will actually award, mirroring `fn_award_lesson_xp` /
 * the `lesson_effective_xp` view: the lesson's own value when set, otherwise the
 * course default — and nothing at all when the course has gamification off or
 * the amount is 0.
 */
export function describeEffectiveXp(
  override: string,
  course: { default_lesson_xp: number; gamification_enabled: boolean },
): string {
  if (!course.gamification_enabled) {
    return 'Effective: none — gamification is off for this course.'
  }
  const trimmed = override.trim()
  const amount = trimmed === '' ? course.default_lesson_xp : /^\d+$/.test(trimmed) ? Number(trimmed) : null
  if (amount === null) return ''
  return amount > 0 ? `Effective: ${amount} XP.` : 'Effective: no XP.'
}
