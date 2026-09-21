import { redirect } from '@tanstack/react-router'
import { supabase } from './supabase'

/**
 * Route-level guard for every student (kid-facing) route: no session sends the
 * visitor to /login carrying the page they were after, and login returns them
 * to it (`resolvePostLoginPath` already honours a same-origin `redirect`).
 *
 * There is deliberately NO role check here. What a signed-in user may see is
 * decided by RLS and the lesson-engine functions (an unenrolled student gets
 * `not_enrolled`, a trashed one likewise), never by this guard — it only
 * answers "is anyone signed in".
 */
export async function requireStudentSession(href: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw redirect({ to: '/login', search: { redirect: href } })
  }
  return session
}
