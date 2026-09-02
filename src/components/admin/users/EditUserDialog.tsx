import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUpdateProfile } from '@/hooks/admin/useUserMutations'
import type { AdminUserRow } from '@/hooks/admin/useUsers'
import { PRIMARY_ADMIN_ID } from '@/lib/adminConstants'
import type { UserRole } from '@/lib/adminUserApi'

/** Mounts fresh per open, so the fields initialise from the current row. */
function EditUserForm({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const updateProfile = useUpdateProfile()
  const [displayName, setDisplayName] = useState(user.display_name)
  const [role, setRole] = useState<UserRole>(user.role === 'admin' ? 'admin' : 'student')
  const [error, setError] = useState<string | null>(null)

  const isPrimaryAdmin = user.id === PRIMARY_ADMIN_ID

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!displayName.trim()) {
      setError('Display name is required.')
      return
    }

    updateProfile.mutate(
      {
        userId: user.id,
        displayName: displayName.trim(),
        // Guards against a demotion slipping through if the disabled
        // Select is bypassed — the primary admin keeps its role.
        role: isPrimaryAdmin ? 'admin' : role,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="edit-name">Display name</Label>
        <Input
          id="edit-name"
          value={displayName}
          aria-invalid={!!error}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-role">Role</Label>
        {isPrimaryAdmin ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* A disabled trigger swallows pointer events, so the
                  tooltip needs its own wrapper to hover. */}
              <span className="block">
                <Select value="admin" disabled>
                  <SelectTrigger id="edit-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              The primary admin&rsquo;s role can&rsquo;t be changed here.
            </TooltipContent>
          </Tooltip>
        ) : (
          <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
            <SelectTrigger id="edit-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={updateProfile.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface EditUserDialogProps {
  user: AdminUserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        {user ? (
          <EditUserForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
