import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock } from '@/lib/lessonSettings'
import type { ContentType } from '@/hooks/admin/useCurriculum'

/**
 * One mapping, reused anywhere a content_type appears. All four brand accents
 * are used distinctly so the type is readable at a glance; status pills stay
 * gold/teal and are distinguished by position and wording.
 */
const CONTENT_TYPE_STYLES: Record<string, string> = {
  video: 'bg-teal/10 text-teal-d',
  text: 'bg-plum/10 text-plum-d',
  quiz: 'bg-gold/15 text-gold-d',
  game: 'bg-coral/10 text-coral-d',
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  text: 'Text',
  quiz: 'Quiz',
  game: 'Game',
}

export function ContentTypeBadge({ contentType }: { contentType: ContentType | string }) {
  return (
    <span
      className={cn(
        // Outlined, where status pills are solid: a quiz lesson in draft puts
        // gold next to gold, so the two badge families need to differ by more
        // than hue alone.
        'inline-flex shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        CONTENT_TYPE_STYLES[contentType] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {CONTENT_TYPE_LABEL[contentType] ?? contentType}
    </span>
  )
}

const LESSON_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gold/15 text-gold-d',
  published: 'bg-teal/10 text-teal-d',
}

export function LessonStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        LESSON_STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  )
}

const SETTING_CHIP =
  'text-muted-foreground bg-muted inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums'

/**
 * Compact readout of a lesson's stored settings on a curriculum row: a clock
 * and the minimum time ("1:30") when it is above 0, and "Pass 60%" for a quiz.
 * Purely informational spans — no handlers, so they can't interfere with the
 * drag handle or the selection checkbox beside them. `min_time_seconds` is
 * stored only (docs/rules.md); `pass_percentage` is enforced server-side by
 * `fn_submit_quiz` and, since migration 028, NULL for every non-quiz lesson —
 * the chip only ever renders for a quiz, where it is guaranteed a value.
 */
export function LessonSettingChips({
  lesson,
}: {
  lesson: { content_type: string; min_time_seconds: number; pass_percentage: number | null }
}) {
  const hasTime = lesson.min_time_seconds > 0
  const isQuiz = lesson.content_type === 'quiz' && lesson.pass_percentage != null
  if (!hasTime && !isQuiz) return null

  return (
    <>
      {hasTime ? (
        <span className={SETTING_CHIP} title={`Minimum time ${formatClock(lesson.min_time_seconds)}`}>
          <Clock className="size-3" aria-hidden />
          <span className="sr-only">Minimum time </span>
          {formatClock(lesson.min_time_seconds)}
        </span>
      ) : null}
      {isQuiz ? (
        <span className={SETTING_CHIP} title={`Pass mark ${lesson.pass_percentage}%`}>
          Pass {lesson.pass_percentage}%
        </span>
      ) : null}
    </>
  )
}
