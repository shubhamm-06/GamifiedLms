import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ClipboardList, Sparkles } from 'lucide-react'
import { useCheckQuizAnswer, useSubmitQuiz } from '@/hooks/useLessonEngine'
import { useQuizQuestions } from '@/hooks/useLessonContent'
import {
  LessonEngineError,
  describeEngineError,
  type LessonEngineErrorCode,
  type QuizAnswerCheck,
  type QuizResult,
} from '@/lib/lessonEngine'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { useLeaveGuard } from '@/hooks/useBackClosable'
import * as haptics from '@/lib/haptics'
import { clockText, type LessonContent } from '@/lib/lessonPlayer'
import { DEFAULT_PASS_PERCENTAGE } from '@/lib/lessonSettings'
import { playerCopy } from '@/lib/playerCopy'
import { PlayerBar } from './PlayerBar'
import { PlayerError } from './PlayerError'
import { PlayerSkeleton } from './PlayerSkeleton'
import { PrimaryButton, PrimaryLink } from './PrimaryButton'
import type { PlayerMode } from './LessonPlayerShell'
import { QuizProgress } from './QuizProgress'
import { QuizQuestion } from './QuizQuestion'
import { QuizResultView } from './QuizResultView'

interface Props {
  lesson: LessonContent
  courseId: string
  mode: PlayerMode
  clock: { displaySeconds: number; minTimeSeconds: number; timeMet: boolean }
  /** Calls fn_complete_lesson (page-owned): used when the quiz was passed before the minimum time. */
  onFinish: () => void
  finishing: boolean
  finishError: string | null
  /** The submission itself completed the lesson (server reply); the page shows the completion sheet. */
  onCompleted: (xpAwarded: number) => void
  /** The server refused mid-session (locked, not enrolled, unavailable): the page routes away. */
  onRefused: (code: LessonEngineErrorCode) => void
}

const REFUSALS: ReadonlySet<LessonEngineErrorCode> = new Set<LessonEngineErrorCode>([
  'locked',
  'not_enrolled',
  'lesson_unavailable',
])

/**
 * The quiz, one question at a time and forward only. Tapping an option locks it
 * in and the server (`fn_check_quiz_answer`) answers at once whether it was right
 * and which option was: the chosen button turns teal with a check or coral with
 * an X, and after a wrong answer the right one turns teal too. A per-question
 * Continue then moves on; there is no way back, and a wrong answer never stops
 * the child from going on. Only after the last question are all the answers sent,
 * once, to `fn_submit_quiz`, which grades against the lesson's pass mark, records
 * the attempt, and (on the first pass) completes the lesson and awards its XP
 * exactly once. A pass opens the shared gold completion sheet (owned by the
 * page); a fail offers Try again, which starts the same questions again from the
 * first. The answer key reaches the browser only through the check function and
 * only after an answer (rules.md); nothing here is graded on the client.
 */
