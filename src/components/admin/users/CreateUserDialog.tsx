import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Sparkles } from 'lucide-react'
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
import { useCreateUser } from '@/hooks/admin/useUserMutations'
import { MIN_PASSWORD_LENGTH } from '@/lib/adminConstants'
import type { UserRole } from '@/lib/adminUserApi'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const GENERATED_PASSWORD_LENGTH = 12

// Ambiguous glyphs (O/0, l/1/I) are left out — these get read aloud or
// copied by hand when handing an account to someone.
const PASSWORD_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'

function generatePassword(): string {
  const values = new Uint32Array(GENERATED_PASSWORD_LENGTH)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => PASSWORD_ALPHABET[v % PASSWORD_ALPHABET.length]).join('')
}

interface FieldErrors {
  email?: string
  displayName?: string
  password?: string
  confirmPassword?: string
}

/**
 * Split out so it mounts fresh every time the dialog opens — the
 * previous entry (and any revealed password) can't leak into the next
 * one, without needing a reset effect.
 */
function CreateUserForm({ onDone }: { onDone: () => void }) {
  const createUser = useCreateUser()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!displayName.trim()) next.displayName = 'Display name is required.'
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleGenerate() {
    const generated = generatePassword()
    setPassword(generated)
    setConfirmPassword(generated)
    setShowPassword(true)
    setErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    createUser.mutate(
      { email: email.trim(), password, display_name: displayName.trim(), role },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="create-email">Email</Label>
        <Input
          id="create-email"
          type="email"
          autoComplete="off"
          value={email}
          aria-invalid={!!errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email ? <p className="text-destructive text-sm">{errors.email}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="create-name">Display name</Label>
        <Input
          id="create-name"
          value={displayName}
          aria-invalid={!!errors.displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        {errors.displayName ? (
          <p className="text-destructive text-sm">{errors.displayName}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="create-password">Password</Label>
          <Button type="button" variant="ghost" size="xs" onClick={handleGenerate}>
            <Sparkles />
            Generate
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            id="create-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            aria-invalid={!!errors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {errors.password ? <p className="text-destructive text-sm">{errors.password}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="create-confirm">Confirm password</Label>
        <Input
          id="create-confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          aria-invalid={!!errors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {errors.confirmPassword ? (
          <p className="text-destructive text-sm">{errors.confirmPassword}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="create-role">Role</Label>
        <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
          <SelectTrigger id="create-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={createUser.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? 'Creating…' : 'Create user'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            The account is created already confirmed — they can log in straight away.
          </DialogDescription>
        </DialogHeader>
        <CreateUserForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
