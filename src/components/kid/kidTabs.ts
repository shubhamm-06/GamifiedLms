import { Award, BookOpen, House, User, type LucideIcon } from 'lucide-react'

interface KidTab {
  to: '/' | '/badges' | '/courses' | '/profile'
  label: string
  Icon: LucideIcon
  /** True once this screen has its own >= 1024px view with its own `DesktopPageHeader`
   * (`ui.md` "Desktop Profile"), so `KidLayout` hides the old top-bar title row for it
   * at that width — the same way `data-home` is derived straight from the route below,
   * not from a context flag the page sets after mounting. */
  ownsDesktopHeader?: boolean
}

/** The kid app's four destinations, in bar order. Their routes are the only ones that show the bottom nav. */
export const KID_TABS: KidTab[] = [
  { to: '/', label: 'Home', Icon: House },
  { to: '/badges', label: 'Badges', Icon: Award, ownsDesktopHeader: true },
  { to: '/courses', label: 'Courses', Icon: BookOpen, ownsDesktopHeader: true },
  { to: '/profile', label: 'Profile', Icon: User, ownsDesktopHeader: true },
]

/** The tab a pathname belongs to (trailing slash ignored), or undefined off the four screens. */
export function tabForPath(pathname: string): KidTab | undefined {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return KID_TABS.find((t) => t.to === p)
}
