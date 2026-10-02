import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { describePageWriteError, toPageRow, type PageFormValues, type PageRow } from '@/lib/coursePageForm'
import { coursesQueryKey } from './useCourses'

/**
 * Saves the "Course page" tab. Writes ONLY the page columns (`toPageRow` is the whole
 * payload, so a bad/stale form can never touch title, price, status, enrollment link
 * or any other course field; `thumbnail_url` is included because the cover image IS the
 * course thumbnail, one column shared with the Basics tab) and surfaces the database's own CHECK errors as readable
 * text — the backstop behind the form's validation. Returns the cleaned row so the
 * editor can reset its baseline to exactly what was saved.
 */
export function useUpdateCoursePage(courseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: PageFormValues): Promise<PageRow> => {
      const row = toPageRow(values)
      const { error } = await supabase
        .from('courses')
        .update({
          ...row,
          faqs: row.faqs as unknown as Json,
          page_layout: row.page_layout as unknown as Json,
          page_options: row.page_options as unknown as Json,
          testimonials: row.testimonials as unknown as Json,
        })
        .eq('id', courseId)
      if (error) throw new Error(describePageWriteError(error.message))
      return row
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: coursesQueryKey })
      // The student page reads the same row; drop its cache so the next open is fresh.
      void queryClient.invalidateQueries({ queryKey: ['course', 'info'] })
    },
  })
}
