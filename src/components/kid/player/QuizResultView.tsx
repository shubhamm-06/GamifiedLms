import { Check, X } from 'lucide-react'
import type { QuizResult } from '@/lib/lessonEngine'
import type { QuizQuestionView } from '@/lib/lessonPlayer'

/**
 * The graded attempt: pass or fail, the score, and for each question whether it
 * was right, what the child chose and (when the server sent one) the explanation.
 * Everything here comes from the server reply. The correct answer is never shown
 * because the server never sends it.
 */
export function QuizResultView({
  result,
  questions,
  answers,
}: {
  result: QuizResult
  questions: QuizQuestionView[]
  answers: Record<string, string>
}) {
  const byId = new Map(questions.map((q) => [q.id, q]))
  return (
    <section data-testid="quiz-result" data-passed={result.passed ? 'true' : 'false'}>
      <h2 className="lp-result-head" tabIndex={-1} data-testid="result-heading">
        {result.passed ? 'You passed!' : 'Not quite yet'}
      </h2>
      <p className="mt-1 text-lg font-bold" data-testid="result-score">
        You got {result.score} of {result.maxScore} right
      </p>
      <ol className="mt-3 list-none p-0">
        {result.results.map((r, i) => {
          const q = byId.get(r.questionId)
          const chosen = q?.options.find((o) => o.id === answers[r.questionId])
          return (
            <li key={r.questionId} className="lp-result-item" data-testid="result-item" data-correct={r.correct}>
              <span className="lp-result-mark" data-correct={r.correct ? 'true' : 'false'} aria-hidden="true">
                {r.correct ? <Check className="size-5" strokeWidth={3.5} /> : <X className="size-5" strokeWidth={3.5} />}
              </span>
              <div className="min-w-0">
                <p className="font-bold [overflow-wrap:anywhere]">
                  {i + 1}. {q?.prompt ?? 'Question'}
                </p>
                <p className="text-base">
                  <span className="font-extrabold">{r.correct ? 'Right!' : 'Not quite.'}</span>
                  {chosen ? ` You chose: ${chosen.text}` : ''}
                </p>
                {r.explanation ? (
                  <p className="lp-explain" data-testid="explanation">
                    {r.explanation}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
