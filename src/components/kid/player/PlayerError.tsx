import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'

/**
 * The one inline pattern for content that can't be shown inside a lesson
 * (spec Part A7): an icon, a friendly headline, one sentence of help, and
 * either a Try again button (something failed and might work on retry) or a
 * Back to roadmap link (there is nothing here to retry). It fills whatever
 * frame it is placed in (the video/game 16:9 or tall frame, or the lesson
 * body), never a raw error code or stack trace.
 */
export function PlayerError({
  heading,
  body,
  icon,
  action,
  testId,
}: {
  heading: string
  body: string
  icon?: ReactNode
  action: { kind: 'retry'; onRetry: () => void } | { kind: 'back'; courseId: string } | null
  testId?: string
}) {
  return (
    <div className="lp-error" role="status" data-testid={testId}>
      <span className="lp-error-icon" aria-hidden="true">
        {icon ?? <CircleAlert className="size-7" />}
      </span>
      <p className="lp-error-heading">{heading}</p>
      <p className="lp-error-body">{body}</p>
      {action?.kind === 'retry' ? (
        <button type="button" className="candy-btn kid-tap" onClick={action.onRetry} data-testid={testId ? `${testId}-retry` : undefined}>
          Try again
        </button>
      ) : action?.kind === 'back' ? (
        <Link to="/courses/$courseId" params={{ courseId: action.courseId }} className="candy-btn-quiet kid-tap">
          Back to roadmap
        </Link>
      ) : null}
    </div>
  )
}
