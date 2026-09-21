import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

/** A quiet in-page message for content that can't be shown (a missing video, an empty quiz). */
export function LessonMessage({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="lp-message" role="status" data-testid={testId ?? 'lesson-message'}>
      <CircleAlert className="size-6 flex-none" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
