/**
 * One dot per question, quiz identity colour (--plum, used nowhere else in
 * the player): filled for a done question, ringed for the current one, muted
 * for what's ahead. The score never shows during the quiz (spec Part B7); the
 * real count is in the visually-hidden text beside the dots.
 */
export function QuizStepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="lp-dots" aria-hidden="true" data-testid="quiz-dots">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="lp-dot" data-s={i < current ? 'done' : i === current ? 'current' : undefined} />
      ))}
    </div>
  )
}
