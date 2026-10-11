import { useState } from 'react'
import { Search, Send } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { UserPicker } from '@/components/admin/UserPicker'
import { NotificationsHistoryTable } from '@/components/admin/notifications/NotificationsHistoryTable'
import { TrashNotificationDialog } from '@/components/admin/notifications/TrashNotificationDialog'
import { useTableSelection } from '@/components/admin/selection/useTableSelection'
import { useCourses } from '@/hooks/admin/useCourses'
import {
  targetLabel,
  useNotificationsHistory,
  useSendNotification,
  type NotificationHistoryRow,
} from '@/hooks/admin/useNotifications'
import { useTrashActions } from '@/hooks/admin/useTrashActions'
import { type AdminUserRow } from '@/hooks/admin/useUsers'
import { type NotificationTarget } from '@/lib/adminNotificationsApi'
import { getTerms as tw } from '@/lib/settings/terms'

const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 1000

type TargetKind = 'all' | 'course' | 'user'

const TARGET_LABEL: Record<TargetKind, string> = {
  all: 'Everyone',
  course: `A specific ${tw().lower('course')}`,
  user: 'A specific student',
}

/**
 * The compose form and send history for manual push/inbox notifications
 * (migration 031, extended migration 042 for the student notifications
 * inbox; `send-push-notification` deployed, ACTIVE, version 5).
 */
export function NotificationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Send a push notification, a student-inbox message, or both. Push reaches Android devices only.
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
  const [sendPush, setSendPush] = useState(true)
  const [showInInbox, setShowInInbox] = useState(true)
  const [linkCourseId, setLinkCourseId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: courses } = useCourses()
  const linkableCourses = (courses ?? []).filter((c) => c.status === 'published')
  const sendNotification = useSendNotification()

  const bothOff = !sendPush && !showInInbox

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
    if (targetKind === 'course' && !courseId) next.target = `Pick ${tw().lower('course')}.`
    if (targetKind === 'user' && !user) next.target = 'Pick a student.'
    if (bothOff) next.delivery = 'Turn on push, the inbox, or both before sending.'

    setErrors(next)
    if (Object.keys(next).length > 0 || !target) return

    sendNotification.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        target,
        sendPush,
        showInInbox,
        deepLink: linkCourseId ? `/courses/${linkCourseId}` : null,
      },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setLinkCourseId('')
          setTargetKind('all')
          setCourseId('')
          setUser(null)
          setSendPush(true)
          setShowInInbox(true)
          setErrors({})
        },
      },
    )
  }

  const previewCourse = linkableCoursesFind(courses ?? [], courseId)
  const audience =
    targetKind === 'course'
      ? `Students in ${targetLabel({ target_type: 'course', target_course_title: previewCourse?.title ?? null, target_user_name: null })}`
      : targetLabel({ target_type: targetKind, target_course_title: null, target_user_name: user?.display_name ?? null })

  return (
    <section className="max-w-2xl rounded-lg border p-4">
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
            placeholder={`New ${tw().lower('lesson', true)} are up!`}
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
            <Label>{`${tw().term('course')}`}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Pick ${tw().lower('course')}…`} />
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

        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notif-send-push">Send as push notification</Label>
            </div>
            <Switch id="notif-send-push" checked={sendPush} onCheckedChange={setSendPush} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notif-show-inbox">Show in student inbox</Label>
            </div>
            <Switch id="notif-show-inbox" checked={showInInbox} onCheckedChange={setShowInInbox} />
          </div>
          <p className="text-muted-foreground text-xs">
            Push buzzes phones right away; the inbox keeps the message visible for students who miss it or use the
            web.
          </p>
          {errors.delivery ? <p className="text-coral-d text-sm">{errors.delivery}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label>{`Link to a ${tw().lower('course')} (optional)`}</Label>
          <Select
            value={linkCourseId || 'none'}
            onValueChange={(v) => setLinkCourseId(v === 'none' ? '' : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No link" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No link</SelectItem>
              {linkableCourses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {`Tapping the notification opens that ${tw().lower('course')}. Only published ${tw().lower('course', true)} can be linked.`}
          </p>
        </div>

        <p className="text-muted-foreground text-sm">
          <span className="font-medium text-foreground">Who sees this:</span> {audience}
        </p>

        <Button onClick={handleSubmit} disabled={sendNotification.isPending || bothOff}>
          <Send />
          {sendNotification.isPending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </section>
  )
}

function linkableCoursesFind(courses: { id: string; title: string }[], id: string) {
  return courses.find((c) => c.id === id)
}

function HistorySection() {
  const { data, isPending, isError } = useNotificationsHistory()
  const rows = data ?? []
  const [search, setSearch] = useState('')
  const selection = useTableSelection([search])
  const { trash, isPending: trashing } = useTrashActions()
  const [trashTargets, setTrashTargets] = useState<NotificationHistoryRow[]>([])

  const selectedRows = rows.filter((r) => selection.rowSelection[r.id])

  async function doTrash(target: NotificationHistoryRow[]) {
    const result = await trash([
      { entity: 'notifications', items: target.map((r) => ({ id: r.id, name: r.title })) },
    ])
    selection.removeIds(result.succeeded.map((item) => item.id))
    setTrashTargets([])
  }

  return (
    <section className="rounded-lg border">
      <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold">History</h2>
        <div className="relative max-w-sm flex-1 sm:flex-none">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            className="pl-8"
            placeholder="Search title or body…"
            aria-label="Search notification history"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>
      <div className="p-4">
        <NotificationsHistoryTable
          rows={rows}
          isPending={isPending}
          isError={isError}
          search={search}
          onTrash={(row) => setTrashTargets([row])}
          selection={selection}
          bulkActions={
            <Button variant="destructive" size="sm" onClick={() => setTrashTargets(selectedRows)}>
              Move to trash
            </Button>
          }
        />
      </div>

      <TrashNotificationDialog
        count={trashTargets.length}
        open={trashTargets.length > 0}
        pending={trashing}
        onOpenChange={(open) => !open && setTrashTargets([])}
        onConfirm={() => void doTrash(trashTargets)}
      />
    </section>
  )
}
