import { useEffect, useMemo, type ReactNode } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { buildCoursePageModel, normalizePageConfig, PAGE_FONTS, type CoursePageCourse, type PageFont, type Viewer } from '@/lib/coursePage'
import { isHttpsUrl } from '@/lib/externalLink'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useCourseInfo, useCourseOutline, useMyEnrollmentHistory, type CourseInfo, type MyEnrollmentHistory } from '@/hooks/useCourseInfo'
import { CoursePageView, type FreeEnrollActions } from '@/components/kid/coursePage/CoursePageView'
import { useEnrollFreeCourse } from '@/hooks/useEnrollFreeCourse'
import { courseAuthHref, courseRoadmapHref, describeEnrollError } from '@/lib/freeEnrollment'
import { useCoursePageFonts } from '@/components/kid/coursePage/fonts'
import { RetryScreen, UnavailableScreen } from '@/components/kid/roadmap/StateScreens'

/**
 * `/courses/$courseId` for a student who is NOT actively enrolled (`CoursePage.tsx`
 * renders this instead of the old "not on your list" screen once the course row
 * itself proves readable — i.e. it is published — under `courses_select_published_or_admin`;
 * a draft/archived/nonexistent id never reaches the page at all, so this component
 * never has to hide anything itself). Opening the Enroll link never enrolls the
 * student — it only opens a page; enrollment is still created the existing way
 * (admin manual-enroll, or an external flow).
 */
export function CourseGate({ courseId }: { courseId: string }) {
  const info = useCourseInfo(courseId)
  const outline = useCourseOutline(courseId)
  const history = useMyEnrollmentHistory(courseId)
  // The page's fonts load in parallel with its data and are (briefly) waited for, so the first
  // paint is already in the right face: no swap, no reflow on a slow phone.
  const fontsReady = useCoursePageFonts(info.data ? presetOf(info.data.page_font) : info.isPending ? null : 'inter')
  useWarmCover(info.data)

  if (info.isPending || outline.isPending || (info.data && !fontsReady)) return <CourseInfoSkeleton />
  if (info.isError) return <RetryScreen onRetry={() => void info.refetch()} />
  // Not readable under RLS: draft, archived, or the id doesn't exist. Same screen
  // either way — never a different message that would confirm which one it is.
  if (!info.data) return <UnavailableScreen />
  // A failed outline degrades gracefully: the page simply has no outline-derived parts.
  return <CourseInfoPage course={info.data} outline={outline.data ?? []} history={history.data ?? null} />
}

/**
 * Starts the cover image (the page's largest paint) the moment the course row arrives, instead of
 * when the page first renders, so it downloads in parallel with the outline and the fonts.
 */
// eslint-disable-next-line react-refresh/only-export-components -- tiny hook shared with PublicCoursePage
export function useWarmCover(course: (CoursePageCourse & { thumbnail_url?: string | null }) | null | undefined) {
  const url = course && normalizePageConfig(course).options.cover.show && isHttpsUrl(course.thumbnail_url?.trim() ?? '') ? course.thumbnail_url!.trim() : null
  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.fetchPriority = 'high'
    img.decoding = 'async'
    img.src = url
  }, [url])
}

/** The page's viewer from their own enrollment history: a revoked or expired row changes what a FREE course offers. */
function viewerOf(history: MyEnrollmentHistory | null): Viewer {
  if (history?.status === 'active') return { kind: 'enrolled' }
  if (history?.status === 'expired') return { kind: 'expired', endedAt: history.expiresAt }
  if (history?.status === 'revoked') return { kind: 'revoked' }
  return { kind: 'new' }
}

/** The course row's font preset, or the default when it is missing or unknown. */
// eslint-disable-next-line react-refresh/only-export-components -- tiny helper shared with PublicCoursePage
export function presetOf(font: string | null | undefined): PageFont {
  return (PAGE_FONTS as readonly string[]).includes(font ?? '') ? (font as PageFont) : 'inter'
}

/** Uses the real page's boxes (top bar, reserved cover, title lines), so the swap to the page does not shift anything. */
export function CourseInfoSkeleton() {
  return (
    <div className="cp" aria-busy="true" aria-label="Loading this course">
      <div className="cp-top">
        <div className="cp-top-in" />
      </div>
      <div className="cp-layout" data-cover="">
        <div className="cp-main">
          <div className="cp-hero">
            <div className="cp-cover" style={{ background: 'var(--cp-soft)' }} />
            <Skeleton className="h-8 w-4/5 rounded-lg bg-ink/10" />
            <Skeleton className="mt-3 h-5 w-full rounded-lg bg-ink/10" />
            <Skeleton className="mt-2 h-5 w-5/6 rounded-lg bg-ink/10" />
          </div>
        </div>
      </div>
    </div>
  )
}

function BackToCourses({ className, children, 'aria-label': ariaLabel }: { className: string; 'aria-label'?: string; children: ReactNode }) {
  return (
    <Link to="/courses" className={className} aria-label={ariaLabel} data-testid="back-to-courses">
      {children}
    </Link>
  )
}

function CourseInfoPage({ course, outline, history }: { course: CourseInfo; outline: Parameters<typeof buildCoursePageModel>[0]['outline']; history: MyEnrollmentHistory | null }) {
  const settings = useAppSettings()
  const router = useRouter()
  const enrollFree = useEnrollFreeCourse(course)
  const supportEmail = settings.data?.support_email ?? null
  const model = useMemo(
    () =>
      buildCoursePageModel({
        course,
        outline,
        viewer: viewerOf(history),
        supportEmail,
      }),
    [course, outline, history, supportEmail],
  )
  // Free courses enroll right here (fn_enroll_free_course); paid ones keep the admin-set link (no `free` actions needed).
  const free: FreeEnrollActions = {
    onEnroll: enrollFree.enroll,
    pending: enrollFree.isPending,
    error: enrollFree.isError ? describeEnrollError(enrollFree.error.message) : null,
    signupHref: courseAuthHref('signup', course.slug),
    loginHref: courseAuthHref('login', course.slug),
    goHref: courseRoadmapHref(course.slug),
    onNavigate: (href) => router.history.push(href),
  }
  return <CoursePageView model={model} backLink={BackToCourses} free={free} />
}
