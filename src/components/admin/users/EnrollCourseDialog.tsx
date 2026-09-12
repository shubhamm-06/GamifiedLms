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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCourses, type Course } from '@/hooks/admin/useCourses'
import { useEnrollUser } from '@/hooks/admin/useUserDetail'

interface EnrollCourseDialogProps {
  userId: string
  /** Course ids already enrolled (any status) — offered but will be refused by the unique constraint if picked again. */
  alreadyEnrolledIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Mounts fresh per open, so the picker doesn't carry a stale selection over. */
function EnrollCourseForm({
  userId,
  courses,
  onDone,
}: {
  userId: string
  courses: Course[]
  onDone: () => void
}) {
  const enroll = useEnrollUser(userId)
  const [courseId, setCourseId] = useState('')

  const selected = courses.find((c) => c.id === courseId)

  function handleSubmit() {
    if (!selected) return
    enroll.mutate(
      {
        id: selected.id,
        access_type: selected.access_type,
        access_duration_days: selected.access_duration_days,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="enroll-course">Course</Label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger id="enroll-course" className="w-full">
            <SelectValue placeholder="Select a published course…" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected ? (
          <p className="text-muted-foreground text-xs">
            {selected.access_type === 'fixed'
              ? `Expires ${selected.access_duration_days} days from today.`
              : 'Lifetime access — never expires.'}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={enroll.isPending}>
          Cancel
        </Button>
        <Button type="button" disabled={!selected || enroll.isPending} onClick={handleSubmit}>
          {enroll.isPending ? 'Enrolling…' : 'Enroll'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function EnrollCourseDialog({
  userId,
  alreadyEnrolledIds,
  open,
  onOpenChange,
}: EnrollCourseDialogProps) {
  const { data: allCourses } = useCourses()
  const enrolledSet = new Set(alreadyEnrolledIds)
  // Manual enroll is scoped to published courses only — a draft has no
  // content ready to hand a student, and an archived one is retired.
  // Already-enrolled courses (any status) are excluded too: the unique
  // (user_id, course_id) constraint means picking one is a guaranteed
  // failure, even if the existing row was revoked.
  const publishableCourses = (allCourses ?? []).filter(
    (c) => c.status === 'published' && !enrolledSet.has(c.id),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll in a course</DialogTitle>
          <DialogDescription>
            {publishableCourses.length === 0
              ? 'No published courses exist yet.'
              : 'Grants access immediately, as a manual enrollment.'}
          </DialogDescription>
        </DialogHeader>
        {publishableCourses.length > 0 ? (
          <EnrollCourseForm
            key={alreadyEnrolledIds.join(',')}
            userId={userId}
            courses={publishableCourses}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
