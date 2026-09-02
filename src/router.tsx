import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { AdminGuard, AdminPageSkeleton } from '@/components/admin/AdminGuard'
import { requireAdmin } from '@/lib/adminSession'
import { queryClient } from '@/lib/queryClient'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
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
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupPage,
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
      <Outlet />
    </AdminGuard>
  ),
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/admin/users' })
  },
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'users',
  component: UsersPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  adminRoute.addChildren([adminIndexRoute, adminUsersRoute]),
])

export const router = createRouter({ routeTree, context: { queryClient } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
