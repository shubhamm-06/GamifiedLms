import { Link } from '@tanstack/react-router'
import { ProfileAvatar } from './ProfileAvatar'
import { useKidTabs } from './useKidTabs'
import { DEFAULT_AVATAR, useKidProfile } from '@/hooks/useKidProfile'
import * as haptics from '@/lib/haptics'

/**
 * The bottom navigation: Home, Badges, Courses, Profile. Fixed to the bottom of
 * the viewport with the safe-area inset in its own padding (the iOS home
 * indicator never covers a tab). The active tab is ink with a soft teal pill
 * behind its icon; gold stays with "the next action" and is not used here.
 * Tapping the active tab does nothing (no navigation, no remount). The Profile
 * tab renders the student's own avatar (shared `useKidProfile` cache, so a save
 * in the builder updates it here immediately) in place of the generic icon,
 * behind the same active-state pill; `DEFAULT_AVATAR` covers the gap before it
 * loads and a student who has never customized one, so this tab is never blank.
 */
export function KidNav({ activeTo }: { activeTo: string }) {
  const profile = useKidProfile()
  const avatarConfig = profile.data?.avatarConfig ?? DEFAULT_AVATAR
  const tabs = useKidTabs()
  return (
    <nav className="kid-nav" aria-label="Main" data-testid="kid-nav">
      <ul className="kid-nav-list">
        {tabs.map(({ to, id, label, Icon }) => {
          const active = to === activeTo
          const isProfile = to === '/profile'
          return (
            <li key={to}>
              <Link
                to={to}
                className="kid-nav-tab kid-tap"
                aria-current={active ? 'page' : undefined}
                data-testid={`nav-${id}`}
                onClick={(e) => {
                  if (active) e.preventDefault()
                  else haptics.tap()
                }}
              >
                <span className="kid-nav-icon">
                  {isProfile ? (
                    <ProfileAvatar config={avatarConfig} name={profile.data?.displayName ?? ''} size={28} data-testid="nav-avatar" />
                  ) : (
                    <Icon className="size-6" strokeWidth={active ? 2.75 : 2.25} aria-hidden />
                  )}
                </span>
                <span className="kid-nav-label">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
