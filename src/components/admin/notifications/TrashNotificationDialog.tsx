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

interface TrashNotificationDialogProps {
  count: number
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * Confirms before moving a sent notification to trash, from the history
 * table — unlike every other admin list (courses, lessons, games, badges),
 * which trash immediately with only an Undo toast as the safety net. The
 * difference here is a real, one-way consequence a toast can't undo: a push
 * that already reached a phone cannot be recalled, and this dialog says so
 * in plain words before the admin commits. Trashing itself still goes
 * through the same `useTrashActions().trash(...)` as everything else (Undo
 * toast included) — only the extra confirm step is new.
 */
export function TrashNotificationDialog({
  count,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: TrashNotificationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from student inboxes?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-left">
              <p>
                This removes {count === 1 ? 'the notification' : `${count} notifications`} from every student&rsquo;s
                inbox. A push notification that has already reached a phone cannot be recalled.
              </p>
              <p>You can restore it from Trash.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {pending ? 'Moving…' : 'Move to trash'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
