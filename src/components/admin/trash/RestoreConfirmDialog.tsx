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

interface RestoreConfirmDialogProps {
  /** Only courses and modules need this: restoring one reveals its children. */
  entity: 'courses' | 'modules'
  count: number
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * Restoring a course or module doesn't touch its children — it un-hides them,
 * exactly as they were. Say so before doing it: a course can carry a lot of
 * content that the admin may not have been thinking about.
 */
export function RestoreConfirmDialog({
  entity,
  count,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: RestoreConfirmDialogProps) {
  const noun = entity === 'courses' ? 'course' : 'module'
  const children = entity === 'courses' ? 'modules and lessons' : 'lessons'
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Restore {count} {count === 1 ? noun : `${noun}s`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Their {children} will reappear exactly as they were. Anything that was moved to trash
            on its own stays in the trash.
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
            {pending ? 'Restoring…' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
