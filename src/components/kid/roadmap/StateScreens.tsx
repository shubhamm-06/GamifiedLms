import type { ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { BookOpen, Compass, LockKeyhole, Sprout, WifiOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Whole-page states for the course roadmap. Copy is for children and
 * parents — no codes, no technical words.
 */

export function Screen({
  icon,
  title,
  body,
  children,
  testId,
}: {
  icon: ReactNode
  title: string
  body: string
  children?: ReactNode
  testId: string
}) {
  return (
    <div className="kid-card mx-auto mt-6 max-w-md p-6 text-center" data-testid={testId} role="status">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--kid-muted)] text-ink shadow-[0_5px_0_var(--kid-muted-d)]">
        {icon}
      </span>
      <h1 className="mt-4 text-2xl leading-tight font-extrabold">{title}</h1>
      <p className="mt-2 text-base">{body}</p>
      {children ? <div className="mt-5 flex justify-center">{children}</div> : null}
    </div>
  )
}

function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="candy-btn-quiet kid-tap"
      onClick={() => (router.history.canGoBack() ? router.history.back() : router.history.push('/'))}
    >
      Go back
    </button>
  )
}

export function NotEnrolledScreen() {
  return (
    <Screen
      testId="state-not-enrolled"
      icon={<LockKeyhole className="size-8" aria-hidden />}
      title="This course isn't on your list yet"
      body="Ask a grown-up to help you get started."
    >
      <BackButton />
    </Screen>
  )
}

/** Home with nothing to show: not enrolled anywhere a student can read. */
export function NoCoursesScreen() {
  return (
    <Screen
      testId="state-no-courses"
      icon={<BookOpen className="size-8" aria-hidden />}
      title="No courses yet"
      body="Ask a grown-up to help you get started."
    />
  )
}

export function UnavailableScreen() {
  return (
    <Screen
      testId="state-unavailable"
      icon={<Compass className="size-8" aria-hidden />}
      title="This course isn't ready yet"
      body="Please check back a little later."
    >
      <BackButton />
    </Screen>
  )
}

export function EmptyCourseScreen() {
  return (
    <Screen
      testId="state-empty"
      icon={<Sprout className="size-8" aria-hidden />}
      title="Lessons are on their way!"
      body="This course doesn't have any lessons yet. Come back soon."
    >
      <BackButton />
    </Screen>
  )
}

export function RetryScreen({
  onRetry,
  title = "Oops! We couldn't load your path",
}: {
  onRetry: () => void
  title?: string
}) {
  return (
    <Screen
      testId="state-error"
      icon={<WifiOff className="size-8" aria-hidden />}
      title={title}
      body="Check your internet and try again."
    >
      <button type="button" className="candy-btn kid-tap" onClick={onRetry}>
        Try again
      </button>
    </Screen>
  )
}

/**
 * Shaped like the real page (art, title, progress, a banner, zigzag nodes) so
 * nothing jumps when data arrives. Uses the same row/slot classes.
 */
export function RoadmapSkeleton() {
  const offsets = [0, -1, 0, 1]
  return (
    <div className="rm" data-testid="roadmap-skeleton" aria-busy="true" aria-label="Loading your path">
      <div className="mb-5">
        <Skeleton className="aspect-[16/9] w-full rounded-[20px] bg-ink/10" />
        <Skeleton className="mt-4 h-8 w-4/5 rounded-xl bg-ink/10" />
        <Skeleton className="mt-4 h-5 w-full rounded-full bg-ink/10" />
      </div>
      <Skeleton className="h-16 w-full rounded-[26px] bg-ink/10" />
      <div className="rm-path">
        {offsets.map((off, i) => (
          <div key={i} className="rm-row" data-off={off} style={{ ['--off' as string]: off }}>
            <div className="rm-slot">
              <Skeleton className="size-16 rounded-full bg-ink/10" />
              <Skeleton className="mt-3.5 h-4 w-28 rounded-lg bg-ink/10" />
              <Skeleton className="mt-2 h-5 w-16 rounded-full bg-ink/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
