import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LessonWidth = 'video' | 'doc' | 'quiz' | 'game'

/** One measure per lesson type; everything on a page shares it. */
const WIDTH: Record<LessonWidth, string> = {
  video: 'max-w-[55rem]',
  doc: 'max-w-[45rem]',
  quiz: 'max-w-[45rem]',
  game: 'max-w-none',
}

/**
 * The one layout every lesson page uses (video, doc, quiz, game, and the
 * player's loading and error screens). A single centred column: the slim top bar
 * (Back to the module screen, then "Module · Lesson 2 of 5"), the title, the
 * media or content, the description, then the action area. Every row shares the
 * column's left and right edges; the page gutter (16px, 24px from md) comes from
 * `.kid-main`, so nothing here adds its own. It decides nothing about completion.
 */
export function LessonLayout({
  courseId,
  width,
  context,
  title,
  description,
  notice,
  actions,
  children,
}: {
  courseId: string
  width: LessonWidth
  /** "Module name · Lesson 2 of 5", or null while unknown. */
  context: string | null
  title?: string
  description?: string | null
  /** A slim status strip above the title (offline, reconnecting). */
  notice?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={cn('mx-auto flex w-full flex-1 flex-col', WIDTH[width])}
      data-testid="lesson-layout"
      data-width={width}
    >
      <div className="lsn-bar sticky z-30 flex h-14 items-center gap-1 bg-cream" data-testid="lesson-bar">
        <Link
          to="/courses/$courseId"
          params={{ courseId }}
          replace
          className="kid-tap -my-1 flex size-11 flex-none items-center justify-start rounded-full text-ink"
          aria-label="Back"
          data-testid="lesson-back"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        {context ? (
          <p className="min-w-0 truncate text-sm text-ink/70" data-testid="lesson-context">
            {context}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 pt-2 md:gap-5">
        {notice}
        {title ? (
          <h1
            className="text-2xl leading-tight font-bold text-ink md:text-[28px]"
            style={{ fontFamily: 'var(--learner-font-heading, inherit)' }}
            data-testid="lesson-title"
          >
            {title}
          </h1>
        ) : null}
        {children}
        {description ? (
          <p className="text-base leading-relaxed text-ink/80" data-testid="lesson-description">
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="flex flex-col items-start gap-3 pt-2" data-testid="lesson-actions">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
