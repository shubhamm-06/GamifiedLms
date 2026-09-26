import { forwardRef } from 'react'
import { Check, X } from 'lucide-react'
import { playerCopy } from '@/lib/playerCopy'
import type { QuizQuestionView } from '@/lib/lessonPlayer'

interface Props {
  question: QuizQuestionView
  index: number
  total: number
  /** The option the child tapped, if any. */
  selected: string | undefined
  /** The tap is being checked by the server: options are locked and the chosen one looks pressed. */
  checking: boolean
  /** The server's answer, once it has replied: which option was right. Null until the child has answered. */
  correctOption: string | null
  onSelect: (optionId: string) => void
}

/**
 * One question at a time: the prompt and full-width answer buttons in the
 * app's candy 3D treatment (a bottom lip that presses down on tap). Tapping an
 * option locks it in and asks the server (`fn_check_quiz_answer`) whether it was
 * right; only that reply says which option is correct, so nothing here can mark
 * an answer before the child has given one. Feedback is on the buttons
 * themselves: the chosen option turns teal with a check (right) or coral with an
 * X (wrong), and after a wrong answer the right option turns teal with a check
 * too. Every other option keeps its normal look and stops responding. Colour is
 * never alone (check and X icons, plus spoken text).
 */
export const QuizQuestion = forwardRef<HTMLHeadingElement, Props>(function QuizQuestion(
  { question, index, total, selected, checking, correctOption, onSelect },
  headingRef,
) {
  const promptId = `q-${question.id}`
  const answered = correctOption !== null
  const gotIt = answered && selected === correctOption
  return (
    <section aria-labelledby={promptId} data-testid="quiz-question">
      <p className="lp-question-count" data-testid="question-count">
        {playerCopy.quiz.questionCount(index + 1, total)}
      </p>
      <h2 id={promptId} className="lp-prompt mt-1" tabIndex={-1} ref={headingRef}>
        {question.prompt}
      </h2>
      <div role="group" aria-labelledby={promptId} className="lp-options mt-4">
        {question.options.map((option) => {
          const chosen = selected === option.id
          const state = !answered
            ? chosen && checking
              ? 'checking'
              : 'idle'
            : chosen
              ? gotIt
                ? 'correct'
                : 'wrong'
              : option.id === correctOption
                ? 'correct'
                : 'idle'
          return (
            <button
              key={option.id}
              type="button"
              className="lp-choice kid-tap"
              data-testid="quiz-option"
              data-state={state}
              data-chosen={chosen ? 'true' : undefined}
              aria-pressed={chosen}
              disabled={checking || answered}
              onClick={() => onSelect(option.id)}
            >
              <span>{option.text}</span>
              {state === 'correct' ? <Check className="lp-choice-icon size-7" strokeWidth={3.5} aria-hidden /> : null}
              {state === 'wrong' ? <X className="lp-choice-icon size-7" strokeWidth={3.5} aria-hidden /> : null}
              {state === 'correct' || state === 'wrong' ? (
                <span className="sr-only">
                  {chosen
                    ? state === 'correct'
                      ? playerCopy.quiz.spokenCorrect
                      : playerCopy.quiz.spokenWrong
                    : playerCopy.quiz.spokenRightAnswer}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="sr-only" role="status" data-testid="quiz-feedback">
        {answered ? (gotIt ? playerCopy.quiz.feedbackCorrect : playerCopy.quiz.feedbackWrong) : ''}
      </p>
    </section>
  )
})
