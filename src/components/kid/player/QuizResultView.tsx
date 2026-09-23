import { Check } from 'lucide-react'
import { playerCopy } from '@/lib/playerCopy'

/**
 * The results screen after the review (spec Part B7). Never a percentage:
 * always "X of Y". A replay's practice attempt shows neither pass nor fail,
 * just the score, since it changed nothing.
 */
export function QuizResultView({
  score,
  maxScore,
  passed,
  passPercentage,
  practice,
}: {
  score: number
  maxScore: number
  passed: boolean
  /** The lesson's pass mark (percent), used only to say it in words. */
  passPercentage: number
  /** True in replay: no pass/fail language, no XP context. */
  practice: boolean
}) {
  const needed = Math.ceil((passPercentage / 100) * maxScore)
  return (
    <section data-testid="quiz-result" data-passed={practice ? undefined : passed ? 'true' : 'false'}>
      {practice ? (
        <>
          <p className="lp-question-count" data-testid="practice-chip">
            {playerCopy.quiz.practiceRound}
          </p>
          <h2 className="lp-result-head mt-1" tabIndex={-1} data-testid="result-heading">
            {playerCopy.quiz.practiceScore(score, maxScore)}
          </h2>
        </>
      ) : passed ? (
        <>
          <span className="lp-result-badge" aria-hidden="true">
            <Check className="size-7" strokeWidth={3} />
          </span>
          <h2 className="lp-result-head mt-3 text-center" tabIndex={-1} data-testid="result-heading">
            {playerCopy.quiz.resultsPassedHeading}
          </h2>
          <p className="lp-result-score mt-1 text-center kid-num" data-testid="result-score">
            {playerCopy.quiz.scoreLine(score, maxScore)}
          </p>
        </>
      ) : (
        <>
          <h2 className="lp-result-head" tabIndex={-1} data-testid="result-heading">
            {playerCopy.quiz.resultsFailedHeading}
          </h2>
          <p className="lp-result-score mt-1 kid-num" data-testid="result-score">
            {playerCopy.quiz.scoreLine(score, maxScore)}
          </p>
          <p className="lp-pass-mark mt-1" data-testid="pass-mark">
            {playerCopy.quiz.passMark(needed, maxScore)}
          </p>
        </>
      )}
    </section>
  )
}
