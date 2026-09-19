import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Award, Plus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AwardXpForm } from '@/components/admin/users/AwardXpForm'
import { TrashUsersDialog } from '@/components/admin/users/TrashUsersDialog'
import { EditUserDialog } from '@/components/admin/users/EditUserDialog'
import { EnrollCourseDialog } from '@/components/admin/users/EnrollCourseDialog'
import { EnrollmentStatusPill } from '@/components/admin/users/EnrollmentStatusPill'
import { RevokeEnrollmentAlertDialog } from '@/components/admin/users/RevokeEnrollmentAlertDialog'
import { UpdateEmailDialog } from '@/components/admin/users/UpdateEmailDialog'
import { UpdatePasswordDialog } from '@/components/admin/users/UpdatePasswordDialog'
import {
  useUserBadges,
  useUserEnrollments,
  useUserProfile,
  useUserProgress,
  type EnrollmentWithCourse,
  type UserProfileDetail,
} from '@/hooks/admin/useUserDetail'
import type { AdminUserRow } from '@/hooks/admin/useUsers'
import { PRIMARY_ADMIN_ID } from '@/lib/adminConstants'
import { adminSessionQueryOptions } from '@/lib/adminSession'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * The account dialogs (Edit/Change email/Reset password/Delete) are shared
 * verbatim with the list page and only read this subset of fields — never
 * user_stats. Adapting to their existing prop type keeps them completely
 * untouched rather than widening their types for one caller.
 */
function toAdminUserRow(profile: UserProfileDetail): AdminUserRow {
  return {
    id: profile.id,
    display_name: profile.display_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    role: profile.role,
    created_at: profile.created_at,
    user_stats: profile.user_stats
      ? { total_xp: profile.user_stats.total_xp, level: profile.user_stats.level }
      : null,
  }
}

