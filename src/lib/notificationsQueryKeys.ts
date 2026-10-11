/**
 * Shared TanStack Query keys for the notifications inbox (migration 042),
 * split out from `useNotifications.ts` so `pushNotifications.ts` (a foreground
 * push listener invalidating the dot) can reference them without importing
 * hook code.
 */
export const notificationsFeedKey = ['notifications', 'feed'] as const
/** The newest `sent_at` currently visible in the inbox — what the dot compares against last-seen. */
export const notificationsNewestKey = ['notifications', 'newest'] as const
/** The device-local last-seen timestamp, mirrored into the query cache so every reader (dot, page) updates at once. */
export const notificationsLastSeenKey = ['notifications', 'lastSeen'] as const