export function QuizLesson({ lesson, courseId, mode, clock, onFinish, finishing, finishError, onCompleted, onRefused }: Props) {
  const questions = useQuizQuestions(lesson.id, true)
  const check = useCheckQuizAnswer()
  const submit = useSubmitQuiz(courseId)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, QuizAnswerCheck>>({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  // In progress = at least one answer locked in and not graded yet: Android Back asks first.
  useLeaveGuard(Object.keys(revealed).length > 0 && !result)

  useEffect(() => {
    if (!moved.current) return
    heading.current?.focus()
  }, [index])

  const showLoadingSkeleton = useDelayedFlag(questions.isPending, 200)
  if (questions.isPending) return showLoadingSkeleton ? <PlayerSkeleton /> : null
  if (questions.isError) {
    return (
      <PlayerError
        heading={playerCopy.quiz.loadFailed.heading}
        body={playerCopy.quiz.loadFailed.body}
        icon={<ClipboardList className="size-7" />}
        action={{ kind: 'retry', onRetry: () => void questions.refetch() }}
        testId="quiz-error"
      />
    )
  }
  const list = questions.data
  if (list.length === 0 || list.some((q) => q.options.length < 2)) {
    return (
      <PlayerError
        heading={playerCopy.quiz.empty.heading}
        body={playerCopy.quiz.empty.body}
        icon={<ClipboardList className="size-7" />}
        action={{ kind: 'back', courseId }}
        testId="quiz-empty"
      />
    )
  }

  const total = list.length
  const question = list[Math.min(index, total - 1)]
  const isLast = index === total - 1
  const reveal = revealed[question.id] ?? null
  const checking = check.isPending
  const grading = submit.isPending
  const practice = mode === 'replay'

  function refuseOrNote(e: unknown, fallback: (code: LessonEngineErrorCode) => string) {
    const code = e instanceof LessonEngineError ? e.code : 'unknown'
    if (REFUSALS.has(code)) onRefused(code)
    else setError(fallback(code))
  }

  async function choose(optionId: string) {
    if (checking || reveal) return
    setError(null)
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }))
    try {
      const r = await check.mutateAsync({ lessonId: lesson.id, questionId: question.id, optionId })
      setRevealed((prev) => ({ ...prev, [question.id]: r }))
      if (r.correct) haptics.success()
      else haptics.error()
    } catch (e) {
      // Nothing was locked in: let the child tap again.
      setAnswers((prev) => {
        const next = { ...prev }
        delete next[question.id]
        return next
      })
      refuseOrNote(e, describeEngineError)
    }
  }

  async function grade() {
    setError(null)
    try {
      const r = await submit.mutateAsync({ lessonId: lesson.id, answers })
      setResult(r)
      moved.current = true
      // A pass that opens the completion sheet is one moment: the sheet's own
      // success() is that moment's haptic, so the pass does not add a second one.
      const celebrates = r.completed && mode === 'play'
      if (!r.passed) haptics.warning()
      else if (!celebrates) haptics.success()
      // The shared gold sheet, only for a pass that completed the lesson right now.
      if (r.completed && mode === 'play') onCompleted(r.xpAwarded)
    } catch (e) {
      refuseOrNote(e, (code) =>
        code === 'invalid_answers' ? 'Something went wrong with your answers. Please try the quiz again.' : describeEngineError(code),
      )
    }
  }

  function tryAgain() {
    moved.current = false
    setAnswers({})
    setRevealed({})
    setResult(null)
    setError(null)
    setIndex(0)
    check.reset()
    submit.reset()
  }

  function next() {
    if (isLast) {
      void grade()
    } else {
      moved.current = true
      setIndex(index + 1)
    }
  }

  const errorNote = error || finishError

  return (
    <div className="lp-fill" data-testid="quiz-lesson">
      {errorNote ? (
        <p className="lp-notice" role="alert" data-testid="quiz-error-note">
          {errorNote}
        </p>
      ) : null}

      {!result ? (
        <>
          <QuizProgress done={index + (reveal ? 1 : 0)} total={total} />
          <QuizQuestion
            ref={heading}
            question={question}
            index={index}
            total={total}
            selected={answers[question.id]}
            checking={checking}
            correctOption={reveal?.correctOption ?? null}
            onSelect={(optionId) => void choose(optionId)}
          />
          {/* Held in place (hidden) until the answer is locked in, so nothing shifts when it appears. */}
          <div className="lp-continue-slot" data-visible={reveal ? 'true' : 'false'} aria-hidden={reveal ? undefined : true}>
            <PlayerBar>
              <PrimaryButton variant="candy" loading={isLast && grading} testId="quiz-continue" onClick={next}>
                {playerCopy.button.continueReview}
              </PrimaryButton>
            </PlayerBar>
          </div>
        </>
      ) : (
        <div className="lp-fill">
          <QuizResultView
            score={result.score}
            maxScore={result.maxScore}
            passed={result.passed}
            // Defensive fallback only — `lessons_pass_percentage_quiz_only_check`
            // (migration 028) guarantees a quiz lesson always has a real value.
            passPercentage={lesson.passPercentage ?? DEFAULT_PASS_PERCENTAGE}
            practice={practice}
          />
          {result.passed && !practice && result.xpAwarded > 0 ? (
            <p className="lp-xp kid-num" data-testid="quiz-xp">
              <Sparkles className="size-5" aria-hidden />
              {playerCopy.quiz.xpEarned(result.xpAwarded)}
            </p>
          ) : null}
          {mode === 'done' ? null : practice ? (
            <PlayerBar hint={playerCopy.replay.quizPracticeNote}>
              <PrimaryLink variant="candy" to="/courses/$courseId" params={{ courseId }} data-testid="back-to-path">
                {playerCopy.button.backToRoadmap}
              </PrimaryLink>
              <button type="button" className="candy-btn-quiet kid-tap" onClick={tryAgain}>
                {playerCopy.button.tryAgain}
              </button>
            </PlayerBar>
          ) : !result.passed ? (
            <PlayerBar>
              <PrimaryButton variant="candy" testId="quiz-retry" onClick={tryAgain}>
                {playerCopy.button.tryAgain}
              </PrimaryButton>
              <Link to="/courses/$courseId" params={{ courseId }} className="lp-bar-hint underline kid-tap">
                {playerCopy.button.backToRoadmap}
              </Link>
            </PlayerBar>
          ) : (
            <PlayerBar>
              <PrimaryButton
                variant={clock.timeMet ? 'candy' : 'muted'}
                loading={finishing}
                testId="finish-lesson"
                onClick={onFinish}
              >
                {finishing
                  ? playerCopy.button.finishing
                  : clock.timeMet
                    ? playerCopy.button.finishLesson
                    : playerCopy.button.keepLearning(clockText(clock.minTimeSeconds - clock.displaySeconds))}
              </PrimaryButton>
            </PlayerBar>
          )}
        </div>
      )}
    </div>
  )
}
