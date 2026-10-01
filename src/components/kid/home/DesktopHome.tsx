import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Check,
  ChevronRight,
  Flame,
  Lock,
  LockOpen,
  PartyPopper,
  Play,
  Sparkles,
  Target,
} from 'lucide-react'
import { useKidHeader } from '@/components/kid/kidHeader'
import { LESSON_TYPE_META } from '@/components/kid/roadmap/lessonTypeMeta'
import {
  EmptyCourseScreen,
  NoCoursesScreen,
  NotEnrolledScreen,
  RetryScreen,
  UnavailableScreen,
} from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { useCourseRoadmap } from '@/hooks/useCourseRoadmap'
import { useHomeCourse, useTouchEnrollment } from '@/hooks/useHomeCourse'
import { useKidProfile } from '@/hooks/useKidProfile'
import { prefersReducedMotion } from '@/hooks/useMediaQuery'
import type { Roadmap, RoadmapLesson, RoadmapSection } from '@/lib/roadmap'
import { clearLessonLeft } from '@/lib/roadmapReturn'

/**
 * Home at desktop widths (>= 1024px, `LG_UP`): the same course, the same data
 * (`useHomeCourse` picks it, `useCourseRoadmap` merges content with the
 * engine's lesson states; nothing here decides what is locked), presented as a
 * list instead of the winding path. `KidHomePage` mounts this OR the mobile
 * path, never both, so the path's auto-scroll and popover never run here.
 * Whole-page states reuse the mobile screens and copy.
 */
export function DesktopHome({ home }: { home: ReturnType<typeof useHomeCourse> }) {
  // Home's title comes from the page heading below; the top bar row is hidden on Home anyway.
  useKidHeader('')
  if (home.isPending) return <DesktopHomeSkeleton />
  if (home.isError) return <RetryScreen onRetry={() => void home.refetch()} />
  if (!home.data) return <NoCoursesScreen />
  return <CourseHome courseId={home.data} />
}

function CourseHome({ courseId }: { courseId: string }) {
  const screen = useCourseRoadmap(courseId)
  // Stamps last_accessed_at so Home keeps choosing this course, exactly as the mobile view does.
  useTouchEnrollment(courseId, screen.kind === 'ready' || screen.kind === 'empty')

  switch (screen.kind) {
    case 'loading':
      return <DesktopHomeSkeleton />
    case 'not_enrolled':
      return <NotEnrolledScreen />
    case 'unavailable':
      return <UnavailableScreen />
    case 'error':
      return <RetryScreen onRetry={screen.retry} />
    case 'empty':
      return <EmptyCourseScreen />
    case 'ready':
      return <ReadyHome title={screen.title} roadmap={screen.roadmap} courseId={courseId} />
  }
}

/* ----------------------------------------------------------- open sections */

/** The key of the section holding the next-up lesson, or null (finished course, nothing available). */
function nextSectionKey(roadmap: Roadmap): string | null {
  if (!roadmap.currentLessonId) return null
  return roadmap.sections.find((s) => s.lessons.some((l) => l.id === roadmap.currentLessonId))?.key ?? null
}

/**
 * Which sections start open: only the one holding the next-up lesson. A finished
 * course opens the last section; a single section is always open; if nothing is
 * next up and the course is not finished, the first one opens so the page is not
 * a stack of closed bands.
 */
function initialOpenKeys(roadmap: Roadmap): Set<string> {
  const { sections } = roadmap
  if (sections.length === 0) return new Set()
  if (sections.length === 1) return new Set([sections[0].key])
  const next = nextSectionKey(roadmap)
  if (next) return new Set([next])
  return new Set([roadmap.courseComplete ? sections[sections.length - 1].key : sections[0].key])
}

