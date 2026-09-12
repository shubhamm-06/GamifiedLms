import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
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

type DialogKind = 'edit' | 'email' | 'password' | 'delete'

export function UsersPage() {
  const navigate = useNavigate()
  // Filtering is client-side over an already-fetched list, so the input is
  // read directly — there is no request to debounce.
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [activeDialog, setActiveDialog] = useState<DialogKind | null>(null)
  const [activeUser, setActiveUser] = useState<AdminUserRow | null>(null)

  const { data, isPending, isError } = useUsers()
  const users = data ?? []

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
            {users.length} {users.length === 1 ? 'account' : 'accounts'}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
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
        rows={users}
        isPending={isPending}
        isError={isError}
        search={search}
        roleFilter={roleFilter}
        onRowClick={(user) =>
          navigate({ to: '/admin/users/$userId', params: { userId: user.id } })
        }
        onEdit={(user) => openDialog('edit', user)}
        onChangeEmail={(user) => openDialog('email', user)}
        onResetPassword={(user) => openDialog('password', user)}
        onDelete={(user) => openDialog('delete', user)}
      />

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
