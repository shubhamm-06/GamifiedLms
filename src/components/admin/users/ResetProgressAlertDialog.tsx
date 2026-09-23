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
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCourseResetSummary,
  useResetCourseProgress,
  type EnrollmentWithCourse,
} from '@/hooks/admin/useUserDetail'

interface ResetProgressAlertDialogProps {
  userId: string
  /** The enrollment whose course is being reset. Kept while the dialog animates closed. */
  enrollment: EnrollmentWithCourse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Destructive and irreversible, so it states the real numbers rather than a
 * generic warning: the counts come from `fn_admin_course_progress_summary`,
 * the same SQL the reset itself acts on. The confirm stays disabled until
 * those numbers are on screen — nobody confirms a blank figure.
 */
export function ResetProgressAlertDialog({
  userId,
  enrollment,
  open,
  onOpenChange,
}: ResetProgressAlertDialogProps) {
  const courseId = open ? (enrollment?.course_id ?? null) : null
  const summary = useCourseResetSummary(userId, courseId)
  const reset = useResetCourseProgress(userId)

  const data = summary.data
  const nothingToRemove =
    !!data && data.progressRows === 0 && data.quizAttempts === 0 && data.xpToClawBack === 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Reset progress in &ldquo;{enrollment?.courses?.title}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This cannot be undone. Their enrollment itself is not changed, and they can
                work through the course again from the start.
              </p>

              {summary.isPending ? (
                <Skeleton className="h-20 w-full" />
              ) : summary.isError ? (
                <p className="text-coral-d">
                  Couldn&rsquo;t check what would be removed. Close this and try again.
                </p>
              ) : data ? (
                <ul className="bg-muted/50 space-y-1 rounded-md border p-3 text-sm">
                  <li>
                    <span className="font-medium tabular-nums">{data.lessonsCompleted}</span>{' '}
                    completed {data.lessonsCompleted === 1 ? 'lesson' : 'lessons'}
                    {data.progressRows !== data.lessonsCompleted ? (
                      <span className="text-muted-foreground">
                        {' '}
                        ({data.progressRows} progress{' '}
                        {data.progressRows === 1 ? 'record' : 'records'} in total, including
                        started-but-unfinished)
                      </span>
                    ) : null}
                  </li>
                  <li>
                    <span className="font-medium tabular-nums">{data.quizAttempts}</span> quiz{' '}
                    {data.quizAttempts === 1 ? 'attempt' : 'attempts'}
                  </li>
                  <li>
                    <span className="font-medium tabular-nums">{data.xpToClawBack}</span> XP
                    clawed back
                  </li>
                </ul>
              ) : null}

              <p className="text-muted-foreground text-xs">
                Streaks, badges, manual XP awards and XP from other courses are left alone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={reset.isPending || summary.isPending || summary.isError || nothingToRemove}
            onClick={(event) => {
              event.preventDefault()
              if (!enrollment) return
              reset.mutate(enrollment.course_id, { onSuccess: () => onOpenChange(false) })
            }}
          >
            {reset.isPending
              ? 'Resetting…'
              : nothingToRemove
                ? 'Nothing to reset'
                : 'Reset progress'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
