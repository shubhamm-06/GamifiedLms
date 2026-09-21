import { forwardRef } from 'react'
import { Check } from 'lucide-react'
import type { QuizQuestionView } from '@/lib/lessonPlayer'

const LETTERS = 'ABCDEFGHIJ'

/**
 * One question: the prompt and large radio choices (each at least 56 px tall).
 * Real radio inputs sit inside the labels, so the keyboard and screen readers get
 * the native behaviour (Tab to the group, arrow keys to change). The chosen answer
 * is marked by a thick border, a bold label, a filled letter and a check mark, not
 * by colour alone. Nothing here knows which answer is right; the server does.
 */
export const QuizQuestion = forwardRef<
  HTMLHeadingElement,
  {
    question: QuizQuestionView
    index: number
    total: number
    selected: string | undefined
    disabled: boolean
    onSelect: (optionId: string) => void
  }
>(function QuizQuestion({ question, index, total, selected, disabled, onSelect }, headingRef) {
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
        {question.options.map((option, i) => (
          <label key={option.id} className="lp-option" data-testid="quiz-option">
            <input
              type="radio"
              className="sr-only"
              name={question.id}
              value={option.id}
              checked={selected === option.id}
              disabled={disabled}
              onChange={() => onSelect(option.id)}
            />
            <span className="lp-option-letter" aria-hidden="true">
              {LETTERS[i] ?? i + 1}
            </span>
            <span>{option.text}</span>
            <Check className="lp-option-check size-6" strokeWidth={3.5} aria-hidden />
          </label>
        ))}
      </div>
    </section>
  )
})
