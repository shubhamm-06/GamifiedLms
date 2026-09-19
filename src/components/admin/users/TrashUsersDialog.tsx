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
import { useTrashActions } from '@/hooks/admin/useTrashActions'
import type { AdminUserRow } from '@/hooks/admin/useUsers'
import type { BulkResult } from '@/lib/trash'

interface TrashUsersDialogProps {
  /** One user (row menu, detail page) or several (bulk bar). Empty/null = nothing to confirm. */
  users: AdminUserRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the trash has run, with the per-user outcome — e.g. to leave a detail page or drop trashed ids from a selection. */
  onDone?: (result: BulkResult) => void
}

/**
 * The only confirm in the trash-first flow, and only for users: trashing bans
 * the login and revokes sessions, so they lose access the moment it runs.
 * Every other entity trashes immediately (Undo toast instead of a dialog).
 *
 * Deliberately NOT the red destructive style — it is reversible. Red is
 * reserved for permanent deletion, which only exists on the Trash page.
 */
export function TrashUsersDialog({ users, open, onOpenChange, onDone }: TrashUsersDialogProps) {
  const { trash, isPending } = useTrashActions()

  const title =
    users.length === 1
      ? `Move ${users[0].display_name} to trash?`
      : `Move ${users.length} users to trash?`

  async function handleConfirm() {
    if (users.length === 0) return
    const result = await trash([
      {
        entity: 'users',
        items: users.map((u) => ({ id: u.id, name: u.display_name })),
      },
    ])
    onOpenChange(false)
    onDone?.(result)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            They will be signed out and lose access immediately. You can restore them any time
            from Trash.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              // Keep the dialog open while the request is in flight so the
              // pending state is visible; it closes when the trash finishes.
              event.preventDefault()
              void handleConfirm()
            }}
          >
            {isPending ? 'Moving…' : 'Move to trash'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
