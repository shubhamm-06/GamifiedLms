import { QueryClient } from '@tanstack/react-query'

/**
 * Single shared instance. Lives here rather than in main.tsx so the
 * router can prime queries from `beforeLoad` (the admin guard) and the
 * components that later read them get a cache hit instead of refetching.
 */
export const queryClient = new QueryClient()

/**
 * Refetches every admin list, count and badge (users, courses, dashboard,
 * the Trash count, …) after a bulk change. The signed-in admin's session is
 * skipped: nothing a list action does changes who they are.
 */
export function invalidateAdminData(client: QueryClient) {
  return client.invalidateQueries({
    predicate: (q) => q.queryKey[0] === 'admin' && q.queryKey[1] !== 'session',
  })
}
