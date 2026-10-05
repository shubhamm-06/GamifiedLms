import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/slug'

type CourseRef = { status: 'pending' } | { status: 'missing' } | { status: 'ready'; id: string }

/**
 * Resolves the `$courseId` URL segment of `/courses/$courseId`, which is a course SLUG (the shareable
 * form) or, for older links and the app's internal navigation, a course id. Everything below this
 * (the roadmap, the engine, the player) works on the id.
 *
 * - An id is `ready` immediately, with no lookup in the way (the page loads exactly as it did before slugs
 *   were in URLs), and the slug is fetched in the background so the address bar can be rewritten to
 *   `/courses/<slug>` (replace, so Back is not trapped; the current `?open=` search is kept).
 * - A slug is looked up (published and live under `courses_select_published_or_admin`, like every other
 *   read of a course here); not found, draft, archived or trashed all resolve to `missing`.
 */
export function useCourseRef(ref: string): CourseRef {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const byId = isUuid(ref)
  const key = ref.toLowerCase()
  const lookup = useQuery({
    queryKey: ['course', 'ref', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, slug')
        .eq(byId ? 'id' : 'slug', key)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const row = lookup.data
  const slug = row?.slug
  useEffect(() => {
    if (byId && row && slug) {
      // Seed the slug's own cache entry first: the address change makes `ref` the slug, and without this
      // the roadmap would unmount behind a loading state while the same row is fetched a second time.
      queryClient.setQueryData(['course', 'ref', slug], row)
      void navigate({ to: '/courses/$courseId', params: { courseId: slug }, search: (prev) => prev, replace: true, resetScroll: false })
    }
  }, [byId, row, slug, navigate, queryClient])

  if (byId) return { status: 'ready', id: key }
  if (lookup.isPending) return { status: 'pending' }
  if (!lookup.data) return { status: 'missing' }
  return { status: 'ready', id: lookup.data.id }
}
