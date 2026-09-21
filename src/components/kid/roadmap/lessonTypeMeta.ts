import { FileText, Gamepad2, ListChecks, Play, type LucideIcon } from 'lucide-react'
import type { LessonState } from '@/lib/lessonEngine'
import type { LessonType } from '@/lib/roadmap'

export const LESSON_TYPE_META: Record<LessonType, { label: string; Icon: LucideIcon }> = {
  video: { label: 'Video', Icon: Play },
  game: { label: 'Game', Icon: Gamepad2 },
  quiz: { label: 'Quiz', Icon: ListChecks },
  text: { label: 'Reading', Icon: FileText },
}

/** Words for a state, for screen readers and the sheet — a state is never colour alone. */
export const STATE_WORD: Record<LessonState, string> = {
  locked: 'locked',
  available: 'ready to start',
  in_progress: 'in progress',
  completed: 'completed',
}
