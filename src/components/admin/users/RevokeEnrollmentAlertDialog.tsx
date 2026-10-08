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
import { useRevokeEnrollment, type EnrollmentWithCourse } from '@/hooks/admin/useUserDetail'
import { getTerms as tw } from '@/lib/settings/terms'

interface RevokeEnrollmentAlertDialogProps {
  userId: string
  enrollment: EnrollmentWithCourse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RevokeEnrollmentAlertDialog({
  userId,
  enrollment,
  open,
  onOpenChange,
}: RevokeEnrollmentAlertDialogProps) {
  const revoke = useRevokeEnrollment(userId)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Revoke access to &ldquo;{enrollment?.courses?.title}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {`They immediately lose access to this ${tw().lower('course')}. There is no undo — re-enrolling later`}{' '}
            starts a fresh enrollment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.isPending}
            onClick={(event) => {
              event.preventDefault()
              if (!enrollment) return
              revoke.mutate(enrollment.id, { onSuccess: () => onOpenChange(false) })
            }}
          >
            {revoke.isPending ? 'Revoking…' : 'Revoke access'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
