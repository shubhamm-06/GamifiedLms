import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DEFAULT_AVATAR, parseAvatarConfig, type AvatarConfig } from '@/lib/avatar'

export const kidProfileKey = ['kid', 'profile'] as const

async function currentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('signed_out')
  return session
}

export interface KidProfile {
  displayName: string
  avatarConfig: AvatarConfig
  email: string
  totalXp: number
  level: number
  currentStreak: number
}

/**
 * The signed-in student's name, avatar, email and stats. No XP yet means no
 * `user_stats` row: zeros, level 1. `avatar_config` is parsed defensively (the
 * database CHECK already guarantees its shape, but a null row — never
 * customized — falls back to `DEFAULT_AVATAR` here, the one place that
 * decides that).
 *
 * Email sync: `profiles.email` is set once at signup and nothing re-syncs it
 * when Supabase Auth's own email changes (that happens only after the
 * student clicks the confirmation link, on this device or another). So each
 * read compares the session's confirmed email against the stored copy and,
 * if they differ, updates `profiles.email` to match — the self-update policy
 * already allows this. Until confirmation, `session.user.email` is still the
 * old address, so nothing here ever shows or stores the pending one early.
 */
export function useKidProfile() {
  return useQuery<KidProfile, Error>({
    queryKey: kidProfileKey,
    queryFn: async () => {
      const session = await currentSession()
      const uid = session.user.id
      const [profileRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_config, email').eq('id', uid).maybeSingle(),
        supabase.from('user_stats').select('total_xp, level, current_streak').eq('user_id', uid).maybeSingle(),
      ])
      if (profileRes.error) throw profileRes.error
      if (statsRes.error) throw statsRes.error

      let email = profileRes.data?.email ?? session.user.email ?? ''
      const confirmedEmail = session.user.email
      if (confirmedEmail && profileRes.data && confirmedEmail !== profileRes.data.email) {
        const { error } = await supabase.from('profiles').update({ email: confirmedEmail }).eq('id', uid)
        if (!error) email = confirmedEmail
      }

      return {
        displayName: profileRes.data?.display_name ?? '',
        avatarConfig: parseAvatarConfig(profileRes.data?.avatar_config),
        email,
        totalXp: statsRes.data?.total_xp ?? 0,
        level: statsRes.data?.level ?? 1,
        currentStreak: statsRes.data?.current_streak ?? 0,
      }
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

/** Saves the avatar builder's config. Every reader of `kidProfileKey` (the profile page, the nav tab) updates at once. */
export function useUpdateAvatar() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, AvatarConfig>({
    mutationFn: async (config) => {
      const session = await currentSession()
      const { error } = await supabase.from('profiles').update({ avatar_config: { ...config } }).eq('id', session.user.id)
      if (error) throw error
    },
    onSuccess: (_void, config) => {
      queryClient.setQueryData<KidProfile | undefined>(kidProfileKey, (prev) => (prev ? { ...prev, avatarConfig: config } : prev))
      void queryClient.invalidateQueries({ queryKey: kidProfileKey })
    },
  })
}

/** Direct update, no confirmation: `profiles.display_name` has no auth-side counterpart to keep in sync. */
export function useUpdateDisplayName() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (displayName) => {
      const session = await currentSession()
      const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', session.user.id)
      if (error) throw error
    },
    onSuccess: (_void, displayName) => {
      queryClient.setQueryData<KidProfile | undefined>(kidProfileKey, (prev) => (prev ? { ...prev, displayName } : prev))
    },
  })
}

/**
 * Starts an email change through Supabase Auth. This only asks Auth to send a
 * confirmation link to the new address; nothing takes effect, and nothing in
 * `profiles` changes, until the student opens that link (`useKidProfile`'s
 * sync then catches up on the next read).
 */
export function useRequestEmailChange() {
  return useMutation<void, Error, string>({
    mutationFn: async (email) => {
      const { error } = await supabase.auth.updateUser({ email })
      if (error) throw error
    },
  })
}

