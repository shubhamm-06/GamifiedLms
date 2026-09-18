import type { ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  BookOpen,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShieldUser,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminSessionQueryOptions, clearAdminSession } from '@/lib/adminSession'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAppSettings } from '@/hooks/useAppSettings'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
}

interface NavGroup {
  heading: string | null
  items: NavItem[]
}

/**
 * Modules, lessons and quiz questions are deliberately absent: they only
 * exist inside a specific course, so they belong to the course detail route
 * rather than global navigation.
 *
 * There is no "Students" entry: a separate students list would just
 * duplicate /admin/users, which already lists everyone with a role filter
 * (see `routes-permissions.md`) and now also has a detail route
 * (`/admin/users/$userId`) for enrollments/progress/badges/XP. Dropped the
 * nav slot rather than repointing it at /admin/users — a second link to the
 * same destination as "Admin Users" would just be visual clutter.
 *
 * Every entry below resolves to a real route now (`/admin/gamification` was
 * the last one that 404'd by design).
 */
const NAV_GROUPS: NavGroup[] = [
  {
    heading: null,
    items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard }],
  },
  {
    heading: 'Content',
    items: [
      { label: 'Courses', to: '/admin/courses', icon: BookOpen },
      { label: 'Games', to: '/admin/games', icon: Gamepad2 },
    ],
  },
  {
    heading: 'Engagement',
    items: [{ label: 'Badges & XP', to: '/admin/gamification', icon: BadgeCheck }],
  },
  {
    heading: 'Commerce',
    items: [{ label: 'Orders & Payments', to: '/admin/orders', icon: Receipt }],
  },
  {
    heading: 'Administration',
    items: [
      { label: 'Admin Users', to: '/admin/users', icon: ShieldUser },
      { label: 'Settings', to: '/admin/settings', icon: Settings },
    ],
  },
]

const PAGE_TITLES = new Map(
  NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.to, item.label]),
)

/**
 * `Link`'s `to` is typed against the registered route tree, and nav targets
 * are plain strings here. Every target is a real route now, but the cast
 * still earns its keep: `/admin/orders` and `/admin/settings` declare a
 * required search param (`?view=`/`?tab=`, validated with a default), which a
 * typed `Link` would otherwise force every nav entry to pass explicitly.
 * One contained cast here beats scattering `search` props across the nav.
 */
function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to as never}
      activeOptions={{ exact: to === '/admin' }}
      className="text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:text-foreground flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors data-[status=active]:font-medium"
    >
      {children}
    </Link>
  )
}

function useCurrentPageTitle(): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const exact = PAGE_TITLES.get(pathname)
  if (exact) return exact

  // Deep routes (e.g. /admin/courses/:id) fall back to their section.
  const section = [...PAGE_TITLES.entries()]
    .filter(([to]) => to !== '/admin' && pathname.startsWith(to))
    .sort((a, b) => b[0].length - a[0].length)[0]

  return section?.[1] ?? 'Admin'
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const title = useCurrentPageTitle()
  const { data: session } = useQuery(adminSessionQueryOptions)
  const { data: appSettings } = useAppSettings()

  async function handleSignOut() {
    await supabase.auth.signOut()
    // Drop the cached session first — otherwise /login's own guard could
    // still read a stale admin session and bounce straight back to /admin.
    clearAdminSession(queryClient)
    navigate({ to: '/login' })
  }

  return (
    // font-sans is explicit: Baloo 2 is scoped to .auth-page and must not
    // reach the admin panel, which uses the global Geist sans.
    <div className="bg-background text-foreground flex min-h-screen font-sans">
      <aside className="flex w-60 shrink-0 flex-col border-r">
        <div className="flex h-14 items-center border-b px-5">
          {/* Read from app_settings.site_name (migration 010), not
              hardcoded — falls back to the column's own DB default only
              for the instant before the first fetch resolves. */}
          <span className="text-sm font-semibold tracking-tight">
            {appSettings?.site_name ?? 'Wisdom Hatch Kids'}
          </span>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.heading ?? `group-${index}`} className="space-y-1">
              {group.heading ? (
                <p className="text-muted-foreground px-2.5 pb-1 text-[11px] font-medium tracking-wider uppercase">
                  {group.heading}
                </p>
              ) : null}
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to}>
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              {session?.displayName ?? ''}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </header>
        <main className={cn('min-w-0 flex-1 p-6')}>{children}</main>
      </div>
    </div>
  )
}
