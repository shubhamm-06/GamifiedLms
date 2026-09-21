import { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  parseOptions,
  useQuestionMutations,
  useQuizQuestions,
  type QuestionFormValues,
  type QuizOption,
  type QuizQuestion,
} from '@/hooks/admin/useCurriculum'
import { uuid } from '@/lib/uuid'

function newOption(): QuizOption {
  return { id: uuid(), text: '' }
}

const EMPTY_QUESTION: QuestionFormValues = {
  prompt: '',
  options: [newOption(), newOption()],
  correct_option: '',
  explanation: '',
}

interface QuestionFormProps {
  initial: QuestionFormValues
  isSubmitting: boolean
  onSave: (values: QuestionFormValues) => void
  onCancel: () => void
}

function QuestionForm({ initial, isSubmitting, onSave, onCancel }: QuestionFormProps) {
  const [values, setValues] = useState<QuestionFormValues>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filledOptions = values.options.filter((o) => o.text.trim())

  function setOptionText(id: string, text: string) {
    setValues((prev) => ({
      ...prev,
      options: prev.options.map((o) => (o.id === id ? { ...o, text } : o)),
    }))
  }

  function addOption() {
    setValues((prev) => ({ ...prev, options: [...prev.options, newOption()] }))
  }

  function removeOption(id: string) {
    setValues((prev) => ({
      ...prev,
      options: prev.options.filter((o) => o.id !== id),
      // Dropping the option that was marked correct clears the answer key
      // rather than leaving it pointing at something that no longer exists.
      correct_option: prev.correct_option === id ? '' : prev.correct_option,
    }))
  }

  function handleSave() {
    const next: Record<string, string> = {}
    if (!values.prompt.trim()) next.prompt = 'Prompt is required.'
    if (filledOptions.length < 2) next.options = 'Give at least two non-empty options.'

    // The one validation that protects product correctness rather than
    // polish: a correct_option that matches no option means the question can
    // never be answered correctly, and nothing downstream would catch it.
    if (!values.correct_option) {
      next.correct_option = 'Choose which option is correct.'
    } else if (!filledOptions.some((o) => o.id === values.correct_option)) {
      next.correct_option = 'The correct answer must be one of the options above.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    onSave({ ...values, options: filledOptions })
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="q-prompt">Prompt</Label>
        <Textarea
          id="q-prompt"
          rows={2}
          value={values.prompt}
          aria-invalid={!!errors.prompt}
          onChange={(e) => setValues((prev) => ({ ...prev, prompt: e.target.value }))}
        />
        {errors.prompt ? <p className="text-coral-d text-sm">{errors.prompt}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label>Options</Label>
        <div className="space-y-2">
          {values.options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                value={option.text}
                placeholder={`Option ${index + 1}`}
                onChange={(e) => setOptionText(option.id, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove option ${index + 1}`}
                disabled={values.options.length <= 2}
                onClick={() => removeOption(option.id)}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
        {errors.options ? <p className="text-coral-d text-sm">{errors.options}</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          <Plus />
          Add option
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-correct">Correct answer</Label>
        {/* Chosen from the options themselves — never free text, so the answer
            key can't drift out of the option set. */}
        <Select
          value={values.correct_option}
          onValueChange={(v) => setValues((prev) => ({ ...prev, correct_option: v }))}
        >
          <SelectTrigger id="q-correct" className="w-full" aria-invalid={!!errors.correct_option}>
            <SelectValue placeholder={filledOptions.length ? 'Select…' : 'Fill in options first'} />
          </SelectTrigger>
          <SelectContent>
            {filledOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.correct_option ? (
          <p className="text-coral-d text-sm">{errors.correct_option}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-explanation">Explanation</Label>
        <Textarea
          id="q-explanation"
          rows={2}
          value={values.explanation}
          onChange={(e) => setValues((prev) => ({ ...prev, explanation: e.target.value }))}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={isSubmitting} onClick={handleSave}>
          {isSubmitting ? 'Saving…' : 'Save question'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function toFormValues(question: QuizQuestion): QuestionFormValues {
  const options = parseOptions(question.options)
  return {
    prompt: question.prompt,
    options: options.length >= 2 ? options : [...options, newOption()],
    correct_option: question.correct_option,
    explanation: question.explanation ?? '',
  }
}

export function QuizQuestionsEditor({ lessonId }: { lessonId: string }) {
  const { data: questions, isPending } = useQuizQuestions(lessonId)
  const mutations = useQuestionMutations(lessonId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const rows = questions ?? []

  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Questions</h3>
        <span className="text-muted-foreground text-xs">
          {rows.length} {rows.length === 1 ? 'question' : 'questions'}
        </span>
      </div>

      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : rows.length === 0 && !isAdding ? (
        <p className="text-muted-foreground text-sm">
          No questions yet — add the first one below.
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((question, index) =>
          editingId === question.id ? (
            <li key={question.id}>
              <QuestionForm
                initial={toFormValues(question)}
                isSubmitting={mutations.update.isPending}
                onCancel={() => setEditingId(null)}
                onSave={(values) =>
                  mutations.update.mutate(
                    { id: question.id, values },
                    { onSuccess: () => setEditingId(null) },
                  )
                }
              />
            </li>
          ) : (
            <li
              key={question.id}
              className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm"
            >
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Move question up"
                  disabled={index === 0 || mutations.swap.isPending}
                  onClick={() => mutations.swap.mutate({ a: question, b: rows[index - 1] })}
                >
                  <ChevronUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Move question down"
                  disabled={index === rows.length - 1 || mutations.swap.isPending}
                  onClick={() => mutations.swap.mutate({ a: question, b: rows[index + 1] })}
                >
                  <ChevronDown />
                </Button>
              </div>
              <span className="min-w-0 flex-1 truncate">{question.prompt}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Edit question"
                onClick={() => {
                  setIsAdding(false)
                  setEditingId(question.id)
                }}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete question"
                onClick={() => mutations.remove.mutate(question.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ),
        )}
      </ul>

      {isAdding ? (
        <QuestionForm
          initial={{ ...EMPTY_QUESTION, options: [newOption(), newOption()] }}
          isSubmitting={mutations.create.isPending}
          onCancel={() => setIsAdding(false)}
          onSave={(values) =>
            mutations.create.mutate(
              { values, position: rows.length },
              { onSuccess: () => setIsAdding(false) },
            )
          }
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingId(null)
            setIsAdding(true)
          }}
        >
          <Plus />
          Add question
        </Button>
      )}
    </section>
  )
}
