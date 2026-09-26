import { Link } from '@tanstack/react-router'
import { KID_TABS } from './kidTabs'

/**
 * The bottom navigation: Home, Badges, Courses, Profile. Fixed to the bottom of
 * the viewport with the safe-area inset in its own padding (the iOS home
 * indicator never covers a tab). The active tab is ink with a soft teal pill
 * behind its icon; gold stays with "the next action" and is not used here.
 * Tapping the active tab does nothing (no navigation, no remount).
 */
export function KidNav({ activeTo }: { activeTo: string }) {
  return (
    <nav className="kid-nav" aria-label="Main" data-testid="kid-nav">
      <ul className="kid-nav-list">
        {KID_TABS.map(({ to, label, Icon }) => {
          const active = to === activeTo
          return (
            <li key={to}>
              <Link
                to={to}
                className="kid-nav-tab kid-tap"
                aria-current={active ? 'page' : undefined}
                data-testid={`nav-${label.toLowerCase()}`}
                onClick={(e) => {
                  if (active) e.preventDefault()
                }}
              >
                <span className="kid-nav-icon">
                  <Icon className="size-6" strokeWidth={active ? 2.75 : 2.25} aria-hidden />
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
