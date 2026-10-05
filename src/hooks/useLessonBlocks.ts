import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toEngineError, type LessonEngineError } from '@/lib/lessonEngine'
import { toBlocks, type LessonBlock } from '@/lib/lessonBlocks'

const lessonBlocksKey = (lessonId: string) => ['lesson', 'blocks', lessonId] as const

/**
 * A doc lesson's content blocks in `position` order. RLS decides what the caller
 * may read (an enrolled student, published lessons only), so a lesson they cannot
 * read comes back as no rows, which the page treats like a lesson with no blocks.
 * `enabled` is false for every lesson type that has no blocks.
 */
export function useLessonBlocks(lessonId: string, enabled: boolean) {
  return useQuery<LessonBlock[], LessonEngineError>({
    queryKey: lessonBlocksKey(lessonId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_content_blocks')
        .select('id, position, block_type, text_content, callout_color, callout_icon, image_url, image_alt')
        .eq('lesson_id', lessonId)
        .order('position', { ascending: true })
      if (error) throw toEngineError(error)
      return toBlocks(data ?? [])
    },
  })
}
