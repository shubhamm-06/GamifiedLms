import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { CourseForm } from '@/components/admin/courses/CourseForm'
import { SLUG_TAKEN, useCreateCourse, type CourseFormValues } from '@/hooks/admin/useCourses'

export function CourseCreatePage() {
  const navigate = useNavigate()
  const createCourse = useCreateCourse()
  const [slugError, setSlugError] = useState<string | null>(null)

  function handleSubmit(values: CourseFormValues) {
    setSlugError(null)
    createCourse.mutate(values, {
      onSuccess: (course) => {
        toast.success(`“${course.title}” created as a draft.`)
        navigate({ to: '/admin/courses' })
      },
      onError: (error: Error) => {
        // A slug clash belongs under the field that caused it, not in a toast
        // the user has to map back to an input themselves.
        if (error.message === SLUG_TAKEN) {
          setSlugError('This slug is already in use.')
          return
        }
        toast.error(error.message)
      },
    })
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">New course</h1>
        <p className="text-muted-foreground text-sm">
          Saved as a draft — publish it once it&rsquo;s ready.
        </p>
      </header>

      <CourseForm
        mode="create"
        isSubmitting={createCourse.isPending}
        externalErrors={slugError ? { slug: slugError } : undefined}
        onSubmit={handleSubmit}
        onCancel={() => navigate({ to: '/admin/courses' })}
      />
    </div>
  )
}
