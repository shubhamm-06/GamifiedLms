import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useCourseCount() {
  return useQuery({
    queryKey: ['courses', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })

      if (error) throw error
      return count ?? 0
    },
  })
}
