import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Flame, LogOut, Sparkles, Trophy } from 'lucide-react'
import { useKidHeader } from '@/components/kid/kidHeader'
import { RetryScreen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { useKidProfile } from '@/hooks/useKidProfile'
import { supabase } from '@/lib/supabase'

/**
 * `/profile`: the student's name, avatar, level, XP and streak, and a log out
 * button. Deliberately minimal: a real design pass is a follow-up.
 */
export function KidProfilePage() {
  useKidHeader('Profile')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profile = useKidProfile()
  const [leaving, setLeaving] = useState(false)

  async function logOut() {
    setLeaving(true)
    await supabase.auth.signOut()
    // Every kid query is keyed without the user, so drop them all before the next sign-in.
    queryClient.clear()
    void navigate({ to: '/login' })
  }

  if (profile.isPending) {
    return (
      <div className="kp" aria-busy="true" aria-label="Loading your profile">
        <Skeleton className="mx-auto size-24 rounded-full bg-ink/10" />
        <Skeleton className="mx-auto mt-4 h-8 w-48 rounded-xl bg-ink/10" />
      </div>
    )
  }
  if (profile.isError) {
    return <RetryScreen title="Oops! We couldn't load your profile" onRetry={() => void profile.refetch()} />
  }
  const p = profile.data
  const initial = (p.displayName.trim()[0] ?? '?').toUpperCase()
  return (
    <div className="kp" data-testid="profile">
      <span className="kp-avatar" aria-hidden>
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : initial}
      </span>
      <h1 className="kp-name" data-testid="profile-name">
        {p.displayName}
      </h1>
      <ul className="kp-stats">
        <li className="kid-card kp-stat" data-testid="stat-level">
          <Trophy className="size-6" aria-hidden />
          <span className="kp-stat-num kid-num">{p.level}</span>
          <span className="kp-stat-label">Level</span>
        </li>
        <li className="kid-card kp-stat" data-testid="stat-xp">
          <Sparkles className="size-6" aria-hidden />
          <span className="kp-stat-num kid-num">{p.totalXp}</span>
          <span className="kp-stat-label">XP</span>
        </li>
        <li className="kid-card kp-stat" data-testid="stat-streak">
          <Flame className="size-6" aria-hidden />
          <span className="kp-stat-num kid-num">{p.currentStreak}</span>
          <span className="kp-stat-label">Day streak</span>
        </li>
      </ul>
      <button
        type="button"
        className="candy-btn-quiet kid-tap kp-logout"
        onClick={() => void logOut()}
        disabled={leaving}
        data-testid="logout"
      >
        <LogOut className="size-5" aria-hidden />
        Log out
      </button>
    </div>
  )
}
