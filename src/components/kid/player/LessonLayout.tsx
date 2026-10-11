import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import { LessonRail, type LessonRailInfo } from './LessonRail'
import { PlayerBar } from './PlayerBar'
import { PrimaryButton, PrimaryLink } from './PrimaryButton'
import { LG_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import type { NextLesson, PreviousLesson } from '@/hooks/useModulePath'
import { useTerms } from '@/hooks/useSettings'
import { playerCopy } from '@/lib/playerCopy'
import { cn } from '@/lib/utils'

export type LessonWidth = 'video' | 'doc' | 'quiz' | 'game'

/** One measure per lesson type, mobile only — the desktop column's width comes
 * from the two-column grid instead (`.khd`, kid.css), the same ~820px for every type. */
const WIDTH: Record<LessonWidth, string> = {
  video: 'max-w-[55rem]',
  doc: 'max-w-[45rem]',
  quiz: 'max-w-[45rem]',
  game: 'max-w-none',
}

function HomeBackMobile() {
  return (
    <Link
      to="/"
      className="kid-tap -my-1 flex size-11 flex-none items-center justify-start rounded-full text-ink"
      aria-label="Back to Home"
      data-testid="lesson-back"
    >
      <ArrowLeft className="size-6" aria-hidden />
    </Link>
  )
}

function MobileTopBar({ courseTitle, rail }: { courseTitle: string | null; rail: LessonRailInfo | null }) {
  const { term } = useTerms()
  return (
    <>
      <div className="lsn-bar sticky z-30 flex h-14 items-center gap-2 bg-cream" data-testid="lesson-bar">
        <HomeBackMobile />
        {courseTitle ? (
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink/70" data-testid="lesson-course">
            {courseTitle}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        {rail ? (
          <p className="kid-num flex-none text-sm text-ink/70" data-testid="lesson-position">
            {term('lesson')} {rail.position} of {rail.total}
          </p>
        ) : null}
      </div>
      {rail ? (
        <div
          className="flex gap-1 pb-1"
          role="img"
          aria-label={`${term('lesson')} ${rail.position} of ${rail.total} in this module`}
          data-testid="lesson-segments"
        >
          {rail.rows.map((row) => (
            <span
              key={row.id}
              className="lsn-segment"
              data-state={row.state === 'completed' || row.state === 'current' ? 'done' : 'todo'}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
    </>
  )
}

function DesktopTopBar({ courseTitle }: { courseTitle: string | null }) {
  return (
    <div className="lsn-dbar" data-testid="lesson-bar">
      <Link to="/" className="lsn-home-pill kid-tap" data-testid="lesson-back">
        <ArrowLeft className="size-5" aria-hidden />
        Back to Home
      </Link>
      {courseTitle ? <p className="lsn-dcourse">{courseTitle}</p> : null}
    </div>
  )
}

function Eyebrow({ rail, desktop }: { rail: LessonRailInfo | null; desktop: boolean }) {
  const { term } = useTerms()
  if (!rail) return null
  const text = desktop
    ? `${rail.moduleTitle} · ${term('lesson')} ${rail.position} of ${rail.total}`
    : `Section ${rail.sectionNumber} · ${rail.moduleTitle}`
  return (
    <p className="lsn-eyebrow" data-testid="lesson-context">
      {text}
    </p>
  )
}

export interface LessonNav {
  previous: PreviousLesson | null
  next: NextLesson | null
}

/** The shared Next/Previous row — built here, not by the caller, because the two
 * width-specific layouts (desktop: a plain left/right row; mobile: a fixed-width
 * Previous square + a flex-1 Next filling the rest) are shell chrome, not lesson logic. */
function NavRow({ courseId, nav, desktop }: { courseId: string; nav: LessonNav; desktop: boolean }) {
  const noNext = !nav.next
  if (noNext && !nav.previous) return null
  const next = nav.next ? (
    nav.next.locked ? (
      <PrimaryButton variant="muted" testId="next-locked">
        <Lock className="size-4 flex-none" aria-hidden />
        <span className={desktop ? undefined : 'lp-primary-label'}>{playerCopy.button.next(nav.next.title)}</span>
      </PrimaryButton>
    ) : (
      <PrimaryLink
        variant="lesson-next"
        to="/courses/$courseId/lessons/$lessonId"
        params={{ courseId, lessonId: nav.next.id }}
        replace
        testId="next-lesson"
      >
        <span className={desktop ? undefined : 'lp-primary-label'}>{playerCopy.button.next(nav.next.title)}</span>
        <ArrowRight className="size-4 flex-none" aria-hidden />
      </PrimaryLink>
    )
  ) : (
    <PrimaryLink variant="lesson-next" to="/" replace testId="back-to-path">
      <span className={desktop ? undefined : 'lp-primary-label'}>{playerCopy.button.backToHome}</span>
      <ArrowRight className="size-4 flex-none" aria-hidden />
    </PrimaryLink>
  )
  const previous = nav.previous ? (
    desktop ? (
      <PrimaryLink
        variant="lesson-previous"
        to="/courses/$courseId/lessons/$lessonId"
        params={{ courseId, lessonId: nav.previous.id }}
        replace
        testId="previous-lesson"
      >
        <ArrowLeft className="size-4 flex-none" aria-hidden />
        Previous
      </PrimaryLink>
    ) : (
      <PrimaryLink
        variant="lesson-previous"
        square
        to="/courses/$courseId/lessons/$lessonId"
        params={{ courseId, lessonId: nav.previous.id }}
        replace
        testId="previous-lesson"
        aria-label={`Previous lesson: ${nav.previous.title}`}
      >
        <ArrowLeft className="size-5" aria-hidden />
      </PrimaryLink>
    )
  ) : null

  if (desktop) {
    return (
      <div className={cn('flex items-center gap-3 pt-2', previous ? 'justify-between' : 'justify-end')} data-testid="lesson-actions">
        {previous}
        {next}
      </div>
    )
  }
  return (
    <div className="flex w-full gap-2" data-testid="lesson-actions">
      {previous}
      <div className="min-w-0 flex-1">{next}</div>
    </div>
  )
}

interface LessonLayoutProps {
  courseId: string
  /** null while the course's own title hasn't loaded yet (whole-page loading/error states). */
  courseTitle: string | null
  width: LessonWidth
  /** null for the whole-page loading/error states, which have no module to show. */
  rail: LessonRailInfo | null
  title?: string
  /** The type/time/XP pill row, under the title. */
  chips?: ReactNode
  description?: string | null
  /** A slim status strip above the title (offline, reconnecting). */
  notice?: ReactNode
  /** The one-line "what happens next" card, between the content and "About this lesson". */
  statusCard?: ReactNode
  /** The shared Next/Previous row, built by the shell itself (it needs to know the
   * width to lay the two buttons out correctly) — omit for a quiz, which owns its
   * whole flow. Mutually exclusive with `actions` below. */
  nav?: LessonNav | null
  /** An alternate single action replacing the nav row (a failed manual completion's
   * Try again, or a manual-video lesson's own Mark as complete). */
  actions?: ReactNode
  children: ReactNode
}

/**
 * The one shell every lesson page uses (video, doc, quiz, game, and the
 * player's loading and error screens) — ui.md "Lesson pages redesign". Mobile: a
 * single column, Back always goes Home, a segmented bar shows this module's
 * lessons. Desktop (>= 1024px): the same left sidebar as Home (mounted by
 * `KidLayout`, not here), a "Back to Home" pill, a two-column grid (this
 * column + a rail showing the current module), reusing Home's own card/row
 * classes (`.khd-*`, kid.css "desktop Home"). Content order is identical at
 * every width: eyebrow, title, chips, the lesson content, a status card,
 * "About this lesson", then the Next action — only the chrome around it
 * (top bar, columns, where the action sits) changes by width.
 */
export function LessonLayout({
  courseId,
  courseTitle,
  width,
  rail,
  title,
  chips,
  description,
  notice,
  statusCard,
  nav,
  actions,
  children,
}: LessonLayoutProps) {
  const desktop = useMediaQuery(LG_UP)
  const { lower } = useTerms()

  const column = (
    <div
      className={cn('mx-auto flex w-full flex-1 flex-col gap-4 md:gap-5', !desktop && WIDTH[width])}
      data-testid="lesson-layout"
      data-width={width}
    >
      {!desktop ? <MobileTopBar courseTitle={courseTitle} rail={rail} /> : null}
      {notice}
      <Eyebrow rail={rail} desktop={desktop} />
      {title ? (
        <h1
          className="text-2xl leading-tight font-bold text-ink md:text-[28px]"
          style={{ fontFamily: 'var(--learner-font-heading, inherit)' }}
          data-testid="lesson-title"
        >
          {title}
        </h1>
      ) : null}
      {chips ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="lesson-chips">
          {chips}
        </div>
      ) : null}
      {children}
      {statusCard}
      {description ? (
        <div className="flex flex-col gap-1" data-testid="lesson-description">
          <h2 className="text-base font-bold text-ink">About this {lower('lesson')}</h2>
          <p className="text-base leading-relaxed text-ink/80">{description}</p>
        </div>
      ) : null}
      {nav ? (
        desktop ? (
          <NavRow courseId={courseId} nav={nav} desktop />
        ) : (
          <PlayerBar>
            <NavRow courseId={courseId} nav={nav} desktop={false} />
          </PlayerBar>
        )
      ) : actions ? (
        desktop ? (
          <div className="flex justify-end pt-2" data-testid="lesson-actions">
            {actions}
          </div>
        ) : (
          <PlayerBar>{actions}</PlayerBar>
        )
      ) : null}
    </div>
  )

  if (desktop) {
    return (
      <>
        <DesktopTopBar courseTitle={courseTitle} />
        {rail ? (
          <div className="khd" data-testid="lesson-desktop">
            <div className="khd-main">{column}</div>
            <LessonRail courseId={courseId} rail={rail} />
          </div>
        ) : (
          <div className="khd-main" data-testid="lesson-desktop">
            {column}
          </div>
        )}
      </>
    )
  }
  return column
}
