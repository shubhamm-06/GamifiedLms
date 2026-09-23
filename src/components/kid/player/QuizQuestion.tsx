import { forwardRef } from 'react'
import { Check, X } from 'lucide-react'
import type { QuizQuestionView } from '@/lib/lessonPlayer'

const LETTERS = 'ABCDEFGHIJ'

interface Props {
  question: QuizQuestionView
  index: number
  total: number
  selected: string | undefined
  disabled: boolean
  onSelect: (optionId: string) => void
  /** Set only during the post-grading review: which option the child chose
   * was right or wrong. The correct option is never marked on one the child
   * did NOT choose — the server never sends which option that is (rules.md),
   * so an unchosen option can only ever be shown as dimmed, not "correct". */
  graded?: { correct: boolean }
}

/**
 * One question: the prompt and large radio choices (each at least 64 px
 * tall). Real radio inputs sit inside the labels, so the keyboard and screen
 * readers get the native behaviour. Before grading, a chosen answer is marked
 * by a plum border, filled letter badge and check (never colour alone).
 * During the graded review, the chosen option turns teal (right) or coral
 * (wrong, with a short shake) and every other option dims and stops
 * responding to taps.
 */
export const QuizQuestion = forwardRef<HTMLHeadingElement, Props>(function QuizQuestion(
  { question, index, total, selected, disabled, onSelect, graded },
  headingRef,
) {
  const promptId = `q-${question.id}`
  return (
    <section aria-labelledby={promptId} data-testid="quiz-question">
      <p className="lp-question-count" data-testid="question-count">
        Question {index + 1} of {total}
      </p>
      <h2 id={promptId} className="lp-prompt mt-1" tabIndex={-1} ref={headingRef}>
        {question.prompt}
      </h2>
      <div role="radiogroup" aria-labelledby={promptId} className="lp-options mt-4">
        {question.options.map((option, i) => {
          const chosen = selected === option.id
          return (
            <label
              key={option.id}
              className="lp-option"
              data-testid="quiz-option"
              data-graded={graded ? 'true' : undefined}
              data-chosen={chosen ? 'true' : undefined}
              data-correct={graded && chosen ? graded.correct : undefined}
            >
              <input
                type="radio"
                className="sr-only"
                name={question.id}
                value={option.id}
                checked={chosen}
                disabled={disabled || !!graded}
                onChange={() => onSelect(option.id)}
              />
              <span className="lp-option-letter" aria-hidden="true">
                {graded && chosen ? (
                  graded.correct ? (
                    <Check className="size-4" strokeWidth={3.5} />
                  ) : (
                    <X className="size-4" strokeWidth={3.5} />
                  )
                ) : (
                  LETTERS[i] ?? i + 1
                )}
              </span>
              <span>{option.text}</span>
              {!graded ? <Check className="lp-option-check size-6" strokeWidth={3.5} aria-hidden /> : null}
            </label>
          )
        })}
      </div>
    </section>
  )
})
