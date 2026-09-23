import { playerCopy } from '@/lib/playerCopy'

/**
 * The panel under a reviewed question (spec Part B7): a tinted background
 * (teal for right, coral for wrong, never a full colour fill with small
 * text), a short heading and, only when the server sent one, the question's
 * explanation. Space for it is part of the normal flow (not absolutely
 * positioned), so nothing it covers jumps when it appears.
 */
export function QuizFeedbackPanel({ correct, explanation }: { correct: boolean; explanation: string | null }) {
  return (
    <div className="lp-feedback" data-correct={correct} data-testid="quiz-feedback">
      <p className="lp-feedback-head">{correct ? playerCopy.quiz.feedbackCorrect : playerCopy.quiz.feedbackWrong}</p>
      {explanation ? (
        <p className="lp-explain" data-testid="explanation">
          {explanation}
        </p>
      ) : null}
    </div>
  )
}
