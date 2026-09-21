import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Opens the current lesson (first in-progress, else first available). */
export function ContinueButton({
  courseId,
  lessonId,
  className,
}: {
  courseId: string
  lessonId: string
  className?: string
}) {
  return (
    <Link
      to="/courses/$courseId/lessons/$lessonId"
      params={{ courseId, lessonId }}
      className={cn('candy-btn kid-tap', className)}
    >
      Continue
      <ArrowRight className="size-5" aria-hidden />
    </Link>
  )
}