type AccountDialogKind = 'edit' | 'email' | 'password' | 'trash'

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function UserDetailPage() {
  const { userId } = useParams({ from: '/admin/users/$userId' })
  const navigate = useNavigate()

  const { data: session } = useQuery(adminSessionQueryOptions)
  const { data: profile, isPending, isError } = useUserProfile(userId)
  const { data: enrollments, isPending: enrollmentsPending } = useUserEnrollments(userId)
  const { data: badges, isPending: badgesPending } = useUserBadges(userId)

  const courseIds = (enrollments ?? []).map((e) => e.course_id)
  const { data: progress } = useUserProgress(userId, courseIds)
  const progressByCourse = new Map((progress ?? []).map((p) => [p.courseId, p]))

  const [accountDialog, setAccountDialog] = useState<AccountDialogKind | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<EnrollmentWithCourse | null>(null)

  if (isPending) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  // A bad id and an RLS-hidden row look identical from here, and both mean
  // the same thing to the admin: there's nothing to show — same handling as
  // CourseEditPage's "Course not found".
  if (isError || !profile) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="font-medium">User not found</p>
        <p className="text-muted-foreground mt-1 text-sm">
          They may be in the trash, or the link is wrong.
        </p>
        <Link to="/admin/users" className="text-teal-d mt-3 inline-block text-sm hover:underline">
          Back to users
        </Link>
      </div>
    )
  }

  const isPrimaryAdmin = profile.id === PRIMARY_ADMIN_ID
  // The server refuses both (and the last admin); disabling up front saves a refused click.
  const isTrashed = !!profile.deleted_at
  const trashBlockedReason = isPrimaryAdmin
    ? "The primary admin account can't be moved to trash."
    : profile.id === session?.userId
      ? "You can't move your own account to trash."
      : null
  const adminUserRow = toAdminUserRow(profile)
  const stats = profile.user_stats

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link to="/admin/users" className="text-muted-foreground text-sm hover:underline">
          ← Back to users
        </Link>
      </div>

      <header className="flex items-center gap-3">
        <Avatar className="size-12">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-sm font-semibold">
            {initialsOf(profile.display_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{profile.display_name}</h1>
          <p className="text-muted-foreground text-sm">{profile.email}</p>
        </div>
      </header>

      <Section title="Account">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">Role</dt>
            <dd className="mt-0.5">
              <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                {profile.role === 'admin' ? 'Admin' : 'Student'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Joined</dt>
            <dd className="mt-0.5">{dateFormatter.format(new Date(profile.created_at))}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => setAccountDialog('edit')}>
            Edit profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAccountDialog('email')}>
            Change email
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAccountDialog('password')}>
            Reset password
          </Button>
          {isTrashed ? (
            <Link to="/admin/trash" search={{ tab: 'users' }} className="text-teal-d text-sm hover:underline">
              In the trash — restore from Trash
            </Link>
          ) : trashBlockedReason ? (
            <Tooltip>
              {/* A disabled trigger swallows pointer events, so the tooltip
                  needs its own wrapper to be hoverable — same treatment as
                  the list page's disabled Move to trash item. */}
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled>
                    Move to trash
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{trashBlockedReason}</TooltipContent>
            </Tooltip>
          ) : (
            // Reversible, so not the red destructive style (red is for the Trash page's permanent delete).
            <Button variant="outline" size="sm" onClick={() => setAccountDialog('trash')}>
              Move to trash
            </Button>
          )}
        </div>
      </Section>

      <Section title="Stats">
        {stats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Total XP" value={String(stats.total_xp)} />
            <StatTile label="Level" value={String(stats.level)} />
            <StatTile label="Current streak" value={`${stats.current_streak}d`} />
            <StatTile label="Longest streak" value={`${stats.longest_streak}d`} />
            <StatTile
              label="Last activity"
              value={
                stats.last_activity_date
                  ? dateFormatter.format(new Date(stats.last_activity_date))
                  : '—'
              }
            />
            <StatTile label="Lessons completed" value={String(stats.lessons_completed)} />
          </div>
        ) : (
          // No row yet is the common case (fn_process_xp_transaction only
          // creates one on a user's first XP event) — not an error state.
          <p className="text-muted-foreground text-sm">
            No activity yet — stats appear once this user earns their first XP.
          </p>
        )}

        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-medium">Award XP manually</p>
          <AwardXpForm userId={userId} />
        </div>
      </Section>

      <Section
        title="Enrollments"
        action={
          <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)}>
            <Plus />
            Enroll in a course
          </Button>
        }
      >
        {enrollmentsPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (enrollments ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">Not enrolled in any course.</p>
        ) : (
          <div className="space-y-2">
            {(enrollments ?? []).map((enrollment) => {
              const p = progressByCourse.get(enrollment.course_id)
              return (
                <div
                  key={enrollment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {enrollment.courses?.title ?? 'Unknown course'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {enrollment.source} · enrolled{' '}
                      {dateFormatter.format(new Date(enrollment.enrolled_at))}
                      {enrollment.expires_at
                        ? ` · expires ${dateFormatter.format(new Date(enrollment.expires_at))}`
                        : ' · lifetime'}
                      {p ? ` · ${p.completed}/${p.totalPublished} lessons complete` : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnrollmentStatusPill status={enrollment.status} />
                    {enrollment.status === 'active' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-coral-d"
                        onClick={() => setRevokeTarget(enrollment)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Badges">
        {badgesPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (badges ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No badges unlocked yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(badges ?? []).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-md border px-3 py-2">
                {entry.badges.icon_url ? (
                  <img src={entry.badges.icon_url} alt="" className="size-8 rounded" />
                ) : (
                  <span className="bg-gold/15 text-gold-d flex size-8 shrink-0 items-center justify-center rounded-full">
                    <Award className="size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.badges.name}</p>
                  {entry.badges.description ? (
                    <p className="text-muted-foreground text-xs">{entry.badges.description}</p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    Unlocked {dateFormatter.format(new Date(entry.unlocked_at))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <EditUserDialog
        user={adminUserRow}
        open={accountDialog === 'edit'}
        onOpenChange={(open) => !open && setAccountDialog(null)}
      />
      <UpdateEmailDialog
        user={adminUserRow}
        open={accountDialog === 'email'}
        onOpenChange={(open) => !open && setAccountDialog(null)}
      />
      <UpdatePasswordDialog
        user={adminUserRow}
        open={accountDialog === 'password'}
        onOpenChange={(open) => !open && setAccountDialog(null)}
      />
      <TrashUsersDialog
        users={adminUserRow ? [adminUserRow] : []}
        open={accountDialog === 'trash'}
        onOpenChange={(open) => !open && setAccountDialog(null)}
        // The user is gone from every list once trashed, so leave their page —
        // but only if the trash actually happened.
        onDone={(result) => {
          if (result.succeeded.length > 0) navigate({ to: '/admin/users' })
        }}
      />
      <EnrollCourseDialog
        userId={userId}
        alreadyEnrolledIds={courseIds}
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
      />
      <RevokeEnrollmentAlertDialog
        userId={userId}
        enrollment={revokeTarget}
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      />
    </div>
  )
}
