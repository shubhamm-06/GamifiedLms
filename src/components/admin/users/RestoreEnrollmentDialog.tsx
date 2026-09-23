import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  deriveRestoreExpiry,
  fromDateInputValue,
  toDateInputValue,
  useRestoreEnrollment,
  type EnrollmentWithCourse,
} from '@/hooks/admin/useUserDetail'

interface RestoreEnrollmentDialogProps {
  userId: string
  /** The revoked enrollment being restored. Kept while the dialog animates closed. */
  enrollment: EnrollmentWithCourse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Mounts fresh per open, so the dates never carry over from a previous course. */
function RestoreForm({
  userId,
  enrollment,
  onDone,
}: {
  userId: string
  enrollment: EnrollmentWithCourse
  onDone: () => void
}) {
  const restore = useRestoreEnrollment(userId)

  const todayValue = toDateInputValue(new Date())
  const [enrolledDate, setEnrolledDate] = useState(todayValue)
  const derivedExpiry = deriveRestoreExpiry(enrollment, fromDateInputValue(todayValue))
  const [expiryDate, setExpiryDate] = useState(derivedExpiry ? toDateInputValue(derivedExpiry) : '')
  // Once the admin edits the expiry by hand, changing the start date stops
  // moving it for them — otherwise their own value would be overwritten.
  const [expiryTouched, setExpiryTouched] = useState(false)

  function handleEnrolledChange(value: string) {
    setEnrolledDate(value)
    if (expiryTouched || !value) return
    const next = deriveRestoreExpiry(enrollment, fromDateInputValue(value))
    setExpiryDate(next ? toDateInputValue(next) : '')
  }

  function handleSubmit() {
    if (!enrolledDate) return
    restore.mutate(
      {
        courseId: enrollment.course_id,
        enrolledAt: fromDateInputValue(enrolledDate),
        expiresAt: expiryDate ? fromDateInputValue(expiryDate) : null,
      },
      { onSuccess: onDone },
    )
  }

  const wasLifetime = !enrollment.expires_at

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="restore-enrolled-at">Enrollment date</Label>
        <Input
          id="restore-enrolled-at"
          type="date"
          value={enrolledDate}
          onChange={(event) => handleEnrolledChange(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="restore-expires-at">Expires</Label>
        <Input
          id="restore-expires-at"
          type="date"
          value={expiryDate}
          onChange={(event) => {
            setExpiryTouched(true)
            setExpiryDate(event.target.value)
          }}
        />
        <p className="text-muted-foreground text-xs">
          {wasLifetime
            ? 'The revoked enrollment was lifetime, so this one is too. Set a date to limit it.'
            : 'Defaults to the same length of access the revoked enrollment had. Leave empty for lifetime.'}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={restore.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={restore.isPending || !enrolledDate}>
          {restore.isPending ? 'Restoring…' : 'Restore access'}
        </Button>
      </DialogFooter>
    </div>
  )
}

/**
 * Restoring is a NEW enrollment, not an un-revoke: the revoked row stays on
 * the page as history and this adds a fresh active one above it (migration
 * 021). The admin sets both dates because a restore often backdates to when
 * access should have resumed.
 */
export function RestoreEnrollmentDialog({
  userId,
  enrollment,
  open,
  onOpenChange,
}: RestoreEnrollmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore access to &ldquo;{enrollment?.courses?.title}&rdquo;</DialogTitle>
          <DialogDescription>
            This creates a new enrollment. The revoked one is kept as history, and their
            progress is not affected either way.
          </DialogDescription>
        </DialogHeader>
        {enrollment ? (
          <RestoreForm
            userId={userId}
            enrollment={enrollment}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
