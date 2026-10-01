import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LessonEngineError,
  checkQuizAnswer,
  completeGame,
  completeLesson,
  fetchCourseLessonStates,
  isRetryableEngineError,
  submitQuiz,
  type LessonStateRow,
  type QuizAnswers,
} from '@/lib/lessonEngine'

/**
 * TanStack Query hooks over `lib/lessonEngine.ts`. No screens use them yet.
 * Nothing here toasts: the (future) kid-side screens decide how a refusal
 * looks. Errors are always `LessonEngineError` with a stable `.code`.
 *
 * Caching rule: the states query is the single source of truth for what is
 * locked, so anything that can change it invalidates it — completing a lesson
 * or passing a quiz. Heartbeats do NOT (one every ~10 s would refetch the
 * whole course); they patch the affected row in place instead.
 */

export const lessonEngineKeys = {
  all: ['lessonEngine'] as const,
  states: (courseId: string) => ['lessonEngine', 'states', courseId] as const,
}

/** Retry only what may simply not have arrived; a refusal (locked, too_early, …) is final. */
const retryTransient = (failureCount: number, error: Error) =>
  failureCount < 3 && isRetryableEngineError(error)

export function useCourseLessonStates(courseId: string | undefined) {
  return useQuery<LessonStateRow[], LessonEngineError>({
    queryKey: lessonEngineKeys.states(courseId ?? ''),
    queryFn: () => fetchCourseLessonStates(courseId!),
    enabled: !!courseId,
    retry: retryTransient,
  })
}

/** Idempotent, so a transient failure is retried automatically. */
export function useCompleteLesson(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation<Awaited<ReturnType<typeof completeLesson>>, LessonEngineError, string>({
    mutationFn: completeLesson,
    retry: retryTransient,
    onSuccess: () => {
      if (courseId) queryClient.invalidateQueries({ queryKey: lessonEngineKeys.states(courseId) })
    },
  })
}

/** Not retried on a refusal; a transient failure is (a second call after success is a no-op with 0 XP). */
export function useCompleteGame(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation<Awaited<ReturnType<typeof completeGame>>, LessonEngineError, { lessonId: string; score: number }>({
    mutationFn: ({ lessonId, score }) => completeGame(lessonId, score),
    retry: retryTransient,
    onSuccess: () => {
      if (courseId) queryClient.invalidateQueries({ queryKey: lessonEngineKeys.states(courseId) })
    },
  })
}

/**
 * Every submission records an attempt, so a failed request is retried only if
 * it never reached the server (`network`); that can at worst record a
 * duplicate attempt, never a duplicate reward.
 */
export function useCheckQuizAnswer() {
  return useMutation<
    Awaited<ReturnType<typeof checkQuizAnswer>>,
    LessonEngineError,
    { lessonId: string; questionId: string; optionId: string }
  >({
    mutationFn: ({ lessonId, questionId, optionId }) => checkQuizAnswer(lessonId, questionId, optionId),
    retry: (failureCount, error) => failureCount < 2 && error.code === 'network',
  })
}

export function useSubmitQuiz(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation<
    Awaited<ReturnType<typeof submitQuiz>>,
    LessonEngineError,
    { lessonId: string; answers: QuizAnswers }
  >({
    mutationFn: ({ lessonId, answers }) => submitQuiz(lessonId, answers),
    retry: (failureCount, error) => failureCount < 2 && error.code === 'network',
    onSuccess: (result) => {
      if (courseId && result.completed) {
        queryClient.invalidateQueries({ queryKey: lessonEngineKeys.states(courseId) })
      }
    },
  })
}
