import { BookOpen, ExternalLink } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/currency'
import { isHttpsUrl } from '@/lib/externalLink'
import { useCourseInfo, useMyEnrollmentHistory, type CourseInfo, type MyEnrollmentHistory } from '@/hooks/useCourseInfo'
import { RetryScreen, UnavailableScreen } from '@/components/kid/roadmap/StateScreens'
import { LG_UP, useMediaQuery } from '@/hooks/useMediaQuery'

const EXPIRED_DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * `/courses/$courseId` for a student who is NOT actively enrolled (`CoursePage.tsx`
 * renders this instead of `NotEnrolledScreen` once the course row itself proves
 * readable — i.e. it is published — under `courses_select_published_or_admin`;
 * a draft/archived/nonexistent id never reaches here at all, so this component
 * never has to hide anything itself). Opening the Enroll link never enrolls the
 * student — it only opens a page; enrollment is still created the existing way
 * (admin manual-enroll, or an external flow).
 */
export function CourseGate({ courseId }: { courseId: string }) {
  const info = useCourseInfo(courseId)
  const history = useMyEnrollmentHistory(courseId)

  if (info.isPending) return <CourseInfoSkeleton />
  if (info.isError) return <RetryScreen onRetry={() => void info.refetch()} />
  // Not readable under RLS: draft, archived, or the id doesn't exist. Same screen
  // either way — never a different message that would confirm which one it is.
  if (!info.data) return <UnavailableScreen />
  return <CourseInfoPage course={info.data} history={history.data ?? null} />
}

function CourseInfoSkeleton() {
  return (
    <div className="cip" aria-busy="true" aria-label="Loading this course">
      <Skeleton className="aspect-[16/9] w-full rounded-[20px] bg-ink/10" />
      <Skeleton className="mt-4 h-8 w-4/5 rounded-xl bg-ink/10" />
      <Skeleton className="mt-3 h-4 w-full rounded-lg bg-ink/10" />
      <Skeleton className="mt-2 h-4 w-5/6 rounded-lg bg-ink/10" />
      <Skeleton className="mt-6 h-14 w-full rounded-full bg-ink/10" />
    </div>
  )
}

function CourseInfoPage({ course, history }: { course: CourseInfo; history: MyEnrollmentHistory | null }) {
  const desktop = useMediaQuery(LG_UP)
  return desktop ? <DesktopCourseInfo course={course} history={history} /> : <MobileCourseInfo course={course} history={history} />
}

/** The lapsed-access note and the button label share this: both only need to know "did access end". */
function expiredNote(history: MyEnrollmentHistory | null): string | null {
  if (!history || history.status !== 'expired') return null
  return history.expiresAt ? `Your access ended on ${EXPIRED_DATE.format(new Date(history.expiresAt))}.` : 'Your access has ended.'
}

function Cover({ course, className }: { course: CourseInfo; className: string }) {
  return (
    <div className={className} aria-hidden>
      {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" loading="lazy" /> : <BookOpen className="size-12" />}
    </div>
  )
}

function Price({ course }: { course: CourseInfo }) {
  if (course.isFree) return <p className="cip-price" data-testid="course-price">Free</p>
  if (course.priceAmount == null) return null
  return (
    <p className="cip-price kid-num" data-testid="course-price">
      {formatAmount(course.priceAmount, course.currency)}
    </p>
  )
}

/**
 * Re-checks `https://` at click time (the DB and the admin form already enforce
 * it; this is the third, last-moment check right before anything opens) and
 * never renders an `href` at all for anything else, so there is no code path
 * where a non-https value becomes a real navigable link.
 */
function EnrollAction({ enrollUrl, label }: { enrollUrl: string | null; label: string }) {
  if (!enrollUrl || !isHttpsUrl(enrollUrl)) {
    return (
      <p className="cip-noenroll" role="status" data-testid="no-enroll-note">
        Enrollment isn&apos;t open for this course yet.
      </p>
    )
  }
  return (
    <>
      <a
        href={enrollUrl}
        target="_blank"
        rel="noreferrer"
        className="candy-btn kid-tap cip-enroll"
        aria-label={`${label}, opens another page`}
        data-testid="enroll-now"
      >
        {label}
        <ExternalLink className="size-5" aria-hidden />
      </a>
      <p className="cip-enroll-hint">You&apos;ll finish enrolling on another page. Ask a grown-up to help if you need to.</p>
    </>
  )
}

function MobileCourseInfo({ course, history }: { course: CourseInfo; history: MyEnrollmentHistory | null }) {
  const note = expiredNote(history)
  return (
    <div className="cip" data-testid="course-info">
      <Cover course={course} className="cip-cover" />
      <h1 className="cip-title" data-testid="course-title">
        {course.title}
      </h1>
      <Price course={course} />
      {course.description ? <p className="cip-desc">{course.description}</p> : null}
      {note ? (
        <p className="cip-expired-note" data-testid="expired-note">
          {note}
        </p>
      ) : null}
      <EnrollAction enrollUrl={course.enrollUrl} label={note ? 'Enroll again' : 'Enroll now'} />
    </div>
  )
}

function DesktopCourseInfo({ course, history }: { course: CourseInfo; history: MyEnrollmentHistory | null }) {
  const note = expiredNote(history)
  return (
    <div className="cipd" data-testid="course-info-desktop">
      <Link to="/courses" className="cipd-back kid-tap" data-testid="back-to-courses">
        Back to courses
      </Link>
      <div className="cipd-card">
        <Cover course={course} className="cipd-cover" />
        <div className="cipd-body" data-testid="course-info">
          <h1 className="cipd-title" data-testid="course-title">
            {course.title}
          </h1>
          <Price course={course} />
          {course.description ? <p className="cipd-desc">{course.description}</p> : null}
          {note ? (
            <p className="cip-expired-note" data-testid="expired-note">
              {note}
            </p>
          ) : null}
          <EnrollAction enrollUrl={course.enrollUrl} label={note ? 'Enroll again' : 'Enroll now'} />
        </div>
      </div>
    </div>
  )
}
