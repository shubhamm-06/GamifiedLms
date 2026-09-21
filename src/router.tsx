import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AdminGuard, AdminPageSkeleton } from '@/components/admin/AdminGuard'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { KidLayout } from '@/components/kid/KidLayout'
import { redirectIfAdminAlreadySignedIn, requireAdmin } from '@/lib/adminSession'
import { queryClient } from '@/lib/queryClient'
import { requireStudentSession } from '@/lib/studentSession'
import { CoursePage } from '@/pages/CoursePage'
import { LessonStubPage } from '@/pages/LessonStubPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import type { CourseTab } from '@/components/admin/courses/CourseBuilder'
import { CourseCreatePage } from '@/pages/admin/CourseCreatePage'
import { CourseEditPage } from '@/pages/admin/CourseEditPage'
import { CoursesPage } from '@/pages/admin/CoursesPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { GamesPage } from '@/pages/admin/GamesPage'
import { GamificationPage } from '@/pages/admin/GamificationPage'
import { OrdersPage } from '@/pages/admin/OrdersPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { TrashPage } from '@/pages/admin/TrashPage'
import { UserDetailPage } from '@/pages/admin/UserDetailPage'
import { UsersPage } from '@/pages/admin/UsersPage'

interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  // The admin guard bounces unauthenticated visitors here with the page
  // they were after, so login can send them back to it.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  // Handled at the route rather than in the submit handler, so an admin with
  // a restored session who opens /login directly is sent on rather than
  // being shown a form they don't need.
  beforeLoad: ({ context, search }) =>
    redirectIfAdminAlreadySignedIn(context.queryClient, search.redirect),
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupPage,
})

/**
 * Kid-facing (student) routes. A pathless layout route: it adds the session
 * check and the KidLayout shell to everything under it without adding a URL
 * segment. No role check on purpose — RLS and the lesson-engine functions decide
 * what a signed-in user may see. New student screens hang off this route.
 */
const studentRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'student',
  beforeLoad: ({ location }) => requireStudentSession(location.href),
  component: KidLayout,
})

const courseRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'courses/$courseId',
  component: CoursePage,
})

// TEMPORARY: a placeholder so the roadmap's buttons have somewhere to land.
// The lesson player replaces LessonStubPage; the route stays.
const lessonStubRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'courses/$courseId/lessons/$lessonId',
  component: LessonStubPage,
})

/**
 * Everything under /admin is gated here rather than per-child, so a new
 * admin page can't be added without inheriting the check. beforeLoad
 * runs before any component mounts, so protected content never paints.
 */
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  beforeLoad: ({ context, location }) => requireAdmin(context.queryClient, location.href),
  pendingComponent: AdminPageSkeleton,
  pendingMs: 0,
  component: () => (
    <AdminGuard>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </AdminGuard>
  ),
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  component: DashboardPage,
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'users',
  component: UsersPage,
})

// Stands alone the same way `courses/$courseId/edit` does — there is
// deliberately no separate students list; /admin/users (with its role
// filter) already is that list, and this is the detail view it was missing.
const adminUserDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'users/$userId',
  component: UserDetailPage,
})

const adminCoursesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'courses',
  component: CoursesPage,
})

const adminGamesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'games',
  component: GamesPage,
})

/**
 * Same `?tab=`-as-real-search-param convention as the Course Builder below
 * (`validateCourseTab`) — lives in the URL so the Active/Trash toggle
 * survives a refresh and is linkable, not component state.
 */
function validateOrdersView(search: Record<string, unknown>): { view: 'active' | 'trash' } {
  return { view: search.view === 'trash' ? 'trash' : 'active' }
}

const adminOrdersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'orders',
  component: OrdersPage,
  validateSearch: validateOrdersView,
})

/**
 * Same `?tab=`-as-real-search-param convention as Course Builder, Orders and
 * Settings. Defaults to `courses`, the first tab.
 */
const TRASH_TABS = ['courses', 'modules', 'lessons', 'games', 'badges', 'users'] as const
type TrashTab = (typeof TRASH_TABS)[number]

function validateTrashTab(search: Record<string, unknown>): { tab: TrashTab } {
  const tab = TRASH_TABS.find((t) => t === search.tab)
  return { tab: tab ?? 'courses' }
}

// Admin-only like everything else here: it hangs off adminRoute, so the same
// requireAdmin beforeLoad guard covers it.
const adminTrashRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'trash',
  component: TrashPage,
  validateSearch: validateTrashTab,
})

const adminGamificationRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'gamification',
  component: GamificationPage,
})

/**
 * Same `?tab=`-as-real-search-param convention as Course Builder and
 * `/admin/orders`'s `?view=` — survives a refresh, is linkable. Defaults to
 * `commerce`, matching this tab's position as the first/leftmost one.
 */
function validateSettingsTab(
  search: Record<string, unknown>,
): { tab: 'commerce' | 'gamification' | 'identity' } {
  const tab = search.tab === 'gamification' || search.tab === 'identity' ? search.tab : 'commerce'
  return { tab }
}

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'settings',
  component: SettingsPage,
  validateSearch: validateSettingsTab,
})

/**
 * Builder tab lives in the URL so it survives a refresh and is linkable.
 * Create mode has no course row yet, so it can only ever be on Basics.
 */
function validateCourseTab(search: Record<string, unknown>): { tab: CourseTab } {
  return { tab: search.tab === 'curriculum' ? 'curriculum' : 'basics' }
}

const adminCourseCreateRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'courses/new',
  component: CourseCreatePage,
})

// `$courseId/edit` stands on its own — there is deliberately no
// `courses/$courseId` index route yet; module/lesson/quiz management is a
// separate future task.
const adminCourseEditRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'courses/$courseId/edit',
  component: CourseEditPage,
  validateSearch: validateCourseTab,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  studentRoute.addChildren([courseRoute, lessonStubRoute]),
  adminRoute.addChildren([
    adminIndexRoute,
    adminUsersRoute,
    adminUserDetailRoute,
    adminCoursesRoute,
    adminGamesRoute,
    adminGamificationRoute,
    adminOrdersRoute,
    adminSettingsRoute,
    adminTrashRoute,
    adminCourseCreateRoute,
    adminCourseEditRoute,
  ]),
])

export const router = createRouter({ routeTree, context: { queryClient } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
