import { useEffect, useRef } from 'react'
import { Flame, LogOut, Sparkles, Trophy } from 'lucide-react'
import { AvatarBuilder } from '@/components/kid/AvatarBuilder'
import { DesktopPageHeader } from '@/components/kid/DesktopPageHeader'
import { StreakCalendar } from '@/components/kid/StreakCalendar'
import { RetryScreen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeature, useTerms } from '@/hooks/useSettings'
import { useProfileData } from '@/hooks/useKidProfile'
import { ProfileIdentityCard } from './ProfileIdentityCard'
import { ProfileStatCard } from './ProfileStatCard'
import { AccountSection, PreferencesSection } from './ProfileSections'

/**
 * The Profile page at >= 1024px (KidProfilePage mounts this OR the mobile page,
 * never both). The same data and components as mobile, laid out for width: a page
 * header, a sticky identity card on the left, and the stats, streak calendar,
 * preferences, account and Log out on the right. No new query: `useKidProfile`,
 * `useActivityDays` and `useUpdateAvatar` are the mobile page's own.
 *
 * Edit mode shows the avatar builder in place of the identity card and right
 * column, under the same page header (whose title becomes "Edit your avatar"), so
 * nothing around it moves. Focus goes to the builder's Shuffle button on entering
 * and back to "Edit your avatar" on leaving. `building` lives in the parent so a
 * resize across 1024px keeps the page in edit mode (the builder's unsaved picks
 * are local to it and start over, as they do on any remount).
 */
export function DesktopProfile({ building, setBuilding }: { building: boolean; setBuilding: (building: boolean) => void }) {
  const { profile, activity, updateAvatar, leaving, logOut } = useProfileData()
  const avatars = useFeature('avatars')
  const showLevel = useFeature('levels')
  const showXp = useFeature('xp')
  const showStreak = useFeature('streaks')
  const { term, lower } = useTerms()

  const editRef = useRef<HTMLButtonElement>(null)
  const builderRef = useRef<HTMLDivElement>(null)
  const wasBuilding = useRef(building)
  useEffect(() => {
    if (wasBuilding.current === building) return
    wasBuilding.current = building
    if (building) builderRef.current?.querySelector<HTMLElement>('[data-testid="av-shuffle"]')?.focus()
    else editRef.current?.focus()
  }, [building])

  if (profile.isPending) {
    return (
      <div className="kpd" data-testid="profile-desktop" aria-busy="true" aria-label="Loading your profile">
        <DesktopPageHeader title="Profile" />
        <div className="kpd-body">
          <div className="kpd-identity">
            <Skeleton className="size-40 rounded-full bg-ink/10" />
            <Skeleton className="h-9 w-44 rounded-xl bg-ink/10" />
            <Skeleton className="h-11 w-48 rounded-full bg-ink/10" />
          </div>
          <div className="kpd-main">
            <div className="kpd-stats">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[4.5rem] rounded-[22px] bg-ink/10" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-[22px] bg-ink/10" />
          </div>
        </div>
      </div>
    )
  }
  if (profile.isError) {
    // The retry screen brings its own h1, so no page header here (one h1 per page).
    return <RetryScreen title="Oops! We couldn't load your profile" onRetry={() => void profile.refetch()} />
  }
  const p = profile.data

  return (
    <div className="kpd" data-testid="profile-desktop">
      <DesktopPageHeader title={building && avatars ? 'Edit your avatar' : 'Profile'} />
      {building && avatars ? (
        <div ref={builderRef}>
          <AvatarBuilder
            initial={p.avatarConfig}
            saving={updateAvatar.isPending}
            onCancel={() => setBuilding(false)}
            onSave={(config) => updateAvatar.mutate(config, { onSuccess: () => setBuilding(false) })}
          />
        </div>
      ) : (
        <div className="kpd-body" data-testid="profile">
          <ProfileIdentityCard config={p.avatarConfig} name={p.displayName} onEdit={avatars ? () => setBuilding(true) : undefined} editRef={editRef} />
          <div className="kpd-main">
            {showLevel || showXp || showStreak ? (
              <ul className="kpd-stats">
                {showLevel ? <ProfileStatCard kind="level" icon={<Trophy className="size-5" />} value={p.level} label={term('level')} testId="stat-level" /> : null}
                {showXp ? <ProfileStatCard kind="xp" icon={<Sparkles className="size-5" />} value={p.totalXp} label={term('xp')} testId="stat-xp" /> : null}
                {showStreak ? (
                  <ProfileStatCard kind="streak" icon={<Flame className="size-5" />} value={p.currentStreak} label={`Day ${lower('streak')}`} testId="stat-streak" />
                ) : null}
              </ul>
            ) : null}

            {showStreak ? (
            <section className="kid-card kp-card" aria-label={`Your ${lower('streak')}`}>
              <h2 className="kp-card-title">Your last 5 weeks</h2>
              {activity.isPending ? (
                <Skeleton className="h-32 w-full rounded-xl bg-ink/10" />
              ) : activity.isError ? (
                <p className="kp-card-note">Couldn't load your calendar right now.</p>
              ) : (
                <StreakCalendar activeDays={activity.data} />
              )}
            </section>
            ) : null}

            <PreferencesSection />
            <AccountSection profile={p} />

            <button type="button" className="candy-btn-quiet kid-tap kpd-logout" onClick={() => void logOut()} disabled={leaving} data-testid="logout">
              <LogOut className="size-5" aria-hidden />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
