import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBulkUpdateReconciliation } from '@/hooks/admin/usePayments'

type BulkReconciliationAction = 'resolved' | 'unresolved'

/**
 * Mounts fresh per open (Radix unmounts `AlertDialogContent` on close, same
 * as every other dialog's inner-form split in this codebase) — so the note
 * field never carries text over from a previous bulk action.
 */
function BulkReconciliationForm({
  action,
  ids,
  onDone,
}: {
  action: BulkReconciliationAction
  ids: string[]
  onDone: () => void
}) {
  const bulkUpdate = useBulkUpdateReconciliation()
  const [note, setNote] = useState('')

  function handleConfirm() {
    bulkUpdate.mutate(
      {
        ids,
        reconciliation_status: action,
        // Only "resolved" prompts for a note, and even then leaving it
        // blank means "don't touch existing notes" (`undefined` is omitted
        // from the update payload entirely) rather than clearing them.
        ...(action === 'resolved' ? { reconciliation_note: note.trim() || undefined } : {}),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Mark {ids.length} order{ids.length === 1 ? '' : 's'} as{' '}
          {action === 'resolved' ? 'Resolved' : 'Unresolved'}?
        </AlertDialogTitle>
        <AlertDialogDescription>
          {action === 'resolved'
            ? 'This updates the reconciliation status for every selected order.'
            : 'This reopens every selected order for reconciliation.'}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {action === 'resolved' ? (
        <div className="space-y-1.5">
          <Label htmlFor="bulk-reconciliation-note">Note (optional)</Label>
          <Textarea
            id="bulk-reconciliation-note"
            rows={3}
            placeholder="e.g. Matched to Oct bank statement."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Applied identically to all {ids.length} selected orders. Left blank, their existing
            notes are left as-is.
          </p>
        </div>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={bulkUpdate.isPending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={bulkUpdate.isPending}
          onClick={(event) => {
            // Keep the dialog open while the request is in flight; it
            // closes (via onDone) only on success.
            event.preventDefault()
            handleConfirm()
          }}
        >
          {bulkUpdate.isPending
            ? 'Saving…'
            : `Mark ${action === 'resolved' ? 'Resolved' : 'Unresolved'}`}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

interface BulkReconciliationDialogProps {
  action: BulkReconciliationAction | null
  ids: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful bulk update, in addition to closing the dialog — clears the row selection. */
  onSuccess: () => void
}

export function BulkReconciliationDialog({
  action,
  ids,
  open,
  onOpenChange,
  onSuccess,
}: BulkReconciliationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {action ? (
          <BulkReconciliationForm
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
