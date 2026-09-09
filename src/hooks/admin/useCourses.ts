import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type Course = Tables<'courses'>
export type CourseStatus = 'draft' | 'published' | 'archived'
export type LifecycleAction = 'publish' | 'archive' | 'restore'

export const coursesQueryKey = ['admin', 'courses'] as const

/** Postgres unique-violation — surfaced as an inline slug error, not a toast. */
const UNIQUE_VIOLATION = '23505'
export const SLUG_TAKEN = 'SLUG_TAKEN'

function mapWriteError(error: { code?: string; message: string }): Error {
  if (error.code === UNIQUE_VIOLATION && error.message.includes('slug')) {
    return new Error(SLUG_TAKEN)
  }
  return new Error(error.message)
}

/**
 * Which lifecycle transitions are offered for a given status. Shared by the
 * list rows and the edit page so the two can't drift apart.
 */
export function lifecycleActionsFor(status: string): LifecycleAction[] {
  switch (status) {
    case 'draft':
      return ['publish', 'archive']
    case 'published':
      return ['archive']
    case 'archived':
      return ['restore']
    default:
      return []
  }
}

export const LIFECYCLE_LABEL: Record<LifecycleAction, string> = {
  publish: 'Publish',
  archive: 'Archive',
  restore: 'Restore to draft',
}

/**
 * Every course in one query — the catalog is tiny (0 rows today) and the
 * table sorts, filters and paginates client-side. Revisit if it grows into
 * the hundreds.
 */
export function useCourses() {
  return useQuery({
    queryKey: coursesQueryKey,
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: [...coursesQueryKey, courseId],
    queryFn: async (): Promise<Course | null> => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle()

      if (error) throw new Error(error.message)
      return data
    },
  })
}

/** Fields the form owns. `status`, `published_at` and the cached counters aren't among them. */
export interface CourseFormValues {
  title: string
  slug: string
  subtitle: string
  description: string
  thumbnail_url: string
  is_free: boolean
  price_amount: string
  currency: string
  access_type: string
  access_duration_days: string
  enrollment_status: string
  default_lesson_xp: string
  gamification_enabled: boolean
}

/** Normalises form strings into the column types, blanks into nulls. */
function toRow(values: CourseFormValues) {
  const isFixed = values.access_type === 'fixed'
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    subtitle: values.subtitle.trim() || null,
    description: values.description.trim() || null,
    thumbnail_url: values.thumbnail_url.trim() || null,
    is_free: values.is_free,
    price_amount: values.is_free ? null : Number(values.price_amount),
    currency: values.currency,
    access_type: values.access_type,
    access_duration_days: isFixed ? Number(values.access_duration_days) : null,
    enrollment_status: values.enrollment_status,
    default_lesson_xp: Number(values.default_lesson_xp),
    gamification_enabled: values.gamification_enabled,
  }
}

function useCoursesInvalidator() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: coursesQueryKey })
}

export function useCreateCourse() {
  const invalidate = useCoursesInvalidator()
  return useMutation({
    mutationFn: async (values: CourseFormValues): Promise<Course> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('courses')
        // Always born a draft — status isn't a form field, and published_at
        // stays null until an explicit Publish action.
        .insert({ ...toRow(values), status: 'draft', created_by: user?.id ?? null })
        .select()
        .single()

      if (error) throw mapWriteError(error)
      return data
    },
    onSuccess: () => invalidate(),
  })
}

export function useUpdateCourse() {
  const invalidate = useCoursesInvalidator()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CourseFormValues }) => {
      const { error } = await supabase.from('courses').update(toRow(values)).eq('id', id)
      if (error) throw mapWriteError(error)
    },
    onSuccess: () => invalidate(),
  })
}

/**
 * Publish / Archive / Restore. Publish stamps `published_at` **only when it
 * is still null** — no trigger maintains this column, and re-publishing after
 * an archive must not overwrite the original first-published date.
 */
export function useCourseLifecycle() {
  const invalidate = useCoursesInvalidator()
  return useMutation({
    mutationFn: async ({ course, action }: { course: Course; action: LifecycleAction }) => {
      const patch: Partial<Course> =
        action === 'publish'
          ? {
              status: 'published',
              ...(course.published_at ? {} : { published_at: new Date().toISOString() }),
            }
          : action === 'archive'
            ? { status: 'archived' }
            : { status: 'draft' }

      const { error } = await supabase.from('courses').update(patch).eq('id', course.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_result, { course, action }) => {
      invalidate()
      const message =
        action === 'publish'
          ? `“${course.title}” is now published.`
          : action === 'archive'
            ? `“${course.title}” was archived.`
            : `“${course.title}” was restored to draft.`
      toast.success(message)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
