import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { unregisterPushToken } from '@/lib/pushNotifications'
import { supabase } from '@/lib/supabase'

/** Log out: best-effort push-token removal, sign out, drop every kid query, go to /login. */
export function useLogOut() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [leaving, setLeaving] = useState(false)
  async function logOut() {
    setLeaving(true)
    // Best-effort, and before signOut: the delete is RLS-scoped to the current
    // session, and must never delay or block leaving even if it fails.
    await unregisterPushToken().catch(() => {})
    await supabase.auth.signOut()
    // Every kid query is keyed without the user, so drop them all before the next sign-in.
    queryClient.clear()
    void navigate({ to: '/login' })
  }
  return { leaving, logOut }
}
