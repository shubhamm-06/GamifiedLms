import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ClipboardList } from 'lucide-react'
import { useSubmitQuiz } from '@/hooks/useLessonEngine'
import { useQuizQuestions } from '@/hooks/useLessonContent'
import {
  LessonEngineError,
  describeEngineError,
  type LessonEngineErrorCode,
  type QuizResult,
} from '@/lib/lessonEngine'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { clockText, type LessonContent } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { PlayerBar } from './PlayerBar'
import { PlayerError } from './PlayerError'
import { PlayerSkeleton } from './PlayerSkeleton'
import { PrimaryButton, PrimaryLink } from './PrimaryButton'
import type { PlayerMode } from './LessonPlayerShell'
import { QuizFeedbackPanel } from './QuizFeedbackPanel'
import { QuizQuestion } from './QuizQuestion'
import { QuizResultView } from './QuizResultView'
import { QuizStepDots } from './QuizStepDots'

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

type Phase = 'answering' | 'review' | 'results'

/**
 * The quiz: one question at a time, then a server-graded result reviewed one
 * question at a time, then the results screen (spec Part B7). Answers are
 * only ever sent to fn_submit_quiz in one call once every question is
 * answered; nothing is graded, and no explanation or correct option is shown,
 * before that reply comes back (rules.md — unchanged by the new UI spec). The
 * review step can show a chosen answer as right or wrong, but never marks an
 * option the child did not pick as "the correct one": the server does not
 * send which option that is, in review or anywhere else. See ui.md for why
 * this is a deliberate reading of the spec's per-question reveal, not a
 * shortcut.
 */
export function QuizLesson({ lesson, courseId, mode, clock, onFinish, finishing, finishError, onCompleted, onRefused }: Props) {
  const questions = useQuizQuestions(lesson.id, true)
  const submit = useSubmitQuiz(courseId)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (!moved.current) return
    heading.current?.focus()
  }, [index, reviewIndex, phase])

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
  const answered = !!answers[question.id]
  const grading = submit.isPending
  const practice = mode === 'replay'

  async function grade() {
    setError(null)
    try {
      const r = await submit.mutateAsync({ lessonId: lesson.id, answers })
      setResult(r)
      setReviewIndex(0)
      moved.current = true
      // The completion sheet waits until the review is finished (below): a child
      // who just passed still gets to see how each question went first.
      setPhase('review')
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
    setReviewIndex(0)
    setPhase('answering')
  }

  function go(next: number) {
    moved.current = true
    setIndex(next)
  }

  const errorNote = error || finishError

  return (
    <div className="lp-fill" data-testid="quiz-lesson">
      {errorNote ? (
        <p className="lp-notice" role="alert" data-testid="quiz-error-note">
          {errorNote}
        </p>
      ) : null}

      {phase === 'answering' ? (
        <>
          <QuizStepDots total={total} current={index} />
          <p className="sr-only">{playerCopy.quiz.questionCount(index + 1, total)}</p>
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
                  {playerCopy.button.back}
                </button>
              ) : null}
              <PrimaryButton
                variant={answered ? 'candy' : 'muted'}
                loading={isLast && grading}
                testId="quiz-primary"
                onClick={() => (isLast ? void grade() : go(index + 1))}
              >
                {isLast ? playerCopy.button.check : playerCopy.button.next}
              </PrimaryButton>
            </div>
          </PlayerBar>
        </>
      ) : phase === 'review' && result ? (
        (() => {
          const r = result.results[reviewIndex]
          const q = list.find((x) => x.id === r.questionId) ?? question
          const isLastReview = reviewIndex === result.results.length - 1
          return (
            <div className="lp-fill">
              <QuizStepDots total={result.results.length} current={reviewIndex} />
              <QuizQuestion
                ref={heading}
                question={q}
                index={reviewIndex}
                total={result.results.length}
                selected={answers[q.id]}
                disabled
                onSelect={() => {}}
                graded={{ correct: r.correct }}
              />
              <QuizFeedbackPanel correct={r.correct} explanation={r.explanation} />
              <PlayerBar>
                <PrimaryButton
                  variant="candy"
                  testId="quiz-continue"
                  onClick={() => {
                    moved.current = true
                    if (isLastReview) {
                      setPhase('results')
                      // Only now, after the review, does a pass that already met
                      // the minimum time open the completion sheet.
                      if (result.completed && mode === 'play') onCompleted(result.xpAwarded)
                    } else {
                      setReviewIndex((i) => i + 1)
                    }
                  }}
                >
                  {playerCopy.button.continueReview}
                </PrimaryButton>
              </PlayerBar>
            </div>
          )
        })()
      ) : phase === 'results' && result ? (
        <div className="lp-fill">
          <QuizResultView
            score={result.score}
            maxScore={result.maxScore}
            passed={result.passed}
            passPercentage={lesson.passPercentage}
            practice={practice}
          />
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
      ) : null}
    </div>
  )
}
