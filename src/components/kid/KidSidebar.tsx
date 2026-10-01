import { Link } from '@tanstack/react-router'
import { OwlMark } from '@/components/AppEntranceSplash'
import { DEFAULT_AVATAR, useKidProfile } from '@/hooks/useKidProfile'
import * as haptics from '@/lib/haptics'
import { Avatar } from './Avatar'
import { KID_TABS } from './kidTabs'

/**
 * The desktop navigation (>= 1024px, `LG_UP`): a fixed left sidebar that takes
 * the bottom nav's place on the four top-level screens. Same four destinations,
 * same icons (the Profile item shows the student's own avatar, from the shared
 * `useKidProfile` cache), same behaviour: tapping the active item does nothing.
 * The active item gets the bottom nav's soft teal pill plus a bold label; gold
 * stays with "the next action". `KidLayout` mounts exactly one of this and
 * `KidNav`, so the bottom nav does not exist in the DOM at this width.
 */
export function KidSidebar({ activeTo }: { activeTo: string }) {
  const profile = useKidProfile()
  const avatarConfig = profile.data?.avatarConfig ?? DEFAULT_AVATAR
  return (
    <div className="kid-side" data-testid="kid-sidebar">
      <Link
        to="/"
        className="kid-side-brand kid-tap"
        aria-label="Wisdom Hatch Kids, home"
        onClick={(e) => {
          if (activeTo === '/') e.preventDefault()
        }}
      >
        <OwlMark size={40} decorative />
        <span className="kid-side-wordmark">Wisdom Hatch Kids</span>
      </Link>
      <nav aria-label="Main" data-testid="kid-nav">
        <ul className="kid-side-list">
          {KID_TABS.map(({ to, label, Icon }) => {
            const active = to === activeTo
            const isProfile = to === '/profile'
            return (
              <li key={to}>
                <Link
                  to={to}
                  className="kid-side-item kid-tap"
                  aria-current={active ? 'page' : undefined}
                  data-testid={`nav-${label.toLowerCase()}`}
                  onClick={(e) => {
                    if (active) e.preventDefault()
                    else haptics.tap()
                  }}
                >
                  <span className="kid-side-icon">
                    {isProfile ? (
                      <Avatar config={avatarConfig} size={28} data-testid="nav-avatar" />
                    ) : (
                      <Icon className="size-6" strokeWidth={active ? 2.75 : 2.25} aria-hidden />
                    )}
                  </span>
                  <span className="kid-side-label">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
