import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/lib/database.types'

export type Module = Tables<'modules'>
export type Lesson = Tables<'lessons'>
export type QuizQuestion = Tables<'quiz_questions'>
export type Game = Tables<'games'>

export type ContentType = 'video' | 'text' | 'quiz' | 'game'

/**
 * An option is `{ id, text }` rather than a bare string, and `correct_option`
 * stores the **id**. Editing an option's wording then leaves the answer key
 * intact — with bare strings, a typo fix would silently orphan
 * `correct_option` and the question could never be answered correctly.
 */
export interface QuizOption {
  id: string
  text: string
}

/**
 * `options` is a `jsonb` column typed as the generated `Json`, which requires
 * an index signature that a precise interface deliberately doesn't have.
 * Narrowing happens on read via `parseOptions`; this is the write boundary.
 */
function optionsToJson(options: QuizOption[]): Json {
  return options as unknown as Json
}

export const curriculumKeys = {
  modules: (courseId: string) => ['admin', 'curriculum', 'modules', courseId] as const,
  lessons: (courseId: string) => ['admin', 'curriculum', 'lessons', courseId] as const,
  questions: (lessonId: string) => ['admin', 'curriculum', 'questions', lessonId] as const,
  games: ['admin', 'curriculum', 'games'] as const,
}

/** Postgres FK violation — a lesson with student activity can't be deleted. */
const FK_VIOLATION = '23503'
export const LESSON_IN_USE = 'LESSON_IN_USE'

export function parseOptions(raw: unknown): QuizOption[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (entry && typeof entry === 'object' && 'id' in entry && 'text' in entry) {
      return [{ id: String(entry.id), text: String(entry.text) }]
    }
    // Tolerates a bare-string row written by hand or by an earlier shape.
    if (typeof entry === 'string') return [{ id: entry, text: entry }]
    return []
  })
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function useModules(courseId: string) {
  return useQuery({
    queryKey: curriculumKeys.modules(courseId),
    queryFn: async (): Promise<Module[]> => {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useLessons(courseId: string) {
  return useQuery({
    queryKey: curriculumKeys.lessons(courseId),
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useQuizQuestions(lessonId: string | null) {
  return useQuery({
    queryKey: curriculumKeys.questions(lessonId ?? 'none'),
    enabled: !!lessonId,
    queryFn: async (): Promise<QuizQuestion[]> => {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('lesson_id', lessonId!)
        .order('position', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/** Populates the game picker for `content_type = 'game'`. */
export function useGames() {
  return useQuery({
    queryKey: curriculumKeys.games,
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase.from('games').select('*').order('title')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function useCurriculumInvalidator(courseId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: curriculumKeys.modules(courseId) })
    queryClient.invalidateQueries({ queryKey: curriculumKeys.lessons(courseId) })
    // total_lessons is trigger-maintained on courses, so the course row and
    // the list that shows the counter both need refreshing.
    queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] })
  }
}

export function useModuleMutations(courseId: string) {
  const invalidate = useCurriculumInvalidator(courseId)

  const create = useMutation({
    mutationFn: async ({ title, position }: { title: string; position: number }) => {
      const { error } = await supabase
        .from('modules')
        .insert({ course_id: courseId, title, position })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Topic added.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from('modules').update({ title }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // lessons.module_id is ON DELETE SET NULL — the lessons survive and
      // fall into "Ungrouped" rather than being destroyed.
      const { error } = await supabase.from('modules').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Topic deleted. Its lessons moved to Ungrouped.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Module; b: Module }) => {
      const [first, second] = await Promise.all([
        supabase.from('modules').update({ position: b.position }).eq('id', a.id),
        supabase.from('modules').update({ position: a.position }).eq('id', b.id),
      ])
      if (first.error) throw new Error(first.error.message)
      if (second.error) throw new Error(second.error.message)
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  return { create, rename, remove, swap }
}

export interface LessonFormValues {
  title: string
  summary: string
  content_type: ContentType
  video_url: string
  content_html: string
  game_id: string
  duration_seconds: string
  xp_reward: string
  is_preview: boolean
  status: string
}

/** Only the column matching the chosen content_type is persisted. */
function lessonToRow(values: LessonFormValues) {
  return {
    title: values.title.trim(),
    summary: values.summary.trim() || null,
    content_type: values.content_type,
    video_url: values.content_type === 'video' ? values.video_url.trim() || null : null,
    content_html: values.content_type === 'text' ? values.content_html.trim() || null : null,
    game_id: values.content_type === 'game' ? values.game_id.trim() || null : null,
    duration_seconds: values.duration_seconds.trim() ? Number(values.duration_seconds) : null,
    xp_reward: values.xp_reward.trim() ? Number(values.xp_reward) : null,
    is_preview: values.is_preview,
    status: values.status,
  }
}

export function useLessonMutations(courseId: string) {
  const invalidate = useCurriculumInvalidator(courseId)

  const create = useMutation({
    mutationFn: async ({
      values,
      moduleId,
      position,
    }: {
      values: LessonFormValues
      moduleId: string | null
      position: number
    }) => {
      const { error } = await supabase.from('lessons').insert({
        ...lessonToRow(values),
        course_id: courseId,
        module_id: moduleId,
        position,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Lesson added.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: LessonFormValues }) => {
      const { error } = await supabase.from('lessons').update(lessonToRow(values)).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Lesson saved.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lessons').delete().eq('id', id)
      // lesson_progress and quiz_attempts are NO ACTION: once any student has
      // touched this lesson the delete is refused at the database level.
      if (error?.code === FK_VIOLATION) throw new Error(LESSON_IN_USE)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Lesson deleted.')
    },
    onError: (e: Error) =>
      toast.error(
        e.message === LESSON_IN_USE
          ? "This lesson has student activity and can't be deleted — unpublish it instead."
          : e.message,
      ),
  })

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Lesson; b: Lesson }) => {
      const [first, second] = await Promise.all([
        supabase.from('lessons').update({ position: b.position }).eq('id', a.id),
        supabase.from('lessons').update({ position: a.position }).eq('id', b.id),
      ])
      if (first.error) throw new Error(first.error.message)
      if (second.error) throw new Error(second.error.message)
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  return { create, update, remove, swap }
}

export interface QuestionFormValues {
  prompt: string
  options: QuizOption[]
  correct_option: string
  explanation: string
}

export function useQuestionMutations(lessonId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: curriculumKeys.questions(lessonId) })

  const create = useMutation({
    mutationFn: async ({ values, position }: { values: QuestionFormValues; position: number }) => {
      const { error } = await supabase.from('quiz_questions').insert({
        lesson_id: lessonId,
        prompt: values.prompt.trim(),
        options: optionsToJson(values.options),
        correct_option: values.correct_option,
        explanation: values.explanation.trim() || null,
        position,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Question added.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: QuestionFormValues }) => {
      const { error } = await supabase
        .from('quiz_questions')
        .update({
          prompt: values.prompt.trim(),
          options: optionsToJson(values.options),
          correct_option: values.correct_option,
          explanation: values.explanation.trim() || null,
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Question saved.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Nothing references quiz_questions.id, so this is unconditionally safe.
      const { error } = await supabase.from('quiz_questions').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Question deleted.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: QuizQuestion; b: QuizQuestion }) => {
      const [first, second] = await Promise.all([
        supabase.from('quiz_questions').update({ position: b.position }).eq('id', a.id),
        supabase.from('quiz_questions').update({ position: a.position }).eq('id', b.id),
      ])
      if (first.error) throw new Error(first.error.message)
      if (second.error) throw new Error(second.error.message)
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  return { create, update, remove, swap }
}
