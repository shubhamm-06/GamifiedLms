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
import { useUpdatePassword } from '@/hooks/admin/useUserMutations'
import type { AdminUserRow } from '@/hooks/admin/useUsers'
import { MIN_PASSWORD_LENGTH } from '@/lib/adminConstants'

interface FieldErrors {
  newPassword?: string
  confirmPassword?: string
}

/** Mounts fresh per open, so a typed password never persists in state. */
function UpdatePasswordForm({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const updatePassword = useUpdatePassword()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: FieldErrors = {}
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      next.newPassword = `Must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (newPassword !== confirmPassword) next.confirmPassword = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    updatePassword.mutate({ userId: user.id, newPassword }, { onSuccess: onDone })
  }

  const remaining = MIN_PASSWORD_LENGTH - newPassword.length

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="password-new">New password</Label>
        <Input
          id="password-new"
          type="text"
          autoComplete="new-password"
          value={newPassword}
          aria-invalid={!!errors.newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {errors.newPassword ? (
          <p className="text-destructive text-sm">{errors.newPassword}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            {newPassword.length === 0
              ? `At least ${MIN_PASSWORD_LENGTH} characters.`
              : remaining > 0
                ? `${remaining} more character${remaining === 1 ? '' : 's'} needed.`
                : 'Long enough.'}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password-confirm">Confirm password</Label>
        <Input
          id="password-confirm"
          type="text"
          autoComplete="new-password"
          value={confirmPassword}
          aria-invalid={!!errors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {errors.confirmPassword ? (
          <p className="text-destructive text-sm">{errors.confirmPassword}</p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={updatePassword.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={updatePassword.isPending}>
          {updatePassword.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface UpdatePasswordDialogProps {
  user: AdminUserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpdatePasswordDialog({ user, open, onOpenChange }: UpdatePasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            This immediately changes {user ? user.display_name : 'the user'}&rsquo;s password. They
            won&rsquo;t be notified automatically — let them know directly.
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <UpdatePasswordForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
