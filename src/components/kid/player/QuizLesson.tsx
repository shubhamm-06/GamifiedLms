import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSubmitQuiz } from '@/hooks/useLessonEngine'
import { useQuizQuestions } from '@/hooks/useLessonContent'
import {
  LessonEngineError,
  describeEngineError,
  type LessonEngineErrorCode,
  type QuizResult,
} from '@/lib/lessonEngine'
import { clockText, secondsLeft, type LessonContent } from '@/lib/lessonPlayer'
import { LessonMessage } from './LessonMessage'
import { PlayerBar } from './PlayerBar'
import type { PlayerMode } from './LessonPlayerShell'
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
 * The quiz: one question at a time, then a server-graded result. Answers are only
 * ever sent to fn_submit_quiz; passing, completion and XP come back from it, and a
 * quiz passed before the minimum time waits for the timer, then Finish (the server
 * re-checks both). Retries are unlimited (nothing in the schema or rules.md limits
 * them). The one primary action is in the bottom bar.
 */
export function QuizLesson({ lesson, courseId, mode, clock, onFinish, finishing, finishError, onCompleted, onRefused }: Props) {
  const questions = useQuizQuestions(lesson.id, true)
  const submit = useSubmitQuiz(courseId)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)

  // Move focus to the new question (or the result) so keyboard and screen reader users follow along.
  useEffect(() => {
    if (!moved.current) return
    heading.current?.focus()
  }, [index])
  useEffect(() => {
    if (result) resultRef.current?.querySelector<HTMLElement>('h2')?.focus()
  }, [result])

  if (questions.isPending) return <LessonMessage testId="quiz-loading">Getting your questions ready.</LessonMessage>
  if (questions.isError) {
    return (
      <LessonMessage testId="quiz-error">
        We couldn&rsquo;t load the questions. Check your internet and try again.
      </LessonMessage>
    )
  }
  const list = questions.data
  if (list.length === 0 || list.some((q) => q.options.length < 2)) {
    return <LessonMessage testId="quiz-empty">This quiz isn&rsquo;t ready yet. Please check back soon.</LessonMessage>
  }

  const total = list.length
  const question = list[Math.min(index, total - 1)]
  const isLast = index === total - 1
  const answered = !!answers[question.id]
  const grading = submit.isPending
  const left = secondsLeft(clock.minTimeSeconds, clock.displaySeconds)
  const announce = result
    ? `You got ${result.score} out of ${result.maxScore}. ${result.passed ? 'You passed!' : 'Not quite yet. You can try again.'}`
    : ''

  async function grade() {
    setError(null)
    try {
      const r = await submit.mutateAsync({ lessonId: lesson.id, answers })
      setResult(r)
      if (r.completed && mode === 'play') onCompleted(r.xpAwarded)
    } catch (e) {
      const code = e instanceof LessonEngineError ? e.code : 'unknown'
      if (REFUSALS.has(code)) onRefused(code)
      else if (code === 'invalid_answers') setError('Something went wrong with your answers. Please try the quiz again.')
      else setError(describeEngineError(code))
    }
  }

  function tryAgain() {
    moved.current = false
    setAnswers({})
    setResult(null)
    setError(null)
    setIndex(0)
  }

  function go(next: number) {
    moved.current = true
    setIndex(next)
  }

  const errorNote = error || finishError
  return (
    <div className="lp-fill" data-testid="quiz-lesson">
      <p role="status" className="sr-only" data-testid="quiz-announce">
        {announce}
      </p>
      {errorNote ? (
        <p className="lp-notice mb-3" role="alert" data-testid="quiz-error-note">
          {errorNote}
        </p>
      ) : null}

      {!result ? (
        <>
          <QuizQuestion
            ref={heading}
            question={question}
            index={index}
            total={total}
            selected={answers[question.id]}
            disabled={grading}
            onSelect={(optionId) => setAnswers((prev) => ({ ...prev, [question.id]: optionId }))}
          />
          <PlayerBar>
            <div className="lp-bar-row">
              {index > 0 ? (
                <button type="button" className="candy-btn-quiet kid-tap" disabled={grading} onClick={() => go(index - 1)}>
                  Back
                </button>
              ) : null}
              <button
                type="button"
                className="candy-btn kid-tap"
                disabled={!answered || grading}
                onClick={() => (isLast ? void grade() : go(index + 1))}
                data-testid="quiz-primary"
              >
                {grading ? 'Checking...' : isLast ? 'Check my answers' : 'Next'}
              </button>
            </div>
          </PlayerBar>
        </>
      ) : (
        <div className="lp-fill" ref={resultRef}>
          <QuizResultView result={result} questions={list} answers={answers} />
          {mode === 'done' ? null : !result.passed ? (
            <PlayerBar>
              <button type="button" className="candy-btn kid-tap" onClick={tryAgain} data-testid="quiz-retry">
                Try again
              </button>
              {mode === 'replay' ? (
                <Link to="/courses/$courseId" params={{ courseId }} className="candy-btn-quiet kid-tap">
                  Back to my path
                </Link>
              ) : null}
            </PlayerBar>
          ) : mode === 'replay' ? (
            <PlayerBar>
              <Link to="/courses/$courseId" params={{ courseId }} className="candy-btn kid-tap" data-testid="back-to-path">
                Back to my path
              </Link>
              <button type="button" className="candy-btn-quiet kid-tap" onClick={tryAgain}>
                Practice again
              </button>
            </PlayerBar>
          ) : (
            <PlayerBar
              hint={clock.timeMet ? 'You passed! Tap Finish lesson.' : `You passed! Keep going. ${clockText(left)} to go.`}
            >
              <button
                type="button"
                className="candy-btn kid-tap"
                disabled={!clock.timeMet || finishing}
                onClick={onFinish}
                data-testid="finish-lesson"
              >
                {finishing ? 'Finishing...' : 'Finish lesson'}
              </button>
            </PlayerBar>
          )}
        </div>
      )}
    </div>
  )
}
