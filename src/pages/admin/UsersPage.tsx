import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog'
import { DeleteUserAlertDialog } from '@/components/admin/users/DeleteUserAlertDialog'
import { EditUserDialog } from '@/components/admin/users/EditUserDialog'
import { UpdateEmailDialog } from '@/components/admin/users/UpdateEmailDialog'
import { UpdatePasswordDialog } from '@/components/admin/users/UpdatePasswordDialog'
import { UserTable } from '@/components/admin/users/UserTable'
import { useUsers, type AdminUserRow, type RoleFilter } from '@/hooks/admin/useUsers'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

type DialogKind = 'edit' | 'email' | 'password' | 'delete'

export function UsersPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [page, setPage] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [activeDialog, setActiveDialog] = useState<DialogKind | null>(null)
  const [activeUser, setActiveUser] = useState<AdminUserRow | null>(null)

  // Debounced so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const { data, count, isLoading, isError } = useUsers({
    search,
    roleFilter,
    page,
    pageSize: PAGE_SIZE,
  })

  const { rangeStart, rangeEnd, pageCount } = useMemo(
    () => ({
      rangeStart: count === 0 ? 0 : page * PAGE_SIZE + 1,
      rangeEnd: Math.min((page + 1) * PAGE_SIZE, count),
      pageCount: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    }),
    [count, page],
  )

  function openDialog(kind: DialogKind, user: AdminUserRow) {
    setActiveUser(user)
    setActiveDialog(kind)
  }

  function closeDialog(open: boolean) {
    if (!open) setActiveDialog(null)
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">
            {count} {count === 1 ? 'account' : 'accounts'}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Add user
        </Button>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            className="pl-8"
            placeholder="Search name or email…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              // A new search invalidates the current offset — page 3 of
              // the old result set is meaningless against the new one.
              setPage(0)
            }}
            aria-label="Search users"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value as RoleFilter)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <UserTable
        rows={data}
        isLoading={isLoading}
        isError={isError}
        onEdit={(user) => openDialog('edit', user)}
        onChangeEmail={(user) => openDialog('email', user)}
        onResetPassword={(user) => openDialog('password', user)}
        onDelete={(user) => openDialog('delete', user)}
      />

      <div className="mt-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {count === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${count}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || isLoading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm tabular-nums">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount || isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog user={activeUser} open={activeDialog === 'edit'} onOpenChange={closeDialog} />
      <UpdateEmailDialog
        user={activeUser}
        open={activeDialog === 'email'}
        onOpenChange={closeDialog}
      />
      <UpdatePasswordDialog
        user={activeUser}
        open={activeDialog === 'password'}
        onOpenChange={closeDialog}
      />
      <DeleteUserAlertDialog
        user={activeUser}
        open={activeDialog === 'delete'}
        onOpenChange={closeDialog}
      />
    </div>
  )
}
