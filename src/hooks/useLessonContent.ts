import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LessonEngineError, isRetryableEngineError, toEngineError } from '@/lib/lessonEngine'
import {
  asPlayerType,
  parseQuizOptions,
  type GameInfo,
  type LessonContent,
  type QuizQuestionView,
} from '@/lib/lessonPlayer'

export const lessonContentKey = (lessonId: string) => ['lesson', 'content', lessonId] as const
export const quizQuestionsKey = (lessonId: string) => ['lesson', 'questions', lessonId] as const
export const enrollmentStatusKey = (courseId: string) => ['lesson', 'enrollmentStatus', courseId] as const

export interface LoadedLesson {
  lesson: LessonContent
  game: GameInfo | null
}

/**
 * What a student may read to play one lesson: the lesson row (RLS: enrolled,
 * live), its effective XP (the view, never re-derived here), the course's
 * gamification flag (so XP is not promised where none is awarded) and, for a
 * game lesson, the game's bundle. `lessons.status = 'published'` is filtered
 * here because RLS lets an enrolled student read draft rows directly. A null
 * result means "not available to this student" (unpublished, trashed, hidden).
 */
async function fetchLesson(lessonId: string): Promise<LoadedLesson | null> {
  const [lessonRes, xpRes] = await Promise.all([
    supabase
      .from('lessons')
      .select(
        'id, course_id, title, summary, content_type, video_url, content_html, game_id, min_time_seconds, pass_percentage, courses(gamification_enabled)',
      )
      .eq('id', lessonId)
      .eq('status', 'published')
      .maybeSingle(),
    supabase.from('lesson_effective_xp').select('effective_xp').eq('lesson_id', lessonId).maybeSingle(),
  ])
  if (lessonRes.error) throw toEngineError(lessonRes.error)
  if (xpRes.error) throw toEngineError(xpRes.error)
  const row = lessonRes.data
  if (!row) return null

  const course = Array.isArray(row.courses) ? row.courses[0] : row.courses
  const lesson: LessonContent = {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    summary: row.summary,
    type: asPlayerType(row.content_type),
    videoUrl: row.video_url,
    contentHtml: row.content_html,
    gameId: row.game_id,
    minTimeSeconds: row.min_time_seconds,
    passPercentage: row.pass_percentage,
    xp: xpRes.data?.effective_xp ?? null,
    gamificationEnabled: course?.gamification_enabled ?? true,
  }

  let game: GameInfo | null = null
  if (lesson.type === 'game' && row.game_id) {
    const g = await supabase
      .from('games')
      .select('id, title, bundle_url, bundle_version, orientation')
      .eq('id', row.game_id)
      .maybeSingle()
    if (g.error) throw toEngineError(g.error)
    if (g.data) {
      const o = g.data.orientation
      game = {
        id: g.data.id,
        title: g.data.title,
        bundleUrl: g.data.bundle_url,
        bundleVersion: g.data.bundle_version,
        orientation: o === 'portrait' || o === 'landscape' ? o : 'any',
      }
    }
  }
  return { lesson, game }
}

export function useLessonContent(lessonId: string, enabled: boolean) {
  return useQuery<LoadedLesson | null, LessonEngineError>({
    queryKey: lessonContentKey(lessonId),
    queryFn: () => fetchLesson(lessonId),
    enabled,
    retry: (count, error) => count < 2 && isRetryableEngineError(error),
    // A lesson can be unpublished or edited while a child is on it; refetch on focus is fine.
  })
}

/**
 * Only used to pick better copy for a `not_enrolled` refusal: whether THIS
 * student has an `expired` enrollment row for this course (own-row read,
 * `enrollments_select_self`), as opposed to never having enrolled at all. It
 * never changes what the engine decides — `fn_course_lesson_states` already
 * refused the page before this is asked, and it does not affect the answer.
 */
export function useEnrollmentStatus(courseId: string, enabled: boolean) {
  return useQuery<'expired' | 'other' | null, LessonEngineError>({
    queryKey: enrollmentStatusKey(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('status')
        .eq('course_id', courseId)
        .maybeSingle()
      if (error) throw toEngineError(error)
      if (!data) return null
      return data.status === 'expired' ? 'expired' : 'other'
    },
    enabled,
    retry: false,
  })
}

/**
 * The questions of an unlocked quiz through `quiz_questions_public`: prompt and
 * options only. The correct option and the explanation are not in that view, so
 * neither can reach the browser before a graded submission (`rules.md`).
 */
export function useQuizQuestions(lessonId: string, enabled: boolean) {
  return useQuery<QuizQuestionView[], LessonEngineError>({
    queryKey: quizQuestionsKey(lessonId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quiz_questions_public')
        .select('id, prompt, options, position')
        .eq('lesson_id', lessonId)
        .order('position', { ascending: true })
      if (error) throw toEngineError(error)
      return (data ?? [])
        .filter((q): q is typeof q & { id: string; prompt: string } => !!q.id && !!q.prompt)
        .map((q) => ({ id: q.id, prompt: q.prompt, options: parseQuizOptions(q.options) }))
    },
    enabled,
    // Questions do not change mid-attempt from the child's side; never refetch on focus.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: (count, error) => count < 2 && isRetryableEngineError(error),
  })
}
