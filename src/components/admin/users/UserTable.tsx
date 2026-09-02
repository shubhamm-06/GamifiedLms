import { MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AdminUserRow } from '@/hooks/admin/useUsers'
import { PRIMARY_ADMIN_ID } from '@/lib/adminConstants'

interface UserTableProps {
  rows: AdminUserRow[]
  isLoading: boolean
  isError: boolean
  onEdit: (user: AdminUserRow) => void
  onChangeEmail: (user: AdminUserRow) => void
  onResetPassword: (user: AdminUserRow) => void
  onDelete: (user: AdminUserRow) => void
}

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

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <Badge
      className="border-transparent font-semibold"
      style={
        isAdmin
          ? { backgroundColor: 'var(--gold)', color: 'var(--ink)' }
          : { backgroundColor: 'var(--teal)', color: '#ffffff' }
      }
    >
      {isAdmin ? 'Admin' : 'Student'}
    </Badge>
  )
}

const COLUMN_COUNT = 7

export function UserTable({
  rows,
  isLoading,
  isError,
  onEdit,
  onChangeEmail,
  onResetPassword,
  onDelete,
}: UserTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>XP / Level</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-12 text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="size-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto size-8" />
                </TableCell>
              </TableRow>
            ))
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="h-32 text-center">
                <p className="font-medium" style={{ color: 'var(--coral-d)' }}>
                  Couldn&rsquo;t load users.
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Check your connection and try again.
                </p>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="h-32 text-center">
                <p className="font-medium">No users found</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Try a different search or filter, or add a new user.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((user) => {
              const isPrimaryAdmin = user.id === PRIMARY_ADMIN_ID
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar className="size-8">
                      {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xs font-semibold">
                        {initialsOf(user.display_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{user.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {user.user_stats
                      ? `${user.user_stats.total_xp} XP · L${user.user_stats.level}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(new Date(user.created_at))}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.display_name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(user)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onChangeEmail(user)}>
                          Change email
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onResetPassword(user)}>
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {isPrimaryAdmin ? (
                          <Tooltip>
                            {/* A disabled menu item swallows pointer events, so
                                the tooltip needs its own wrapper to hover. */}
                            <TooltipTrigger asChild>
                              <span className="block">
                                <DropdownMenuItem
                                  disabled
                                  variant="destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>This account can&rsquo;t be deleted.</TooltipContent>
                          </Tooltip>
                        ) : (
                          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(user)}>
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
