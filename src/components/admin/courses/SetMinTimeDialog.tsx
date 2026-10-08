import { useState, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSetMinTime, type Lesson, type MinTimeResult } from '@/hooks/admin/useCurriculum'
import { DEFAULT_MIN_TIME_SECONDS, validateMinTime } from '@/lib/lessonSettings'
import { MinTimeField } from './MinTimeField'
import { getTerms as tw } from '@/lib/settings/terms'

interface SetMinTimeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  /** The selected lessons. Selected topics are never changed by this action. */
  lessons: Lesson[]
  /** How many topics are selected too — only mentioned so nobody expects them to change. */
  topicCount: number
  /** Called once with the per-item result, after the toast has been shown. */
  onDone: (result: MinTimeResult) => void
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** Mounts fresh per open, so a previous run's value never carries over. */
function SetMinTimeForm({
  courseId,
  lessons,
  topicCount,
  onDone,
  onCancel,
  onPendingChange,
}: Omit<SetMinTimeDialogProps, 'open' | 'onOpenChange'> & {
  onCancel: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const [value, setValue] = useState(String(DEFAULT_MIN_TIME_SECONDS))
  const [error, setError] = useState<string | undefined>()
  const setMinTime = useSetMinTime(courseId)
  const quizCount = lessons.filter((lesson) => lesson.content_type === 'quiz').length

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const problem = validateMinTime(value)
    setError(problem ?? undefined)
    if (problem) return

    onPendingChange(true)
    setMinTime.mutate(
      { lessons, seconds: Number(value) },
      {
        onSuccess: onDone,
        onSettled: () => onPendingChange(false),
      },
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {quizCount > 0 ? (
        <div className="border-gold bg-gold/15 flex gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertTriangle className="text-gold-d mt-0.5 size-4 shrink-0" />
          <p>
            {quizCount === 1
              ? `1 of the selected ${tw().lower('lesson', true)} is a quiz`
              : `${quizCount} of the selected ${tw().lower('lesson', true)} are quizzes`}{' '}
            and will be changed too. A minimum time on a quiz makes kids wait before they can
            finish it — most quizzes should stay Off.
          </p>
        </div>
      ) : null}

      <MinTimeField id="bulk-min-time" value={value} error={error} onChange={setValue} />

      {topicCount > 0 ? (
        <p className="text-muted-foreground text-xs">
          {topicCount} selected {plural(topicCount, 'topic is', 'topics are')} left as is — only
          lessons are changed.
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={setMinTime.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={setMinTime.isPending}>
          {setMinTime.isPending
            ? 'Applying…'
            : `Apply to ${lessons.length} ${plural(lessons.length, 'lesson', 'lessons')}`}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Bulk "Set minimum time" for the lessons selected in the course editor. It
 * cannot be dismissed while the writes run, so the result always reaches the
 * caller and the selection can be updated (succeeded lessons deselected, failed
 * ones kept for a retry).
 */
export function SetMinTimeDialog({
  open,
  onOpenChange,
  courseId,
  lessons,
  topicCount,
  onDone,
}: SetMinTimeDialogProps) {
  const [pending, setPending] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Set minimum time</DialogTitle>
          <DialogDescription>
            Applies to {lessons.length} selected {plural(lessons.length, 'lesson', 'lessons')}.
          </DialogDescription>
        </DialogHeader>
        <SetMinTimeForm
          courseId={courseId}
          lessons={lessons}
          topicCount={topicCount}
          onDone={onDone}
          onCancel={() => onOpenChange(false)}
          onPendingChange={setPending}
        />
      </DialogContent>
    </Dialog>
  )
}
