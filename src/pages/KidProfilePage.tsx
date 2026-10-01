import { useState } from 'react'
import { Flame, LogOut, Pencil, Sparkles, Trophy } from 'lucide-react'
import { Avatar } from '@/components/kid/Avatar'
import { AvatarBuilder } from '@/components/kid/AvatarBuilder'
import { StreakCalendar } from '@/components/kid/StreakCalendar'
import { useKidHeader } from '@/components/kid/kidHeader'
import { DesktopProfile } from '@/components/kid/profile/DesktopProfile'
import { AccountSection, PreferencesSection } from '@/components/kid/profile/ProfileSections'
import { RetryScreen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfileData } from '@/hooks/useKidProfile'
import { useBackClosable } from '@/hooks/useBackClosable'
import { LG_UP, useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * `/profile`: avatar (tap to open the builder), account info a student can
 * edit directly (name, email, password), level/XP/streak, a streak calendar
 * and Log out. From 1024px the same content is laid out by `DesktopProfile`
 * (mounted instead of this page's own view, through the same `LG_UP` query the
 * shell uses, so only one of them ever runs). Whether the avatar builder is
 * open lives here, so it survives a resize across 1024px.
 */
export function KidProfilePage() {
  useKidHeader('Profile')
  const desktop = useMediaQuery(LG_UP)
  const [building, setBuilding] = useState(false)
  // The avatar builder replaces the page like a full-screen sheet: Back cancels it.
  useBackClosable(building, () => setBuilding(false))

  return desktop ? <DesktopProfile building={building} setBuilding={setBuilding} /> : <MobileProfile building={building} setBuilding={setBuilding} />
}

function MobileProfile({ building, setBuilding }: { building: boolean; setBuilding: (building: boolean) => void }) {
  const { profile, activity, updateAvatar, leaving, logOut } = useProfileData()

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

  if (building) {
    return (
      <AvatarBuilder
        initial={p.avatarConfig}
        saving={updateAvatar.isPending}
        onCancel={() => setBuilding(false)}
        onSave={(config) => updateAvatar.mutate(config, { onSuccess: () => setBuilding(false) })}
      />
    )
  }

  return (
    <div className="kp" data-testid="profile">
      <button type="button" className="kp-avatar-btn kid-tap" onClick={() => setBuilding(true)} data-testid="edit-avatar">
        <Avatar config={p.avatarConfig} size={96} />
        <span className="kp-avatar-edit" aria-hidden>
          <Pencil className="size-4" strokeWidth={2.75} />
        </span>
        <span className="sr-only">Edit your avatar</span>
      </button>

      <h1 className="kp-name" data-testid="profile-name">
        {p.displayName}
      </h1>

      <ul className="kp-stats">
        <li className="kid-card kp-stat" data-testid="stat-level">
          <span className="kp-stat-icon" data-color="teal">
            <Trophy className="size-5" aria-hidden />
          </span>
          <span className="kp-stat-num kid-num">{p.level}</span>
          <span className="kp-stat-label">Level</span>
        </li>
        <li className="kid-card kp-stat" data-testid="stat-xp">
          <span className="kp-stat-icon" data-color="plum">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="kp-stat-num kid-num">{p.totalXp}</span>
          <span className="kp-stat-label">XP</span>
        </li>
        <li className="kid-card kp-stat" data-testid="stat-streak">
          <span className="kp-stat-icon" data-color="coral">
            <Flame className="size-5" aria-hidden />
          </span>
          <span className="kp-stat-num kid-num">{p.currentStreak}</span>
          <span className="kp-stat-label">Day streak</span>
        </li>
      </ul>

      <section className="kid-card kp-card" aria-label="Your streak">
        <h2 className="kp-card-title">Your last 5 weeks</h2>
        {activity.isPending ? (
          <Skeleton className="h-32 w-full rounded-xl bg-ink/10" />
        ) : activity.isError ? (
          <p className="kp-card-note">Couldn't load your calendar right now.</p>
        ) : (
          <StreakCalendar activeDays={activity.data} />
        )}
      </section>

      <PreferencesSection />

      <AccountSection profile={p} />

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
