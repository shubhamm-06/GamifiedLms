import { useCallback, useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import { getNotificationsLastSeen, setNotificationsLastSeen } from '@/lib/notificationsLastSeen'
import { notificationsFeedKey, notificationsLastSeenKey, notificationsNewestKey } from '@/lib/notificationsQueryKeys'

export interface NotificationItem {
  id: string
  title: string
  body: string
  kind: string
  deepLink: string | null
  sentAt: string
}

const PAGE_SIZE = 50

async function currentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

async function fetchPage(from: number): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('v_my_notifications')
    .select('id, title, body, kind, deep_link, sent_at')
    .order('sent_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id ?? '',
    title: row.title ?? '',
    body: row.body ?? '',
    kind: row.kind ?? 'announcement',
    deepLink: row.deep_link,
    sentAt: row.sent_at ?? '',
  }))
}

/**
 * The student's notification feed: a manually-paged (page size 50, "Load
 * more" — no auto-infinite-scroll, no realtime) read of `v_my_notifications`,
 * newest first with an id tiebreak.
 *
 * "New" highlighting (`isNew`) is frozen at mount from a SNAPSHOT of the
 * device-local last-seen value, read once before this hook advances it — so
 * a card a student is still looking at doesn't lose its highlight mid-read.
 * Once the first page loads, last-seen is advanced to its newest `sent_at`
 * (a server timestamp) and mirrored into the shared last-seen query so the
 * bell dot clears immediately, everywhere it's shown.
 */
export function useNotificationsFeed() {
  const queryClient = useQueryClient()
  // undefined = not read yet (nothing should count as "new" until we know); null = never seen before (everything is new, once).
  const [snapshot, setSnapshot] = useState<string | null | undefined>(undefined)
  const advancedRef = useRef(false)

  const query = useInfiniteQuery({
    queryKey: notificationsFeedKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE),
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const userId = await currentUserId()
      if (cancelled || !userId) return
      const seen = await getNotificationsLastSeen(userId)
      if (!cancelled) setSnapshot(seen)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const firstPage = query.data?.pages[0]
  useEffect(() => {
    if (advancedRef.current || !firstPage || firstPage.length === 0) return
    advancedRef.current = true
    const newest = firstPage[0].sentAt
    void (async () => {
      const userId = await currentUserId()
      if (!userId) return
      await setNotificationsLastSeen(userId, newest)
      queryClient.setQueryData(notificationsLastSeenKey, newest)
    })()
  }, [firstPage, queryClient])

  const isNew = useCallback(
    (sentAt: string) => {
      if (snapshot === undefined) return false
      if (snapshot === null) return true
      return sentAt > snapshot
    },
    [snapshot],
  )

  const items = query.data?.pages.flat() ?? []
  return { ...query, items, isNew }
}

function useLastSeenQuery() {
  return useQuery({
    queryKey: notificationsLastSeenKey,
    queryFn: () => currentUserId().then((userId) => (userId ? getNotificationsLastSeen(userId) : null)),
    staleTime: Infinity, // only ever changes through our own writes (setQueryData/invalidate), never by itself going stale
  })
}

/**
 * Whether the bell should show its coral dot: the newest visible notification
 * is strictly after the device's last-seen value (or nothing has ever been
 * seen). Shows nothing (false) while either query is loading or failed —
 * never a flash of a dot that then disappears.
 *
 * Refetches the "newest" half on window focus, on Capacitor app resume, and
 * whenever something else (push received, the inbox page) invalidates
 * `notificationsNewestKey` — never on a timer, ~60s staleTime otherwise.
 */
export function useNotificationsDot(): boolean {
  const lastSeen = useLastSeenQuery()
  const newest = useQuery({
    queryKey: notificationsNewestKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_my_notifications')
        .select('sent_at')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data?.sent_at ?? null
    },
    staleTime: 60_000,
  })

  const refetchRef = useRef(newest.refetch)
  useEffect(() => {
    refetchRef.current = newest.refetch
  })

  useEffect(() => {
    const onFocus = () => void refetchRef.current()
    window.addEventListener('focus', onFocus)
    let handle: Promise<PluginListenerHandle> | null = null
    if (Capacitor.isNativePlatform()) {
      handle = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refetchRef.current()
      })
    }
    return () => {
      window.removeEventListener('focus', onFocus)
      if (handle) void handle.then((h) => h.remove())
    }
  }, [])

  if (newest.isPending || newest.isError || lastSeen.isPending || lastSeen.isError) return false
  if (newest.data == null) return false
  if (lastSeen.data == null) return true
  return newest.data > lastSeen.data
}
