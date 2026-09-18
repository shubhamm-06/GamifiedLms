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
import {
  useDeletePaymentsPermanently,
  useSetPaymentsTrashed,
} from '@/hooks/admin/usePayments'

type TrashAction = 'trash' | 'delete'

/**
 * Mounts fresh per open (Radix unmounts `AlertDialogContent` on close, same
 * inner/outer split as `BulkReconciliationDialog.tsx`).
 *
 * Trash and Delete Permanently share this one component because they're the
 * same interaction shape (confirm, then one batched write) — but the copy
 * and severity are deliberately NOT shared: moving to trash is reversible
 * and gets ordinary confirm wording, permanent delete gets its own strongly
 * worded copy and a destructive action button, per the task's explicit
 * "don't reuse the same confirmation copy as trashing."
 */
function BulkTrashForm({
  action,
  ids,
  onDone,
}: {
  action: TrashAction
  ids: string[]
  onDone: () => void
}) {
  const setTrashed = useSetPaymentsTrashed()
  const deletePermanently = useDeletePaymentsPermanently()
  const isPending = action === 'trash' ? setTrashed.isPending : deletePermanently.isPending

  function handleConfirm() {
    if (action === 'trash') {
      setTrashed.mutate({ ids, trashed: true }, { onSuccess: onDone })
    } else {
      deletePermanently.mutate(ids, { onSuccess: onDone })
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {action === 'trash'
            ? `Move ${ids.length} order${ids.length === 1 ? '' : 's'} to Trash?`
            : `Permanently delete ${ids.length} order${ids.length === 1 ? '' : 's'}?`}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {action === 'trash'
            ? "They'll be hidden from the active list and KPI totals. You can restore them from Trash later — this doesn't touch any linked enrollment."
            : 'This cannot be undone. These are real financial records — once deleted, there is no way to get them back. This never affects a linked enrollment either way.'}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          variant={action === 'delete' ? 'destructive' : 'default'}
          disabled={isPending}
          onClick={(event) => {
            // Keep the dialog open while the request is in flight; it
            // closes (via onDone) only on success.
            event.preventDefault()
            handleConfirm()
          }}
        >
          {isPending
            ? 'Working…'
            : action === 'trash'
              ? 'Move to Trash'
              : 'Delete Permanently'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

interface BulkTrashDialogProps {
  action: TrashAction | null
  ids: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful trash/delete, in addition to closing the dialog — clears the row selection. */
  onSuccess: () => void
}

export function BulkTrashDialog({ action, ids, open, onOpenChange, onSuccess }: BulkTrashDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {action ? (
          <BulkTrashForm
            action={action}
            ids={ids}
            onDone={() => {
              onOpenChange(false)
              onSuccess()
            }}
          />
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}
