import { useState } from 'react'
import { createColumnHelper, tableFeatures } from '@tanstack/table-core'
import { useTable } from '@tanstack/react-table'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { UserPicker } from '@/components/admin/UserPicker'
import { useCourses } from '@/hooks/admin/useCourses'
import { useNotificationsHistory, useSendNotification, type NotificationHistoryRow } from '@/hooks/admin/useNotifications'
import { type AdminUserRow } from '@/hooks/admin/useUsers'
import { type NotificationTarget } from '@/lib/adminNotificationsApi'

const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 1000

type TargetKind = 'all' | 'course' | 'user'

const TARGET_LABEL: Record<TargetKind, string> = {
  all: 'Everyone',
  course: 'A specific course',
  user: 'A specific student',
}

/**
 * The compose form and send history for manual push notifications
 * (migration 031, `send-push-notification`). Send-only, log-only: there is
 * no editing or resending from the history table in this pass.
 *
 * NOT YET DEPLOYED (`env-deploy.md` "Push notifications"): Send will fail
 * until `send-push-notification` is deployed and `FCM_SERVICE_ACCOUNT_JSON`
 * is set. The failure surfaces through the same error toast every other
 * admin action uses (`useSendNotification`), not a special-cased message —
 * intentionally not stubbed or mocked.
 */
export function NotificationsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Send a push notification to Android devices. Web and iOS are not covered.
        </p>
      </header>
      <ComposeSection />
      <HistorySection />
    </div>
  )
}

function ComposeSection() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetKind, setTargetKind] = useState<TargetKind>('all')
  const [courseId, setCourseId] = useState('')
  const [user, setUser] = useState<AdminUserRow | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: courses } = useCourses()
  const sendNotification = useSendNotification()

  function handleTargetKindChange(next: TargetKind) {
    setTargetKind(next)
    setCourseId('')
    setUser(null)
  }

  function buildTarget(): NotificationTarget | null {
    if (targetKind === 'all') return { type: 'all' }
    if (targetKind === 'course') return courseId ? { type: 'course', courseId } : null
    return user ? { type: 'user', userId: user.id } : null
  }

  function handleSubmit() {
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = 'Title is required.'
    else if (title.length > MAX_TITLE_LENGTH) next.title = `Title must be at most ${MAX_TITLE_LENGTH} characters.`
    if (!body.trim()) next.body = 'Body is required.'
    else if (body.length > MAX_BODY_LENGTH) next.body = `Body must be at most ${MAX_BODY_LENGTH} characters.`

    const target = buildTarget()
    if (targetKind === 'course' && !courseId) next.target = 'Pick a course.'
    if (targetKind === 'user' && !user) next.target = 'Pick a student.'

    setErrors(next)
    if (Object.keys(next).length > 0 || !target) return

    sendNotification.mutate(
      { title: title.trim(), body: body.trim(), target },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
        },
      },
    )
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Compose</h2>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="notif-title">Title</Label>
          <Input
            id="notif-title"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New lessons are up!"
          />
          {errors.title ? <p className="text-coral-d text-sm">{errors.title}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notif-body">Body</Label>
          <Textarea
            id="notif-body"
            value={body}
            maxLength={MAX_BODY_LENGTH}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Come see what's new today."
            rows={3}
          />
          {errors.body ? <p className="text-coral-d text-sm">{errors.body}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Send to</Label>
          <Select value={targetKind} onValueChange={(v) => handleTargetKindChange(v as TargetKind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TARGET_LABEL) as TargetKind[]).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {TARGET_LABEL[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {targetKind === 'course' ? (
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a course…" />
              </SelectTrigger>
              <SelectContent>
                {(courses ?? []).map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.target ? <p className="text-coral-d text-sm">{errors.target}</p> : null}
          </div>
        ) : null}
        {targetKind === 'user' ? (
          <div className="space-y-1.5">
            <Label>Student</Label>
            <UserPicker selected={user} onSelect={setUser} />
            {errors.target ? <p className="text-coral-d text-sm">{errors.target}</p> : null}
          </div>
        ) : null}
        <Button onClick={handleSubmit} disabled={sendNotification.isPending}>
          <Send />
          {sendNotification.isPending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </section>
  )
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

function formatRelativeTime(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime()
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return relativeFormatter.format(-Math.round(elapsed / ms), unit)
    }
  }
  return 'just now'
}

function targetLabel(row: NotificationHistoryRow): string {
  if (row.target_type === 'course') return row.target_course_title ?? 'A course'
  if (row.target_type === 'user') return row.target_user_name ?? 'A student'
  return 'Everyone'
}

// Read-only report table, no records anyone can act on here (rules.md /
// ui.md's documented exception, same as the Dashboard's recent-activity
// feed) — TanStack Table v9 shape, but no row-selection feature.
const historyFeatures = tableFeatures({})
const columnHelper = createColumnHelper<typeof historyFeatures, NotificationHistoryRow>()
const historyColumns = columnHelper.columns([
  columnHelper.accessor('sent_at', {
    id: 'when',
    header: 'Sent',
    cell: (info) => <span className="text-muted-foreground whitespace-nowrap">{formatRelativeTime(info.getValue())}</span>,
  }),
  columnHelper.accessor('title', {
    id: 'title',
    header: 'Title',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('body', {
    id: 'body',
    header: 'Body',
    cell: (info) => <span className="text-muted-foreground line-clamp-1">{info.getValue()}</span>,
  }),
  columnHelper.display({
    id: 'target',
    header: 'Target',
    cell: (info) => targetLabel(info.row.original),
  }),
  columnHelper.accessor('recipient_count', {
    id: 'recipients',
    header: 'Recipients',
    cell: (info) => {
      const count = info.getValue()
      return count === null ? <span className="text-muted-foreground">Unknown (topic)</span> : count
    },
  }),
  columnHelper.accessor('sent_by_name', {
    id: 'sent_by',
    header: 'Sent by',
    cell: (info) => info.getValue() ?? 'Unknown',
  }),
])

function HistorySection() {
  const { data, isPending, isError } = useNotificationsHistory()
  const table = useTable({
    features: historyFeatures,
    columns: historyColumns,
    data: data ?? [],
  })

  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">History</h2>
      </header>
      {isPending ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-coral-d p-4 text-sm">Couldn&rsquo;t load notification history.</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">No notifications sent yet.</p>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    <table.FlexRender header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
