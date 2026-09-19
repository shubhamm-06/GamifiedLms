import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useCourseCount() {
  return useQuery({
    queryKey: ['courses', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        // Trashed courses aren't counted (RLS hides them from students; an
        // admin can still read them, so filter here too).
        .is('deleted_at', null)

      if (error) throw error
      return count ?? 0
    },
  })
}
