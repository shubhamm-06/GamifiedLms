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
import { useUpdateEmail } from '@/hooks/admin/useUserMutations'
import type { AdminUserRow } from '@/hooks/admin/useUsers'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FieldErrors {
  newEmail?: string
  confirmEmail?: string
}

/** Mounts fresh per open, so a previous entry never carries over. */
function UpdateEmailForm({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const updateEmail = useUpdateEmail()
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const next: FieldErrors = {}
    const trimmed = newEmail.trim()
    if (!EMAIL_PATTERN.test(trimmed)) next.newEmail = 'Enter a valid email address.'
    // Typed twice on purpose: this changes someone else's login
    // credential, and they have no way to catch the typo themselves.
    if (trimmed !== confirmEmail.trim()) next.confirmEmail = 'Email addresses do not match.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    updateEmail.mutate({ userId: user.id, newEmail: trimmed }, { onSuccess: onDone })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email-new">New email</Label>
        <Input
          id="email-new"
          type="email"
          autoComplete="off"
          value={newEmail}
          aria-invalid={!!errors.newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        {errors.newEmail ? <p className="text-destructive text-sm">{errors.newEmail}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email-confirm">Confirm new email</Label>
        <Input
          id="email-confirm"
          type="email"
          autoComplete="off"
          value={confirmEmail}
          aria-invalid={!!errors.confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
        />
        {errors.confirmEmail ? (
          <p className="text-destructive text-sm">{errors.confirmEmail}</p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={updateEmail.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateEmail.isPending}>
          {updateEmail.isPending ? 'Updating…' : 'Change email'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface UpdateEmailDialogProps {
  user: AdminUserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpdateEmailDialog({ user, open, onOpenChange }: UpdateEmailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>
            {user ? (
              <>
                This is the address {user.display_name} logs in with. Currently{' '}
                <span className="font-medium">{user.email}</span>.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <UpdateEmailForm key={user.id} user={user} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
