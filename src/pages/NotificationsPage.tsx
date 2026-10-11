import { useRouter } from '@tanstack/react-router'
import { Bell, ChevronRight, Megaphone } from 'lucide-react'
import { useKidHeader } from '@/components/kid/kidHeader'
import { RetryScreen, Screen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotificationsFeed, type NotificationItem } from '@/hooks/useNotifications'
import { formatNotificationTime } from '@/lib/notificationTime'

/**
 * `/notifications`: the read-only student inbox (migration 042). No bottom
 * nav on this route (it isn't one of the four KID_TABS, so `KidLayout` never
 * mounts one for it); the mobile top bar's Back button comes the same way.
 * No mark-read, no dismiss, no delete here — students can only view
 * (rules.md "no read tracking in the database"). Manual "Load more" paging,
 * no realtime: a fresh load is the only way newer messages appear.
 */
export function NotificationsPage() {
  const router = useRouter()
  useKidHeader('Notifications')
  const { items, isNew, isPending, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useNotificationsFeed()

  if (isPending) return <NotificationsSkeleton />
  if (isError) {
    return <RetryScreen title="Oops! We couldn't load your notifications" onRetry={() => void refetch()} />
  }
  if (items.length === 0) {
    return (
      <Screen
        testId="state-no-notifications"
        icon={<Bell className="size-8" aria-hidden />}
        title="No notifications yet"
        body="Messages from your teachers will show up here."
      />
    )
  }

  return (
    <div className="kn-page">
      <ul className="kn-list" data-testid="notifications-list">
        {items.map((item) => (
          <NotificationCard key={item.id} item={item} isNew={isNew(item.sentAt)} onOpen={(path) => router.history.push(path)} />
        ))}
      </ul>
      {hasNextPage ? (
        <button
          type="button"
          className="candy-btn-quiet kid-tap kn-loadmore"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          data-testid="notifications-load-more"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  )
}

function NotificationCard({
  item,
  isNew,
  onOpen,
}: {
  item: NotificationItem
  isNew: boolean
  onOpen: (path: string) => void
}) {
  const Icon = item.kind === 'system' ? Bell : Megaphone
  const content = (
    <>
      <span className="kn-icon" aria-hidden>
        <Icon className="size-5" />
        {isNew ? <span className="kid-dot" aria-hidden /> : null}
      </span>
      <span className="kn-text">
        <span className="kn-title">
          {item.title}
          {isNew ? <span className="sr-only"> (new)</span> : null}
        </span>
        <span className="kn-body">{item.body}</span>
        <span className="kn-time">{formatNotificationTime(item.sentAt)}</span>
      </span>
      {item.deepLink ? <ChevronRight className="kn-chevron size-5" aria-hidden /> : null}
    </>
  )
  return (
    <li>
      {item.deepLink ? (
        <button
          type="button"
          className="kn-card kid-card kid-tap"
          data-new={isNew ? 'true' : undefined}
          data-testid="notification-card"
          onClick={() => onOpen(item.deepLink!)}
        >
          {content}
        </button>
      ) : (
        <div className="kn-card kid-card" data-new={isNew ? 'true' : undefined} data-testid="notification-card">
          {content}
        </div>
      )}
    </li>
  )
}

function NotificationsSkeleton() {
  return (
    <div className="kn-page" aria-busy="true" aria-label="Loading your notifications">
      <ul className="kn-list">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <Skeleton className="h-24 w-full rounded-[26px] bg-ink/10" />
          </li>
        ))}
      </ul>
    </div>
  )
}
