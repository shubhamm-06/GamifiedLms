import { useState } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CourseBuilder, type CourseTab } from '@/components/admin/courses/CourseBuilder'
import { CourseForm } from '@/components/admin/courses/CourseForm'
import { CourseStatusPill } from '@/components/admin/courses/CourseStatusPill'
import { CurriculumTab } from '@/components/admin/courses/CurriculumTab'
import {
  ENROLL_URL_INVALID,
  lifecycleActionsFor,
  LIFECYCLE_LABEL,
  SLUG_TAKEN,
  useCourse,
  useCourseLifecycle,
  useUpdateCourse,
  type Course,
  type CourseFormValues,
} from '@/hooks/admin/useCourses'

const publishedFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function toFormValues(course: Course): CourseFormValues {
  return {
    title: course.title,
    slug: course.slug,
    subtitle: course.subtitle ?? '',
    description: course.description ?? '',
    thumbnail_url: course.thumbnail_url ?? '',
    is_free: course.is_free,
    price_amount: course.price_amount == null ? '' : String(course.price_amount),
    currency: course.currency,
    access_type: course.access_type,
    access_duration_days:
      course.access_duration_days == null ? '' : String(course.access_duration_days),
    enrollment_status: course.enrollment_status,
    default_lesson_xp: String(course.default_lesson_xp),
    gamification_enabled: course.gamification_enabled,
    enroll_url: course.enroll_url ?? '',
  }
}

export function CourseEditPage() {
  const { courseId } = useParams({ from: '/admin/courses/$courseId/edit' })
  const { tab } = useSearch({ from: '/admin/courses/$courseId/edit' })
  const navigate = useNavigate()
  const { data: course, isPending, isError } = useCourse(courseId)
  const updateCourse = useUpdateCourse()
  const lifecycle = useCourseLifecycle()
  const [slugError, setSlugError] = useState<string | null>(null)
  const [enrollUrlError, setEnrollUrlError] = useState<string | null>(null)

  if (isPending) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // A bad id and an RLS-hidden row look identical from here, and both mean
  // the same thing to the admin: there's nothing to edit.
  if (isError || !course) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="font-medium">Course not found</p>
        <p className="text-muted-foreground mt-1 text-sm">
          It may have been removed, or the link is wrong.
        </p>
        <Link to="/admin/courses" className="text-teal-d mt-3 inline-block text-sm hover:underline">
          Back to courses
        </Link>
      </div>
    )
  }

  function handleSubmit(values: CourseFormValues) {
    setSlugError(null)
    setEnrollUrlError(null)
    updateCourse.mutate(
      { id: courseId, values },
      {
        onSuccess: () => {
          toast.success('Course updated.')
          navigate({ to: '/admin/courses' })
        },
        onError: (error: Error) => {
          if (error.message === SLUG_TAKEN) {
            setSlugError('This slug is already in use.')
            return
          }
          if (error.message === ENROLL_URL_INVALID) {
            setEnrollUrlError('Must be a valid https:// link, no spaces, 2048 characters or fewer.')
            return
          }
          toast.error(error.message)
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex max-w-3xl items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{course.title}</h1>
          <p className="text-muted-foreground text-sm">Edit course</p>
        </div>
        {/* Student-facing page in a new tab, whatever the status. It sits in the
            page header rather than beside the lifecycle buttons because that row
            is already full at narrow admin widths (an archived course wrapped
            at 720 px and pushed the tabs down). Relative typed link, so no host
            is hardcoded. An admin who isn't enrolled sees the not-enrolled
            screen there — by design for now. */}
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link
            to="/courses/$courseId"
            params={{ courseId }}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View course: ${course.title} (opens in a new tab)`}
          >
            <ExternalLink />
            View course
          </Link>
        </Button>
      </header>

      <section className="max-w-3xl space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CourseStatusPill status={course.status} />
            {course.published_at ? (
              <span className="text-muted-foreground text-sm">
                Published {publishedFormatter.format(new Date(course.published_at))}
              </span>
            ) : null}
          </div>
          {/* Lifecycle is separate from "Save changes" on purpose — these
              take effect immediately and don't submit the form. */}
          <div className="flex gap-2">
            {lifecycleActionsFor(course.status).map((action) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate({ course, action })}
              >
                {LIFECYCLE_LABEL[action]}
              </Button>
            ))}
          </div>
        </div>

        {/* Trigger-maintained counters, shown read-only so they aren't
            mistaken for form fields sitting right below. */}
        <p className="text-muted-foreground border-t pt-3 text-xs">
          {course.total_students} {course.total_students === 1 ? 'student' : 'students'} ·{' '}
          {course.total_lessons} {course.total_lessons === 1 ? 'lesson' : 'lessons'} · maintained
          automatically
        </p>
      </section>

      <CourseBuilder
        tab={tab}
        // Tab lives in the URL so it survives a refresh and can be linked to
        // (the create flow lands directly on ?tab=curriculum).
        onTabChange={(next: CourseTab) =>
          navigate({
            to: '/admin/courses/$courseId/edit',
            params: { courseId },
            search: { tab: next },
            replace: true,
          })
        }
        curriculumLocked={false}
        basics={
          <CourseForm
            mode="edit"
            initialValues={toFormValues(course)}
            isSubmitting={updateCourse.isPending}
            externalErrors={{
              ...(slugError ? { slug: slugError } : {}),
              ...(enrollUrlError ? { enroll_url: enrollUrlError } : {}),
            }}
            onSubmit={handleSubmit}
            onCancel={() => navigate({ to: '/admin/courses' })}
          />
        }
        curriculum={<CurriculumTab courseId={courseId} />}
      />
    </div>
  )
}
