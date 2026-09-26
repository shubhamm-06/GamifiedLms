import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

async function currentUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('signed_out')
  return session.user.id
}

export interface KidProfile {
  displayName: string
  avatarUrl: string | null
  totalXp: number
  level: number
  currentStreak: number
}

/** The signed-in student's name, avatar and stats. No XP yet means no `user_stats` row: zeros, level 1. */
export function useKidProfile() {
  return useQuery<KidProfile, Error>({
    queryKey: ['kid', 'profile'],
    queryFn: async () => {
      const uid = await currentUserId()
      const [profileRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url').eq('id', uid).maybeSingle(),
        supabase.from('user_stats').select('total_xp, level, current_streak').eq('user_id', uid).maybeSingle(),
      ])
      if (profileRes.error) throw profileRes.error
      if (statsRes.error) throw statsRes.error
      return {
        displayName: profileRes.data?.display_name ?? '',
        avatarUrl: profileRes.data?.avatar_url ?? null,
        totalXp: statsRes.data?.total_xp ?? 0,
        level: statsRes.data?.level ?? 1,
        currentStreak: statsRes.data?.current_streak ?? 0,
      }
    },
    staleTime: 0,
    refetchOnMount: 'always',
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
      const uid = await currentUserId()
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
