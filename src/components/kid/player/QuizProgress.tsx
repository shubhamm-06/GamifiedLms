import { playerCopy } from '@/lib/playerCopy'

/**
 * The slim bar across the top of the quiz: how far through the question set the
 * child is. The same track and fill as the lesson pages' minimum-time bar
 * (`.lp-timebar-*`), so it reads as the same kind of thing. `done` counts the
 * questions already answered (the current one counts as soon as its answer is in).
 */
export function QuizProgress({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="lp-timebar-track" data-testid="quiz-progress" role="progressbar" aria-label={playerCopy.quiz.progressLabel} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <span className="lp-timebar-fill" style={{ width: `${percent}%` }} data-testid="quiz-progress-fill" />
    </div>
  )
}
