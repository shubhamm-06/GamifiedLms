import { Outlet } from '@tanstack/react-router'
import { AdminGuard } from './AdminGuard'
import { AdminLayout } from './AdminLayout'

/**
 * The /admin route's component, in its own module so the router can load it lazily:
 * no admin code (shell, editors, zod, dnd-kit) is part of the student bundle. See
 * router.tsx; the access check itself stays in the route's eager `beforeLoad`.
 */
export function AdminShell() {
  return (
    <AdminGuard>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </AdminGuard>
  )
}