/**
 * Changes the account password, but only after confirming the CURRENT one by
 * signing in with it — a lightweight check against a shared or left-open
 * device, not full reauthentication. `signInWithPassword` also refreshes the
 * session, which is fine: it is still the same account.
 */
export function useChangePassword() {
  return useMutation<void, Error, { currentPassword: string; newPassword: string }>({
    mutationFn: async ({ currentPassword, newPassword }) => {
      const session = await currentSession()
      const email = session.user.email
      if (!email) throw new Error('no_email')
      const check = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (check.error) throw new Error('wrong_password')
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },
  })
}

export interface KidBadge {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  earned: boolean
}

/** Every active badge with whether the signed-in student has earned it (earned first, then by name). */
export function useKidBadges() {
  return useQuery<KidBadge[], Error>({
    queryKey: ['kid', 'badges'],
    queryFn: async () => {
      const session = await currentSession()
      const uid = session.user.id
      const [badgesRes, earnedRes] = await Promise.all([
        supabase.from('badges').select('id, name, description, icon_url').eq('is_active', true).order('name'),
        supabase.from('user_badges').select('badge_id').eq('user_id', uid),
      ])
      if (badgesRes.error) throw badgesRes.error
      if (earnedRes.error) throw earnedRes.error
      const earned = new Set((earnedRes.data ?? []).map((r) => r.badge_id))
      return (badgesRes.data ?? [])
        .map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          iconUrl: b.icon_url,
          earned: earned.has(b.id),
        }))
        .sort((a, b) => Number(b.earned) - Number(a.earned) || a.name.localeCompare(b.name))
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

/** DEFAULT_AVATAR re-exported here so a page that only imports this module doesn't need a second import for it. */
export { DEFAULT_AVATAR }

/**
 * Which of the last `days` calendar days (UTC, matching `current_date` on the
 * server, which runs UTC) had at least one XP award — the same signal
 * `fn_process_xp_transaction` uses to advance `current_streak` and
 * `last_activity_date`, so this calendar can never disagree with the number
 * next to it. Chose this over a new log table: `xp_transactions.created_at`
 * is already exactly that history, self-readable under the existing RLS
 * policy, so a query is the smaller, cleaner change — no migration, and the
 * two views of "was I active" stay provably the same thing. The one gap this
 * inherits from the counter itself: a lesson completed in a course with
 * gamification off awards no XP and so does not light up a day here either,
 * same as it does not advance the streak.
 */
export const deletionRequestKey = ['kid', 'deletionRequest'] as const

/**
 * The signed-in student's own most recent account-deletion request, if any
 * (`deletion_requests_select_self`, migration 027). `null` means none exists
 * yet. This only reads the request — nothing here processes it; an admin
 * acting on `deletion_requests` is a separate, later task.
 */
export function useDeletionRequest() {
  return useQuery<string | null, Error>({
    queryKey: deletionRequestKey,
    queryFn: async () => {
      const session = await currentSession()
      const { data, error } = await supabase
        .from('deletion_requests')
        .select('requested_at')
        .eq('user_id', session.user.id)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data?.requested_at ?? null
    },
    staleTime: 0,
  })
}

/**
 * Records a self-service deletion request — an insert, nothing else. Consistent
 * with the app's trash-first philosophy (`schema.md` section 7): this never
 * deletes anything itself, it only asks for it, the same way a course is
 * archived rather than removed on the spot.
 */
export function useRequestDeletion() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const session = await currentSession()
      const { error } = await supabase.from('deletion_requests').insert({ user_id: session.user.id })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deletionRequestKey })
    },
  })
}

export function useActivityDays(days = 35) {
  return useQuery<Set<string>, Error>({
    queryKey: ['kid', 'activityDays', days],
    queryFn: async () => {
      const session = await currentSession()
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - (days - 1))
      since.setUTCHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('xp_transactions')
        .select('created_at')
        .eq('user_id', session.user.id)
        .gte('created_at', since.toISOString())
      if (error) throw error
      return new Set((data ?? []).map((r) => r.created_at.slice(0, 10)))
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
