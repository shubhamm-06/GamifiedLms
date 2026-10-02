import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AdminPageSkeleton } from '@/components/admin/AdminGuard'
import { KidLayout } from '@/components/kid/KidLayout'
import { CoursePage } from '@/pages/CoursePage'
import { LessonPlayerPage } from '@/pages/LessonPlayerPage'
import { KidBadgesPage } from '@/pages/KidBadgesPage'
import { KidCoursesPage } from '@/pages/KidCoursesPage'
import { KidHomePage } from '@/pages/KidHomePage'
import { KidProfilePage } from '@/pages/KidProfilePage'
import { LoginPage } from '@/pages/LoginPage'
import { PublicCoursePage } from '@/pages/PublicCoursePage'
import { SignupPage } from '@/pages/SignupPage'
import { redirectIfAdminAlreadySignedIn, requireAdmin } from '@/lib/adminSession'
import { queryClient } from '@/lib/queryClient'
import { hasSession, requireStudentSession } from '@/lib/studentSession'
import { LessonPlayerGallery } from '@/pages/dev/LessonPlayerGallery'
import type { CourseTab } from '@/components/admin/courses/CourseBuilder'

interface RouterContext {
  queryClient: QueryClient
}

/**
 * Admin pages load lazily (their own chunks, see `adminRoute`); student and auth pages stay in
 * the main bundle ON PURPOSE: lazy-loading them was measured (2026-10-02, Slow 4G, 4x CPU) to make
 * the course page SLOWER (FCP 5.6 s -> 8.8 s), because the extra round trip for the route chunk
 * costs more than the bytes it saves on a high-latency link (ui.md "Mobile performance").
 */
const rootRoute = createRootRouteWithContext<RouterContext>()()

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
  // Where to go after signing up (e.g. back to the free course page the visitor came from). Validated
  // where it is used (`resolvePostLoginPath` -> `safeInternalPath`), like /login's.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
})

/**
 * The parent-facing course page for someone who is NOT signed in (a shared link): no login,
 * no app shell. Deliberately outside `studentRoute`. A signed-in visitor is sent on to
 * `/courses/$courseId`, where the app decides (enrolled: roadmap; otherwise this same page
 * inside the shell), so there is one behaviour per person, not two pages to keep in step.
 */
const publicCourseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/course/$courseRef',
  beforeLoad: async ({ params }) => {
    if (await hasSession()) throw redirect({ to: '/courses/$courseId', params: { courseId: params.courseRef } })
  },
  component: PublicCoursePage,
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

/**
 * `/` is the kid Home: the roadmap of the most recently used course. It lives
 * under the student layout, so a signed-out visitor is sent to /login and
 * brought back here (the old scaffold page that used to sit here is gone).
 */
const indexRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: '/',
  component: KidHomePage,
})

/** The other three bottom-nav destinations (KidNav): badges, the course switcher, the profile. */
const badgesRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'badges',
  component: KidBadgesPage,
})

const coursesRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'courses',
  component: KidCoursesPage,
})

const profileRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'profile',
  component: KidProfilePage,
})

const courseRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'courses/$courseId',
  // ?open=<lessonId> opens that lesson's sheet (the player sends a locked lesson here).
  validateSearch: (search: Record<string, unknown>): { open?: string } => ({
    open: typeof search.open === 'string' && search.open ? search.open : undefined,
  }),
  component: CoursePage,
})

const lessonRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'courses/$courseId/lessons/$lessonId',
  component: LessonPlayerPage,
})

/**
 * DEV ONLY: every lesson-player state with fixture data, for screenshotting
 * (UI/UX spec Part C1). `import.meta.env.DEV` is replaced with `false` in a
 * production build, so Rollup drops both this route and its dynamic import
 * entirely — verified against `dist/` after a real build (`state.md`).
 */
const devRoutes = import.meta.env.DEV
  ? [
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/dev/lesson-player-gallery',
        component: LessonPlayerGallery,
      }),
    ]
  : []

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
  // Lazy (its own chunk, like every admin page below): students never download admin code.
  component: lazyRouteComponent(() => import('@/components/admin/AdminShell'), 'AdminShell'),
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/pages/admin/DashboardPage'), 'DashboardPage'),
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'users',
  component: lazyRouteComponent(() => import('@/pages/admin/UsersPage'), 'UsersPage'),
})

// Stands alone the same way `courses/$courseId/edit` does — there is
// deliberately no separate students list; /admin/users (with its role
// filter) already is that list, and this is the detail view it was missing.
const adminUserDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'users/$userId',
  component: lazyRouteComponent(() => import('@/pages/admin/UserDetailPage'), 'UserDetailPage'),
})

const adminCoursesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'courses',
  component: lazyRouteComponent(() => import('@/pages/admin/CoursesPage'), 'CoursesPage'),
})

const adminGamesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'games',
  component: lazyRouteComponent(() => import('@/pages/admin/GamesPage'), 'GamesPage'),
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
  component: lazyRouteComponent(() => import('@/pages/admin/OrdersPage'), 'OrdersPage'),
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
  component: lazyRouteComponent(() => import('@/pages/admin/TrashPage'), 'TrashPage'),
  validateSearch: validateTrashTab,
})

const adminGamificationRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'gamification',
  component: lazyRouteComponent(() => import('@/pages/admin/GamificationPage'), 'GamificationPage'),
})

const adminNotificationsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'notifications',
  component: lazyRouteComponent(() => import('@/pages/admin/NotificationsPage'), 'NotificationsPage'),
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
  component: lazyRouteComponent(() => import('@/pages/admin/SettingsPage'), 'SettingsPage'),
  validateSearch: validateSettingsTab,
})

/**
 * Builder tab lives in the URL so it survives a refresh and is linkable.
 * Create mode has no course row yet, so it can only ever be on Basics.
 */
function validateCourseTab(search: Record<string, unknown>): { tab: CourseTab } {
  return { tab: search.tab === 'curriculum' || search.tab === 'page' ? search.tab : 'basics' }
}

const adminCourseCreateRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'courses/new',
  component: lazyRouteComponent(() => import('@/pages/admin/CourseCreatePage'), 'CourseCreatePage'),
})

// `$courseId/edit` stands on its own — there is deliberately no
// `courses/$courseId` index route yet; module/lesson/quiz management is a
// separate future task.
const adminCourseEditRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'courses/$courseId/edit',
  component: lazyRouteComponent(() => import('@/pages/admin/CourseEditPage'), 'CourseEditPage'),
  validateSearch: validateCourseTab,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  publicCourseRoute,
  ...devRoutes,
  studentRoute.addChildren([indexRoute, badgesRoute, coursesRoute, profileRoute, courseRoute, lessonRoute]),
  adminRoute.addChildren([
    adminIndexRoute,
    adminUsersRoute,
    adminUserDetailRoute,
    adminCoursesRoute,
    adminGamesRoute,
    adminGamificationRoute,
    adminNotificationsRoute,
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