function ReadyHome({ title, roadmap, courseId }: { title: string; roadmap: Roadmap; courseId: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  // Local state keyed by section (module) id, not persisted. Several may be open at once.
  const [open, setOpen] = useState(() => initialOpenKeys(roadmap))

  // If a refetch moves the next-up lesson into another section (a lesson was just finished),
  // open that section once. The child's own toggles are otherwise never touched by a refresh:
  // this only runs when the next-up section CHANGES. Adjusting state during render, not in an effect.
  const nextKey = nextSectionKey(roadmap)
  const [seenNextKey, setSeenNextKey] = useState(nextKey)
  if (nextKey !== seenNextKey) {
    setSeenNextKey(nextKey)
    if (nextKey && !open.has(nextKey)) setOpen(new Set(open).add(nextKey))
  }

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const allOpen = roadmap.sections.every((s) => open.has(s.key))
  const setAll = (value: boolean) => setOpen(new Set(value ? roadmap.sections.map((s) => s.key) : []))

  // Every time Home opens: bring the next-up row (or, for a finished course, the
  // "you finished" note) into view. Its section is open by default, so the row exists.
  // Nothing opens by itself. Runs once per mount on purpose; a later refetch or toggle
  // must not re-scroll the page under the child.
  useEffect(() => {
    const target = rootRef.current?.querySelector<HTMLElement>(
      roadmap.currentLessonId ? '[data-next-up="true"]' : '[data-testid="course-complete-note"]',
    )
    target?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    // Same hand-off the mobile path makes: the "where I left off" memory has been used.
    clearLessonLeft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="khd" data-testid="desktop-home" ref={rootRef}>
      <div className="khd-main">
        <header className="khd-head">
          <h1 className="khd-title">{title}</h1>
          <div className="khd-head-links">
            {roadmap.sections.length > 1 ? (
              <button
                type="button"
                className="khd-switch kid-tap"
                onClick={() => setAll(!allOpen)}
                data-testid="toggle-all"
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            ) : null}
            <Link to="/courses" className="khd-switch kid-tap" data-testid="switch-course">
              Switch course
            </Link>
          </div>
        </header>
        {roadmap.sections.map((section, i) => (
          <Section
            key={section.key}
            section={section}
            number={i + 1}
            courseId={courseId}
            nextId={roadmap.currentLessonId}
            open={open.has(section.key)}
            onToggle={() => toggle(section.key)}
          />
        ))}
        {roadmap.courseComplete ? (
          <p className="khd-complete" role="status" data-testid="course-complete-note">
            <PartyPopper className="size-6 flex-none" aria-hidden />
            You finished every lesson!
          </p>
        ) : null}
      </div>
      <Rail roadmap={roadmap} />
    </div>
  )
}

/* ------------------------------------------------------------------ sections */

function Section({
  section,
  number,
  courseId,
  nextId,
  open,
  onToggle,
}: {
  section: RoadmapSection
  number: number
  courseId: string
  nextId: string | null
  open: boolean
  onToggle: () => void
}) {
  const headingId = `khd-heading-${section.key}`
  const panelId = `khd-panel-${section.key}`
  const total = section.lessons.length
  const complete = total > 0 && section.doneCount === total
  const hasNext = nextId !== null && section.lessons.some((l) => l.id === nextId)
  const percent = total === 0 ? 0 : Math.round((section.doneCount / total) * 100)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const button = e.currentTarget
    onToggle()
    // Closing a tall section can leave its own header above the top of the window
    // (the page got shorter under a scrolled position): bring it back. Opening or
    // closing anything else never moves the page: no scrolling is done for those.
    if (open) {
      window.setTimeout(
        () => {
          if (button.isConnected && button.getBoundingClientRect().top < 0) {
            button.scrollIntoView({ block: 'start', behavior: 'auto' })
          }
        },
        prefersReducedMotion() ? 0 : 230,
      )
    }
  }

  return (
    <section className="khd-section" data-testid="section" data-open={open ? 'true' : 'false'}>
      <h2 id={headingId} className="khd-band-heading">
        <button
          type="button"
          className="khd-band kid-tap"
          data-locked={section.allLocked ? 'true' : undefined}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={handleClick}
          data-testid="section-toggle"
        >
          <span className="khd-band-text">
            <span className="khd-band-caption">Section {number}</span>
            <span className="khd-band-title">{section.title}</span>
          </span>
          <span className="khd-band-side">
            {hasNext && !open ? <span className="khd-band-hint">Next up</span> : null}
            <span className="khd-band-count kid-num">
              {section.allLocked ? <Lock aria-hidden /> : null}
              {section.doneCount} of {total} {total === 1 ? 'lesson' : 'lessons'}
            </span>
            {complete ? (
              <span className="khd-band-done" aria-hidden>
                <Check strokeWidth={3.5} />
              </span>
            ) : null}
            <ChevronRight className="khd-band-chevron size-5 flex-none" aria-hidden />
          </span>
          {/* Decorative: the count above already says it in words. */}
          <span className="khd-band-bar" aria-hidden>
            <span className="khd-band-bar-fill" style={{ width: `${percent}%` }} />
          </span>
        </button>
      </h2>
      <div className="khd-collapse" id={panelId} data-open={open ? 'true' : 'false'}>
        {/* inert: closed rows leave the tab order and the accessibility tree. */}
        <div className="khd-collapse-inner" inert={!open}>
          <ul className="khd-list">
            {section.lessons.map((lesson) => (
              <li key={lesson.id}>
                <LessonRow lesson={lesson} courseId={courseId} next={lesson.id === nextId} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------- rows */

type RowStatus = 'completed' | 'next' | 'available' | 'locked'

function rowStatus(lesson: RoadmapLesson, next: boolean): RowStatus {
  if (lesson.state === 'locked') return 'locked'
  if (lesson.state === 'completed') return 'completed'
  return next ? 'next' : 'available'
}

/** The word for a row's state: text always accompanies the icon, so colour is never the only signal. */
function statusLabel(lesson: RoadmapLesson, status: RowStatus): string {
  if (status === 'completed') return 'Completed'
  if (status === 'locked') return 'Locked'
  if (status === 'next') return 'Next up'
  return lesson.state === 'in_progress' ? 'In progress' : 'Available'
}

/** Mirrors the mobile card's button wording. */
function actionLabel(lesson: RoadmapLesson): string {
  return lesson.state === 'completed' ? 'Review' : lesson.state === 'in_progress' ? 'Keep going' : 'Start'
}

function LessonRow({ lesson, courseId, next }: { lesson: RoadmapLesson; courseId: string; next: boolean }) {
  const status = rowStatus(lesson, next)
  const { label: typeLabel, Icon: TypeIcon } = LESSON_TYPE_META[lesson.type]
  const StatusIcon =
    status === 'completed' ? Check : status === 'locked' ? Lock : status === 'next' ? Play : LockOpen
  // A locked lesson shows no XP, as on mobile (a null xp already means a gamification-off course).
  const showXp = status !== 'locked' && lesson.xp !== null && lesson.xp > 0

  const content = (
    <>
      <span className="khd-status" aria-hidden>
        <StatusIcon
          className="size-5"
          strokeWidth={status === 'completed' ? 3 : 2.5}
          fill={status === 'next' ? 'currentColor' : 'none'}
        />
      </span>
      <span className="khd-row-main">
        <span className="khd-row-title">{lesson.title}</span>
        <span className="khd-row-meta">
          <span className="khd-type">
            <TypeIcon aria-hidden />
            {typeLabel}
          </span>
          <span aria-hidden>·</span>
          <span className="khd-state">{statusLabel(lesson, status)}</span>
        </span>
      </span>
      {showXp ? (
        <span className="khd-chip kid-num">
          <Sparkles aria-hidden />+{lesson.xp} XP
        </span>
      ) : null}
      {status === 'locked' ? null : (
        <span className="khd-cta" data-tone={status === 'next' ? 'gold' : status === 'completed' ? 'quiet' : 'teal'}>
          {actionLabel(lesson)}
          {status === 'next' ? null : <ChevronRight aria-hidden />}
        </span>
      )}
    </>
  )

  if (status === 'locked') {
    return (
      <div className="khd-row" data-state="locked" aria-disabled="true" data-testid="lesson-row">
        {content}
      </div>
    )
  }
  return (
    <Link
      to="/courses/$courseId/lessons/$lessonId"
      params={{ courseId, lessonId: lesson.id }}
      className="khd-row kid-tap"
      data-state={status}
      data-next-up={status === 'next' ? 'true' : undefined}
      data-testid="lesson-row"
    >
      {content}
    </Link>
  )
}

/* ---------------------------------------------------------------- right rail */

function Rail({ roadmap }: { roadmap: Roadmap }) {
  const profile = useKidProfile()
  const value = (n: number | undefined) => (n === undefined ? '–' : n)
  return (
    <aside className="khd-rail" aria-label="Your progress" data-testid="home-rail">
      {roadmap.gamified ? (
        <>
          <div className="khd-card" data-kind="streak" data-testid="rail-streak">
            <span className="khd-card-icon" aria-hidden>
              <Flame className="size-6" />
            </span>
            <div>
              <p className="khd-card-value kid-num">{value(profile.data?.currentStreak)}</p>
              <p className="khd-card-label">day streak</p>
            </div>
          </div>
          <div className="khd-card" data-kind="xp" data-testid="rail-xp">
            <span className="khd-card-icon" aria-hidden>
              <Sparkles className="size-6" />
            </span>
            <div>
              <p className="khd-card-value kid-num">{value(profile.data?.totalXp)}</p>
              <p className="khd-card-label">total XP</p>
            </div>
          </div>
        </>
      ) : null}
      <div className="khd-card khd-card-progress" data-kind="progress" data-testid="rail-progress">
        <span className="khd-card-icon" aria-hidden>
          <Target className="size-6" />
        </span>
        <div className="khd-progress-body">
          <p className="khd-card-label">Course progress</p>
          <p className="khd-card-value kid-num">
            {roadmap.doneLessons} of {roadmap.totalLessons} lessons
          </p>
          <div
            className="khd-bar"
            role="progressbar"
            aria-label="Course progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={roadmap.percent}
          >
            <span className="khd-bar-fill" style={{ width: `${roadmap.percent}%` }} />
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ skeleton */

function DesktopHomeSkeleton() {
  return (
    <div className="khd" data-testid="roadmap-skeleton" aria-busy="true" aria-label="Loading your lessons">
      <div className="khd-main">
        <Skeleton className="h-10 w-2/3 rounded-xl bg-ink/10" />
        <Skeleton className="h-16 w-full rounded-[18px] bg-ink/10" />
        <div className="khd-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[18px] bg-ink/10" />
          ))}
        </div>
      </div>
      <div className="khd-rail">
        <Skeleton className="h-20 w-full rounded-[18px] bg-ink/10" />
        <Skeleton className="h-20 w-full rounded-[18px] bg-ink/10" />
      </div>
    </div>
  )
}
