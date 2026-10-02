import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { RetryScreen } from '@/components/kid/roadmap/StateScreens'
import { CourseInfoSkeleton, presetOf, useWarmCover } from '@/components/kid/courses/CourseInfoPage'
import { CoursePageView } from '@/components/kid/coursePage/CoursePageView'
import { loadCoursePageFont, useCoursePageFonts } from '@/components/kid/coursePage/fonts'
import '@/components/kid/coursePage/coursePage.css'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useCourseInfo, useCourseOutline } from '@/hooks/useCourseInfo'
import { buildCoursePageModel } from '@/lib/coursePage'
import { isUuid } from '@/lib/slug'

/**
 * `/course/$courseRef` (the ref is the course SLUG; a course id also works and is rewritten to the slug): the parent-facing course page for someone who is NOT signed in
 * (a parent opening a shared link). No app shell, no login. A signed-in visitor is sent
 * on to `/courses/$courseId` by the route's `beforeLoad` (router.tsx), so the app's own
 * rules (enrolled gets the roadmap, otherwise this same page inside the shell) apply.
 *
 * Data is exactly what the in-app page reads: the course row (already readable by anon for
 * a published, live course under `courses_select_published_or_admin`) and `fn_course_outline`
 * (executable by anon since migration 035; it applies its own published/live check).
 * A draft, archived, trashed or unknown id gets the one same "not available" message.
 */
export function PublicCoursePage() {
  const { courseRef } = useParams({ strict: false }) as { courseRef: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const info = useCourseInfo(courseRef)
  const outline = useCourseOutline(info.data?.id)
  useWarmCover(info.data)
  const fontsReady = useCoursePageFonts(info.data ? presetOf(info.data.page_font) : info.isPending ? null : 'inter')
  const settings = useAppSettings()
  const siteName = settings.data?.site_name || 'Wisdom Hatch Kids'
  const supportEmail = settings.data?.support_email ?? null

  const model = useMemo(
    () => (info.data ? buildCoursePageModel({ course: info.data, outline: outline.data ?? [], viewer: { kind: 'new' }, supportEmail }) : null),
    [info.data, outline.data, supportEmail],
  )

  useEffect(() => {
    if (!info.data) return
    const previous = document.title
    document.title = `${info.data.title} | ${siteName}`
    return () => {
      document.title = previous
    }
  }, [info.data, siteName])

  // A link made from the course id is rewritten to the slug form (the shareable one), in place.
  const slug = info.data?.slug
  useEffect(() => {
    if (slug && isUuid(courseRef)) {
      queryClient.setQueryData(['course', 'info', slug], info.data) // no skeleton flash when the ref changes
      void navigate({ to: '/course/$courseRef', params: { courseRef: slug }, replace: true })
    }
  }, [slug, courseRef, navigate, queryClient, info.data])

  // The unavailable message is not drawn by CoursePageView (which loads its font), so load the default here.
  const unavailable = !info.isPending && !info.isError && !info.data
  useEffect(() => {
    if (unavailable) void loadCoursePageFont('inter')
  }, [unavailable])

  const top = (
    <>
      <span className="cp-site">{siteName}</span>
      <Link to="/login" search={{ redirect: `/courses/${slug ?? courseRef}` }} className="cp-back" data-testid="public-login">
        Log in
      </Link>
    </>
  )

  if (info.isPending || (!!info.data && (outline.isPending || !fontsReady))) {
    return (
      <div className="cp-public">
        <CourseInfoSkeleton />
      </div>
    )
  }
  if (info.isError) {
    return (
      <div className="cp-public">
        <RetryScreen onRetry={() => void info.refetch()} />
      </div>
    )
  }
  if (!model) {
    return (
      <div className="cp-public">
        <div className="cp" data-theme="teal" data-font="inter" data-testid="public-unavailable">
          <div className="cp-top" data-always>
            <div className="cp-top-in">{top}</div>
          </div>
          <div className="cp-layout">
            <main className="cp-main">
              <h1 className="cp-title">This course isn&apos;t available</h1>
              <p className="cp-lead">It may not be open yet, or the link may be wrong.</p>
            </main>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="cp-public">
      <CoursePageView model={model} top={top} />
    </div>
  )
}
