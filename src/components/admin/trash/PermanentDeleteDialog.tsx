import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useModuleLiveLessonCount } from '@/hooks/admin/useTrash'
import {
  archiveCourse,
  permanentlyDeleteItems,
  type PermanentDeleteOutcome,
} from '@/lib/permanentDelete'
import { ENTITY_NOUN, type TrashEntity, type TrashItem } from '@/lib/trash'
import { getTerms as tw } from '@/lib/settings/terms'

interface PermanentDeleteDialogProps {
  entity: TrashEntity
  items: TrashItem[]
  /** `empty` = Empty trash for the whole tab; only changes the wording. */
  mode: 'delete' | 'empty'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the run finishes, so the tab can drop deleted ids from its selection. */
  onFinished: (outcome: PermanentDeleteOutcome) => void
}

const CONFIRM_WORD = 'DELETE'

/** What is skipped, per entity — shown before the run so a blocked item is not a surprise. */
const SKIP_NOTE: Record<TrashEntity, string> = {
  courses:
    `${tw().term('course')} that still has enrollments, payments, ${tw().lower('lesson')} progress, quiz attempts or ${tw().lower('lesson')} ${tw().term('xp')} is skipped and stays in Trash.`,
  modules: '',
  lessons: `${tw().term('lesson')} that students have started or attempted is skipped and stays in Trash.`,
  games: `A game that any ${tw().lower('lesson')} still uses (trashed ${tw().lower('lesson', true)} included) is skipped and stays in Trash.`,
  badges: `${tw().term('badge')} that any student has unlocked is skipped and stays in Trash.`,
  users:
    `A user with activity history (enrollments, payments, progress, ${tw().term('xp')} …) is skipped and stays in Trash.`,
}

/**
 * The permanent-delete confirmation — AlertDialog, the exact count, and a typed
 * DELETE. After the run the same dialog shows the outcome (deleted / blocked
 * with reasons / failed), which is how a blocked item's readable message
 * reaches the admin. The Trash page is the only place this exists.
 *
 * The body is a separate component so its state (typed text, results) resets
 * every time the dialog opens — Radix unmounts the content on close.
 */
export function PermanentDeleteDialog({
  entity,
  items,
  mode,
  open,
  onOpenChange,
  onFinished,
}: PermanentDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <DialogBody
          entity={entity}
          items={items}
          mode={mode}
          onClose={() => onOpenChange(false)}
          onFinished={onFinished}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DialogBody({
  entity,
  items,
  mode,
  onClose,
  onFinished,
}: Pick<PermanentDeleteDialogProps, 'entity' | 'items' | 'mode' | 'onFinished'> & {
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<PermanentDeleteOutcome | null>(null)
  const [archived, setArchived] = useState<Record<string, boolean>>({})

  const noun = ENTITY_NOUN[entity]
  const count = items.length
  const label = `${count} ${count === 1 ? noun.one : noun.many}`

  // "N lessons will move to trash" — counted before the dialog opens its
  // confirm, because fn_delete_module_permanently trashes them first.
  const lessonCount = useModuleLiveLessonCount(
    items.map((i) => i.id),
    entity === 'modules' && outcome === null,
  )

  async function run() {
    setRunning(true)
    const result = await permanentlyDeleteItems(entity, items)
    setOutcome(result)
    setRunning(false)
    onFinished(result)
    await queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'admin' && q.queryKey[1] !== 'session',
    })
  }

  async function archive(item: TrashItem) {
    const problem = await archiveCourse(item.id)
    if (problem) toast.error(problem)
    else {
      setArchived((prev) => ({ ...prev, [item.id]: true }))
      toast.success(`Archived ${item.name}. It is still in Trash.`)
    }
  }

  // ---------------------------------------------------------------- results
  if (outcome) {
    const nothingElse = outcome.blocked.length === 0 && outcome.failed.length === 0
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {nothingElse
              ? `Deleted ${outcome.deleted.length} ${outcome.deleted.length === 1 ? noun.one : noun.many}`
              : 'Finished — some items were kept'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                {outcome.deleted.length} deleted
                {outcome.blocked.length > 0 ? `, ${outcome.blocked.length} blocked` : ''}
                {outcome.failed.length > 0 ? `, ${outcome.failed.length} failed` : ''}.
                {outcome.lessonsMoved > 0
                  ? ` ${outcome.lessonsMoved} ${outcome.lessonsMoved === 1 ? 'lesson was' : 'lessons were'} moved to trash.`
                  : ''}
              </p>
              {[...outcome.blocked, ...outcome.failed].length > 0 ? (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {[...outcome.blocked, ...outcome.failed].map(({ item, reason }) => (
                    <li key={item.id} className="rounded-md border p-2 text-sm">
                      <p className="text-foreground font-medium">{item.name}</p>
                      <p className="text-muted-foreground">{reason}</p>
                      {entity === 'courses' && outcome.blocked.some((b) => b.item.id === item.id) ? (
                        archived[item.id] ? (
                          <p className="text-teal-d mt-1 text-xs">Archived — still in Trash.</p>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => void archive(item)}
                          >
                            Archive it instead
                          </Button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </>
    )
  }

  // ---------------------------------------------------------------- confirm
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {mode === 'empty'
            ? `Empty trash: permanently delete ${label}?`
            : `Permanently delete ${label}?`}
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-2 text-left">
            <p>This can&rsquo;t be undone.</p>
            {entity === 'modules' ? (
              <p>
                {lessonCount.isPending
                  ? `Counting their ${tw().lower('lesson', true)}…`
                  : `${lessonCount.data ?? 0} ${tw().lower('lesson', lessonCount.data !== 1)} will move to trash (they stay restorable).`}
              </p>
            ) : (
              <p>{SKIP_NOTE[entity]}</p>
            )}
            {count <= 5 ? (
              <ul className="list-disc pl-5">
                {items.map((item) => (
                  <li key={item.id}>{item.name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="space-y-1.5">
        <label htmlFor="confirm-delete" className="text-sm font-medium">
          Type {CONFIRM_WORD} to confirm
        </label>
        <Input
          id="confirm-delete"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={CONFIRM_WORD}
          disabled={running}
        />
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={typed !== CONFIRM_WORD || running || count === 0}
          onClick={(event) => {
            // Keep the dialog open: it switches to the results view when done.
            event.preventDefault()
            void run()
          }}
        >
          {running ? 'Deleting…' : `Delete ${label} permanently`}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}
