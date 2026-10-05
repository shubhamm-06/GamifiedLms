import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

interface AdminSession {
  userId: string
  role: string
  displayName: string
}

const adminSessionQueryKey = ['admin', 'session'] as const

async function fetchAdminSession(): Promise<AdminSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  // Role is read from public.profiles, never from JWT claims or client state
  // — a JWT is issued once and would keep asserting 'admin' after the row
  // was demoted. RLS lets any user select their own profile row.
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', session.user.id)
    .single()

  if (error || !profile) return null

  return {
    userId: session.user.id,
    role: profile.role,
    displayName: profile.display_name,
  }
}

export const adminSessionQueryOptions = {
  queryKey: adminSessionQueryKey,
  queryFn: fetchAdminSession,
  // Only governs component reads (topbar name, AdminGuard's render check).
  // The route guard below deliberately bypasses this.
  staleTime: 30_000,
  retry: false,
}

/** Forces a network read, ignoring the cached window above. */
function fetchFreshSession(queryClient: QueryClient) {
  return queryClient.fetchQuery({ ...adminSessionQueryOptions, staleTime: 0 })
}

/**
 * Rejects anything that isn't a same-origin absolute path. `redirect` is a
 * URL search param, so it is fully attacker-controlled — without this an
 * `/login?redirect=https://evil.example` link would bounce a freshly
 * authenticated admin straight off-origin.
 */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path) return null
  // Must be rooted, and must not be protocol-relative ("//host") or contain
  // a backslash (some browsers normalise "/\host" to an off-origin URL).
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  return path
}

/**
 * Route-level guard for `/admin`. Lives on the `/admin` layout route, so
 * every descendant inherits it and a new admin page can't be added without
 * the check. `beforeLoad` resolves before any component mounts, so protected
 * content never paints — the route's `pendingComponent` covers the wait.
 *
 * Re-reads the role from the database on every run rather than trusting the
 * cached value, so a revoked admin loses access on their next navigation.
 *
 * A non-admin is bounced to '/' with no explanation — telling them an admin
 * area exists at all is itself a small disclosure.
 */
export async function requireAdmin(queryClient: QueryClient, href: string) {
  const session = await fetchFreshSession(queryClient)

  if (!session) {
    throw redirect({ to: '/login', search: { redirect: href } })
  }

  if (session.role !== 'admin') {
    throw redirect({ to: '/' })
  }

  return session
}

/**
 * Guard for `/login`. An admin who already has a live session shouldn't be
 * shown the form again — this runs off the session itself rather than the
 * submit handler, so it also covers reopening `/login` in a new tab or
 * returning to a restored session.
 *
 * Deliberately only redirects admins: students keep their existing behaviour.
 */
export async function redirectIfAdminAlreadySignedIn(
  queryClient: QueryClient,
  requestedRedirect?: string,
) {
  const session = await fetchFreshSession(queryClient)
  if (session?.role !== 'admin') return

  // `href` rather than `to`: the target is a runtime string, not one of the
  // statically-known route paths.
  throw redirect({ href: safeInternalPath(requestedRedirect) ?? '/admin' })
}

/**
 * Where to send someone immediately after a successful sign-in. Admins get
 * the admin area (or the deep path the guard bounced them from); everyone
 * else keeps the existing student destination.
 */
export async function resolvePostLoginPath(
  queryClient: QueryClient,
  requestedRedirect?: string,
): Promise<string> {
  const session = await fetchFreshSession(queryClient)
  const target = safeInternalPath(requestedRedirect)

  if (session?.role === 'admin') return target ?? '/admin'

  // A non-admin can reach /login carrying an /admin redirect (they hit an
  // admin URL while logged out). Honouring it would just bounce them off the
  // guard a moment later, so drop it.
  if (target && target.startsWith('/admin')) return '/'
  return target ?? '/'
}

/** Clears the cached session so a signed-out user can't be seen as an admin. */
export function clearAdminSession(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: adminSessionQueryKey })
}
