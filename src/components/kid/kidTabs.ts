import { Award, BookOpen, House, User, type LucideIcon } from 'lucide-react'

export interface KidTab {
  to: '/' | '/badges' | '/courses' | '/profile'
  label: string
  Icon: LucideIcon
}

/** The kid app's four destinations, in bar order. Their routes are the only ones that show the bottom nav. */
export const KID_TABS: KidTab[] = [
  { to: '/', label: 'Home', Icon: House },
  { to: '/badges', label: 'Badges', Icon: Award },
  { to: '/courses', label: 'Courses', Icon: BookOpen },
  { to: '/profile', label: 'Profile', Icon: User },
]

/** The tab a pathname belongs to (trailing slash ignored), or undefined off the four screens. */
export function tabForPath(pathname: string): KidTab | undefined {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return KID_TABS.find((t) => t.to === p)
}
