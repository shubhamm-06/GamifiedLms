import { QueryClient } from '@tanstack/react-query'

/**
 * Single shared instance. Lives here rather than in main.tsx so the
 * router can prime queries from `beforeLoad` (the admin guard) and the
 * components that later read them get a cache hit instead of refetching.
 */
export const queryClient = new QueryClient()
