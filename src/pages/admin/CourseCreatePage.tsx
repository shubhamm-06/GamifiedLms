import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { CourseBuilder } from '@/components/admin/courses/CourseBuilder'
import { CourseForm } from '@/components/admin/courses/CourseForm'
import { ENROLL_URL_INVALID, SLUG_INVALID, SLUG_TAKEN, useCreateCourse, type CourseFormValues } from '@/hooks/admin/useCourses'
import { getTerms as tw } from '@/lib/settings/terms'

export function CourseCreatePage() {
  const navigate = useNavigate()
  const createCourse = useCreateCourse()
  const [slugError, setSlugError] = useState<string | null>(null)
  const [enrollUrlError, setEnrollUrlError] = useState<string | null>(null)

  function handleSubmit(values: CourseFormValues) {
    setSlugError(null)
    setEnrollUrlError(null)
    createCourse.mutate(values, {
      onSuccess: (course) => {
        toast.success(`“${course.title}” created as a draft.`)
        // Straight into Curriculum — building it out is the natural next
        // step once the course row exists.
        navigate({
          to: '/admin/courses/$courseId/edit',
          params: { courseId: course.id },
          search: { tab: 'curriculum' },
        })
      },
      onError: (error: Error) => {
        if (error.message === SLUG_INVALID) {
          setSlugError('Use lowercase letters, numbers and single hyphens, up to 80 characters.')
          return
        }
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
    })
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{`New ${tw().lower('course')}`}</h1>
        <p className="text-muted-foreground text-sm">
          Saved as a draft — add curriculum next, then publish when ready.
        </p>
      </header>

      <CourseBuilder
        tab="basics"
        // No course row exists yet, so there is nothing to hang topics or
        // lessons off — the tab stays locked until the first save.
        curriculumLocked
        onTabChange={() => undefined}
        basics={
          <CourseForm
            mode="create"
            submitLabel="Save & continue"
            isSubmitting={createCourse.isPending}
            externalErrors={{
              ...(slugError ? { slug: slugError } : {}),
              ...(enrollUrlError ? { enroll_url: enrollUrlError } : {}),
            }}
            onSubmit={handleSubmit}
            onCancel={() => navigate({ to: '/admin/courses' })}
          />
        }
        curriculum={null}
        page={null}
      />
    </div>
  )
}
