import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/lib/database.types'
import { DEFAULT_PASS_PERCENTAGE, formatClock } from '@/lib/lessonSettings'
import { mapLimit } from '@/lib/trash'
import { describeFailures } from './useTrashActions'

export type Module = Tables<'modules'>
export type Lesson = Tables<'lessons'>
export type QuizQuestion = Tables<'quiz_questions'>

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
}

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
        // Trashed topics live on /admin/trash (migration 013); an admin's RLS
        // can read them, so the filter is what hides them here.
        .is('deleted_at', null)
        .order('position', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/**
 * Live lessons only: not trashed themselves, and not under a trashed topic.
 * Trashing a topic hides its lessons through the parent — the lesson rows are
 * never marked — so without the second query below they would reappear here as
 * "Ungrouped" (their `module_id` still points at the trashed topic).
 */
export function useLessons(courseId: string) {
  return useQuery({
    queryKey: curriculumKeys.lessons(courseId),
    queryFn: async (): Promise<Lesson[]> => {
      const [lessonsResult, trashedModulesResult] = await Promise.all([
        supabase
          .from('lessons')
          .select('*')
          .eq('course_id', courseId)
          .is('deleted_at', null)
          .order('position', { ascending: true }),
        supabase
          .from('modules')
          .select('id')
          .eq('course_id', courseId)
          .not('deleted_at', 'is', null),
      ])
      if (lessonsResult.error) throw new Error(lessonsResult.error.message)
      if (trashedModulesResult.error) throw new Error(trashedModulesResult.error.message)

      const hiddenModuleIds = new Set((trashedModulesResult.data ?? []).map((m) => m.id))
      return (lessonsResult.data ?? []).filter(
        (lesson) => !lesson.module_id || !hiddenModuleIds.has(lesson.module_id),
      )
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

  return { create, rename, reorder }
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
  /** Whole seconds, 0–3600; 0 = no minimum. Stored only — nothing enforces it yet. */
  min_time_seconds: string
  /** Whole percent, 1–100. Only meaningful for quizzes. Stored only — nothing enforces it yet. */
  pass_percentage: string
  is_preview: boolean
  status: string
}

/**
 * `pass_percentage` is quiz-only now (migration 028,
 * `lessons_pass_percentage_quiz_only_check`): every other type must save
 * NULL regardless of what the form field holds, since the field isn't even
 * rendered for them, and a quiz always saves a concrete value.
 */
function passPercentageForSave(values: LessonFormValues): number | null {
  if (values.content_type !== 'quiz') return null
  const n = Number(values.pass_percentage)
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : DEFAULT_PASS_PERCENTAGE
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
    min_time_seconds: Number(values.min_time_seconds),
    pass_percentage: passPercentageForSave(values),
    is_preview: values.is_preview,
    status: values.status,
  }
}

const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

/**
 * A failed lesson insert/update as an Error. A CHECK violation means a setting
 * is out of range (client validation should have caught it); everything else
 * keeps the existing behaviour of showing the message.
 */
function lessonWriteError(error: { code?: string; message: string }): Error {
  if (error.code === CHECK_VIOLATION) {
    return new Error(
      'A setting is out of range — minimum time is 0 to 3600 seconds and the pass mark is 0 to 100.',
    )
  }
  return new Error(error.message)
}

/** A short sentence for a failed settings write — never a raw Postgres message. */
function settingWriteReason(error: { code?: string }): string {
  if (error.code === CHECK_VIOLATION) return "That value isn't allowed (0 to 3600 seconds)."
  if (error.code === INSUFFICIENT_PRIVILEGE) return "You don't have permission to do that."
  return 'Something went wrong. Please try again.'
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
      if (error) throw lessonWriteError(error)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Lesson added.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: LessonFormValues }) => {
      // `.select('id')` + the count is the check: RLS filters a write the caller
      // may not make (or a row that no longer exists) to zero rows and returns no
      // error, which used to read as a successful save.
      const { data, error } = await supabase
        .from('lessons')
        .update(lessonToRow(values))
        .eq('id', id)
        .select('id')
      if (error) throw lessonWriteError(error)
      if (!data || data.length !== 1) {
        throw new Error("This lesson couldn't be saved — it may have been deleted, or you may not have permission.")
      }
    },
    onSuccess: () => {
      invalidate()
      toast.success('Lesson saved.')
    },
    onError: (e: Error) => toast.error(e.message),
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

  return { create, update, reorder }
}

export interface MinTimeFailure {
  lesson: Lesson
  reason: string
}

export interface MinTimeResult {
  seconds: number
  succeeded: Lesson[]
  failed: MinTimeFailure[]
}

/**
 * Bulk "Set minimum time": one update per lesson, at most five in flight, so a
 * single failure never aborts the rest. Each write requests `.select('id')` and
 * must touch exactly one row — a lesson that was deleted meanwhile, or one RLS
 * refuses, matches nothing and returns no error, so the count is the check.
 *
 * Reports like a bulk trash: "N updated, M failed" with each failure's reason.
 * The caller keeps the failed lessons selected so they can be retried.
 */
export function useSetMinTime(courseId: string) {
  const invalidate = useCurriculumInvalidator(courseId)

  return useMutation({
    mutationFn: async ({
      lessons,
      seconds,
    }: {
      lessons: Lesson[]
      seconds: number
    }): Promise<MinTimeResult> => {
      const outcomes = await mapLimit(lessons, 5, async (lesson) => {
        const { data, error } = await supabase
          .from('lessons')
          .update({ min_time_seconds: seconds })
          .eq('id', lesson.id)
          .select('id')
        if (error) {
          console.error('[lessons] set minimum time failed:', error.code)
          return { lesson, reason: settingWriteReason(error) }
        }
        if (!data || data.length !== 1) {
          return { lesson, reason: "This lesson no longer exists or can't be changed." }
        }
        return { lesson, reason: null }
      })

      return {
        seconds,
        succeeded: outcomes.filter((o) => o.reason === null).map((o) => o.lesson),
        failed: outcomes.flatMap((o) => (o.reason === null ? [] : [{ lesson: o.lesson, reason: o.reason }])),
      }
    },
    onSuccess: ({ seconds, succeeded, failed }) => {
      const change = seconds === 0 ? 'turned off' : `set to ${formatClock(seconds)}`
      const n = succeeded.length
      const f = failed.length
      const detail = describeFailures(
        failed.map(({ lesson, reason }) => ({ item: { id: lesson.id, name: lesson.title }, reason })),
      )
      if (n > 0 && f === 0) {
        toast.success(
          n === 1
            ? `Minimum time ${change} on “${succeeded[0].title}”`
            : `Minimum time ${change} on ${n} lessons`,
        )
      } else if (n > 0) {
        toast.warning(`${n} updated, ${f} failed`, { description: detail })
      } else if (f > 0) {
        toast.error(f === 1 ? failed[0].reason : `${f} lessons could not be updated`, {
          description: f === 1 ? undefined : detail,
        })
      }
    },
    onSettled: invalidate,
  })
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

  /**
   * Drag reorder, same batch-upsert-plus-optimistic-cache shape as
   * `useModuleMutations`/`useLessonMutations` — a single flat list here, so
   * there's no cross-container merge to do, just a straight cache
   * replacement sorted by `position`.
   */
  const reorder = useMutation({
    mutationFn: async (changed: QuizQuestion[]) => {
      if (changed.length === 0) return
      const { error } = await supabase.from('quiz_questions').upsert(changed, { onConflict: 'id' })
      if (error) throw new Error(error.message)
    },
    onMutate: async (changed) => {
      await queryClient.cancelQueries({ queryKey: curriculumKeys.questions(lessonId) })
      const previous = queryClient.getQueryData<QuizQuestion[]>(curriculumKeys.questions(lessonId))
      if (previous) {
        const changedById = new Map(changed.map((item) => [item.id, item]))
        queryClient.setQueryData<QuizQuestion[]>(
          curriculumKeys.questions(lessonId),
          previous
            .map((item) => changedById.get(item.id) ?? item)
            .sort((a, b) => a.position - b.position),
        )
      }
      return { previous }
    },
    onError: (e: Error, _changed, context) => {
      if (context?.previous) queryClient.setQueryData(curriculumKeys.questions(lessonId), context.previous)
      toast.error(e.message)
    },
    onSettled: invalidate,
  })

  return { create, update, remove, reorder }
}

/* ------------------------------------------------------------------ */
/* Doc (text) lesson content blocks                                    */
/* ------------------------------------------------------------------ */

export type ContentBlock = Tables<'lesson_content_blocks'>
export type BlockType = 'paragraph' | 'callout' | 'image'

export const blockKeys = {
  blocks: (lessonId: string) => ['admin', 'curriculum', 'blocks', lessonId] as const,
}

export function useContentBlocks(lessonId: string | null) {
  return useQuery({
    queryKey: blockKeys.blocks(lessonId ?? 'none'),
    enabled: !!lessonId,
    queryFn: async (): Promise<ContentBlock[]> => {
      const { data, error } = await supabase
        .from('lesson_content_blocks')
        .select('*')
        .eq('lesson_id', lessonId!)
        .order('position', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/**
 * Exactly one shape per type, mirroring `lesson_content_blocks_shape_check`
 * (`schema.md`) so the form can never produce a row the database would
 * refuse — the columns that don't belong to `type` are always `null`, never
 * left over from switching a block's type mid-edit.
 */
export type BlockFormValues =
  | { type: 'paragraph'; text: string }
  | { type: 'callout'; text: string; color: string; icon: string }
  | { type: 'image'; url: string; alt: string }

function blockFormToRow(values: BlockFormValues) {
  switch (values.type) {
    case 'paragraph':
      return {
        block_type: 'paragraph',
        text_content: values.text.trim(),
        callout_color: null,
        callout_icon: null,
        image_url: null,
        image_alt: null,
      }
    case 'callout':
      return {
        block_type: 'callout',
        text_content: values.text.trim(),
        callout_color: values.color,
        callout_icon: values.icon,
        image_url: null,
        image_alt: null,
      }
    case 'image':
      return {
        block_type: 'image',
        text_content: null,
        callout_color: null,
        callout_icon: null,
        image_url: values.url.trim(),
        image_alt: values.alt.trim() || null,
      }
  }
}

export function useBlockMutations(lessonId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: blockKeys.blocks(lessonId) })

  const create = useMutation({
    mutationFn: async ({ values, position }: { values: BlockFormValues; position: number }) => {
      const { error } = await supabase
        .from('lesson_content_blocks')
        .insert({ lesson_id: lessonId, position, ...blockFormToRow(values) })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Block added.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: BlockFormValues }) => {
      const { error } = await supabase
        .from('lesson_content_blocks')
        .update(blockFormToRow(values))
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Block saved.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lesson_content_blocks').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Block deleted.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /** Same batch-upsert-plus-optimistic-cache shape as the quiz questions' own `reorder`. */
  const reorder = useMutation({
    mutationFn: async (changed: ContentBlock[]) => {
      if (changed.length === 0) return
      const { error } = await supabase.from('lesson_content_blocks').upsert(changed, { onConflict: 'id' })
      if (error) throw new Error(error.message)
    },
    onMutate: async (changed) => {
      await queryClient.cancelQueries({ queryKey: blockKeys.blocks(lessonId) })
      const previous = queryClient.getQueryData<ContentBlock[]>(blockKeys.blocks(lessonId))
      if (previous) {
        const changedById = new Map(changed.map((item) => [item.id, item]))
        queryClient.setQueryData<ContentBlock[]>(
          blockKeys.blocks(lessonId),
          previous
            .map((item) => changedById.get(item.id) ?? item)
            .sort((a, b) => a.position - b.position),
        )
      }
      return { previous }
    },
    onError: (e: Error, _changed, context) => {
      if (context?.previous) queryClient.setQueryData(blockKeys.blocks(lessonId), context.previous)
      toast.error(e.message)
    },
    onSettled: invalidate,
  })

  return { create, update, remove, reorder }
}
