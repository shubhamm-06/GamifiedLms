import { cn } from '@/lib/utils'
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
        'inline-flex rounded-full border border-current/25 px-2 py-0.5 text-xs font-medium',
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
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        LESSON_STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  )
}
