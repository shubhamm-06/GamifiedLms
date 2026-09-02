import { useEffect, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { adminSessionQueryOptions } from '@/lib/adminSession'

export function AdminPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-9 max-w-sm flex-1" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * Component-level counterpart to `requireAdmin` (src/lib/adminSession.ts).
 * The route guard is the primary defence; this exists so a protected
 * subtree can never render without a check even if it's mounted outside
 * the guarded route, and to own the loading skeleton. Normally a cache
 * hit from beforeLoad, so there's no second spinner.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { data: session, isPending } = useQuery(adminSessionQueryOptions)

  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    if (isPending) return
    if (!session) {
      navigate({ to: '/login', search: { redirect: window.location.pathname } })
    } else if (!isAdmin) {
      navigate({ to: '/' })
    }
  }, [isPending, session, isAdmin, navigate])

  if (isPending || !isAdmin) return <AdminPageSkeleton />

  return <>{children}</>
}
