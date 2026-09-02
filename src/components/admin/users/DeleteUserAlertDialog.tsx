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
import { useDeleteUser } from '@/hooks/admin/useUserMutations'
import type { AdminUserRow } from '@/hooks/admin/useUsers'

interface DeleteUserAlertDialogProps {
  user: AdminUserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteUserAlertDialog({ user, open, onOpenChange }: DeleteUserAlertDialogProps) {
  const deleteUser = useDeleteUser()

  function handleConfirm() {
    if (!user) return
    deleteUser.mutate(
      { userId: user.id, displayName: user.display_name },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user?.display_name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes their account, profile, and progress. This can&rsquo;t be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteUser.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteUser.isPending}
            onClick={(event) => {
              // Keep the dialog open while the request is in flight so
              // the pending state is visible; it closes on success.
              event.preventDefault()
              handleConfirm()
            }}
          >
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
