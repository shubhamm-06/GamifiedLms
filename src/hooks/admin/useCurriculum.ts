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
  const queryClient = useQueryClient()
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

  /**
   * Drag reorder can move an item across several siblings in one drop, not
   * just swap two neighbors, so this takes every module whose `position`
   * actually changed and writes them in a single request. `upsert` is given
   * the complete row for each (not just `id`/`position`), because Postgres
   * validates NOT NULL columns against the row `ON CONFLICT DO UPDATE`
   * builds even though only the provided columns end up written — a
   * partial `{ id, position }` payload would fail that check for columns
   * like `title`.
   */
  const reorder = useMutation({
    mutationFn: async (changed: Module[]) => {
      if (changed.length === 0) return
      const { error } = await supabase.from('modules').upsert(changed, { onConflict: 'id' })
      if (error) throw new Error(error.message)
    },
    // Without this, the dropped order only appears once this round-trip
    // resolves — dnd-kit resets its internal drag transforms the instant
    // the pointer is released, based on whatever `modules` still is at that
    // exact moment (the pre-drag order, since nothing's updated it yet), so
    // the whole list visibly snaps back and then jumps again ~1s later once
    // the refetch lands. Setting the cache here, synchronously, closes that
    // window entirely — the "drop" position and the "rendered" position
    // become the same thing in the same tick.
    onMutate: async (changed) => {
      await queryClient.cancelQueries({ queryKey: curriculumKeys.modules(courseId) })
      const previous = queryClient.getQueryData<Module[]>(curriculumKeys.modules(courseId))
      if (previous) {
        const changedById = new Map(changed.map((item) => [item.id, item]))
        queryClient.setQueryData<Module[]>(
          curriculumKeys.modules(courseId),
          previous
            .map((item) => changedById.get(item.id) ?? item)
            .sort((a, b) => a.position - b.position),
        )
      }
      return { previous }
    },
    onError: (e: Error, _changed, context) => {
      if (context?.previous) queryClient.setQueryData(curriculumKeys.modules(courseId), context.previous)
      toast.error(e.message)
    },
    onSettled: invalidate,
  })

  return { create, rename, remove, reorder }
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
  const queryClient = useQueryClient()
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

  /**
   * Same batch-upsert reasoning as the module reorder, plus the same
   * optimistic-cache fix for the same drop-then-snap-back jank. One wrinkle
   * here: `useLessons` caches one flat, course-wide, position-ordered array
   * that `CurriculumTab` groups into per-topic buckets client-side by
   * `module_id`, so `changed` is only ever the affected topics' rows, not
   * the whole course. Overwriting the cache with just that subset would
   * silently drop every lesson in every other topic. Instead, `changed` is
   * merged into the full previous array by id and the result re-sorted by
   * `position` — mirroring exactly what the query's own `.order('position')`
   * does, so the client-side grouping (which relies on array order, not a
   * fresh sort of its own) produces the identical result a refetch would.
   *
   * A row here can carry a changed `module_id` as well as a changed
   * `position`: dragging a lesson into a different topic is one mutation
   * covering the move itself plus the renumbering of both the topic it left
   * and the one it joined. `position` is scoped per topic, so the sort above
   * can see duplicate values across topics — it stays correct because
   * `Array.prototype.sort` is stable and positions are unique *within* a
   * topic, which is the only ordering the grouping actually reads.
   */
  const reorder = useMutation({
    mutationFn: async (changed: Lesson[]) => {
      if (changed.length === 0) return
      const { error } = await supabase.from('lessons').upsert(changed, { onConflict: 'id' })
      if (error) throw new Error(error.message)
    },
    onMutate: async (changed) => {
      await queryClient.cancelQueries({ queryKey: curriculumKeys.lessons(courseId) })
      const previous = queryClient.getQueryData<Lesson[]>(curriculumKeys.lessons(courseId))
      if (previous) {
        const changedById = new Map(changed.map((item) => [item.id, item]))
        queryClient.setQueryData<Lesson[]>(
          curriculumKeys.lessons(courseId),
          previous
            .map((item) => changedById.get(item.id) ?? item)
            .sort((a, b) => a.position - b.position),
        )
      }
      return { previous }
    },
    onError: (e: Error, _changed, context) => {
      if (context?.previous) queryClient.setQueryData(curriculumKeys.lessons(courseId), context.previous)
      toast.error(e.message)
    },
    onSettled: invalidate,
  })

  return { create, update, remove, reorder }
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
