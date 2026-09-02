import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export interface AdminSession {
  userId: string
  role: string
}

export const adminSessionQueryKey = ['admin', 'session'] as const

async function fetchAdminSession(): Promise<AdminSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (error || !profile) return null

  return { userId: session.user.id, role: profile.role }
}

export const adminSessionQueryOptions = {
  queryKey: adminSessionQueryKey,
  queryFn: fetchAdminSession,
  // Short window so a revoked admin loses the UI quickly, while still
  // deduping the beforeLoad fetch and the component's own read. This is
  // convenience only — RLS and the Edge Function's role check are the
  // real enforcement, and neither trusts this cache.
  staleTime: 30_000,
  retry: false,
}

/**
 * Route-level guard for /admin. Runs in `beforeLoad` so an unauthorised
 * visitor never renders a frame of protected content, and primes the
 * cache that <AdminGuard> reads so there's no second fetch on mount.
 *
 * A non-admin is bounced to '/' with no explanation — telling them an
 * admin area exists is itself a small disclosure.
 */
export async function requireAdmin(queryClient: QueryClient, href: string) {
  const session = await queryClient.ensureQueryData(adminSessionQueryOptions)

  if (!session) {
    throw redirect({ to: '/login', search: { redirect: href } })
  }

  if (session.role !== 'admin') {
    throw redirect({ to: '/' })
  }

  return session
}
