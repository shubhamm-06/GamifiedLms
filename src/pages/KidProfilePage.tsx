import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Flame, LogOut, Pencil, Sparkles, Trophy } from 'lucide-react'
import { AuthField } from '@/components/auth/AuthField'
import { Avatar } from '@/components/kid/Avatar'
import { AvatarBuilder } from '@/components/kid/AvatarBuilder'
import { StreakCalendar } from '@/components/kid/StreakCalendar'
import { useKidHeader } from '@/components/kid/kidHeader'
import { RetryScreen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useActivityDays,
  useChangePassword,
  useKidProfile,
  useRequestEmailChange,
  useUpdateAvatar,
  useUpdateDisplayName,
  type KidProfile,
} from '@/hooks/useKidProfile'
import { supabase } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * `/profile`: avatar (tap to open the builder), account info a student can
 * edit directly (name, email, password), level/XP/streak, a streak calendar
 * and Log out.
 */
export function KidProfilePage() {
  useKidHeader('Profile')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profile = useKidProfile()
  const activity = useActivityDays()
  const [leaving, setLeaving] = useState(false)
  const [building, setBuilding] = useState(false)

  const updateAvatar = useUpdateAvatar()

  async function logOut() {
    setLeaving(true)
    await supabase.auth.signOut()
    // Every kid query is keyed without the user, so drop them all before the next sign-in.
    queryClient.clear()
    void navigate({ to: '/login' })
  }

  if (profile.isPending) {
    return (
      <div className="kp" aria-busy="true" aria-label="Loading your profile">
        <Skeleton className="mx-auto size-24 rounded-full bg-ink/10" />
        <Skeleton className="mx-auto mt-4 h-8 w-48 rounded-xl bg-ink/10" />
      </div>
    )
  }
  if (profile.isError) {
    return <RetryScreen title="Oops! We couldn't load your profile" onRetry={() => void profile.refetch()} />
  }
  const p = profile.data

  if (building) {
    return (
      <AvatarBuilder
        initial={p.avatarConfig}
        saving={updateAvatar.isPending}
        onCancel={() => setBuilding(false)}
        onSave={(config) => updateAvatar.mutate(config, { onSuccess: () => setBuilding(false) })}
      />
    )
  }

  return (
    <div className="kp" data-testid="profile">
      <button type="button" className="kp-avatar-btn kid-tap" onClick={() => setBuilding(true)} data-testid="edit-avatar">
        <Avatar config={p.avatarConfig} size={96} />
        <span className="kp-avatar-edit" aria-hidden>
          <Pencil className="size-4" strokeWidth={2.75} />
        </span>
        <span className="sr-only">Edit your avatar</span>
      </button>

      <h1 className="kp-name" data-testid="profile-name">
        {p.displayName}
      </h1>

      <ul className="kp-stats">
        <li className="kid-card kp-stat" data-testid="stat-level">
          <Trophy className="size-6" aria-hidden />
          <span className="kp-stat-num kid-num">{p.level}</span>
          <span className="kp-stat-label">Level</span>
        </li>
        <li className="kid-card kp-stat" data-testid="stat-xp">
          <Sparkles className="size-6" aria-hidden />
          <span className="kp-stat-num kid-num">{p.totalXp}</span>
          <span className="kp-stat-label">XP</span>
        </li>
        <li className="kid-card kp-stat" data-testid="stat-streak">
          <Flame className="size-6" aria-hidden />
          <span className="kp-stat-num kid-num">{p.currentStreak}</span>
          <span className="kp-stat-label">Day streak</span>
        </li>
      </ul>

      <section className="kid-card kp-card" aria-label="Your streak">
        <h2 className="kp-card-title">Your last 5 weeks</h2>
        {activity.isPending ? (
          <Skeleton className="h-32 w-full rounded-xl bg-ink/10" />
        ) : activity.isError ? (
          <p className="kp-card-note">Couldn't load your calendar right now.</p>
        ) : (
          <StreakCalendar activeDays={activity.data} />
        )}
      </section>

      <AccountSection profile={p} />

      <button
        type="button"
        className="candy-btn-quiet kid-tap kp-logout"
        onClick={() => void logOut()}
        disabled={leaving}
        data-testid="logout"
      >
        <LogOut className="size-5" aria-hidden />
        Log out
      </button>
    </div>
  )
}

function AccountSection({ profile }: { profile: KidProfile }) {
  return (
    <section className="kid-card kp-card" aria-label="Account">
      <h2 className="kp-card-title">Account</h2>
      <NameForm current={profile.displayName} />
      <EmailForm current={profile.email} />
      <PasswordForm />
    </section>
  )
}

function NameForm({ current }: { current: string }) {
  const update = useUpdateDisplayName()
  const [name, setName] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a name.')
      return
    }
    setError(null)
    update.mutate(trimmed, { onSuccess: () => setSaved(true) })
  }

  return (
    <form className="kp-form" onSubmit={submit} data-testid="name-form">
      <AuthField
        id="profile-name-field"
        label="Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setSaved(false)
        }}
        error={error ?? undefined}
      />
      <button type="submit" className="candy-btn-quiet kid-tap kp-form-btn" disabled={update.isPending} data-testid="save-name">
        {update.isPending ? 'Saving…' : 'Save name'}
      </button>
      {saved ? (
        <p className="kp-form-note" role="status" data-testid="name-saved">
          Saved!
        </p>
      ) : null}
    </form>
  )
}

function EmailForm({ current }: { current: string }) {
  const request = useRequestEmailChange()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingFor, setPendingFor] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    request.mutate(trimmed, {
      onSuccess: () => setPendingFor(trimmed),
      onError: () => setError("Couldn't start that change. Please try again."),
    })
  }

  return (
    <form className="kp-form" onSubmit={submit} data-testid="email-form">
      <p className="kp-form-current">
        Current email: <span className="kid-num">{current}</span>
      </p>
      {pendingFor ? (
        <p className="kp-form-pending" role="status" data-testid="email-pending">
          Check {pendingFor} to confirm the change. Your email stays {current} until you do.
        </p>
      ) : (
        <>
          <AuthField
            id="profile-email-field"
            label="New email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ?? undefined}
          />
          <button type="submit" className="candy-btn-quiet kid-tap kp-form-btn" disabled={request.isPending} data-testid="save-email">
            {request.isPending ? 'Sending…' : 'Change email'}
          </button>
        </>
      )}
    </form>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [saved, setSaved] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const next: typeof errors = {}
    if (!currentPassword) next.current = 'Enter your current password.'
    if (newPassword.length < 8) next.next = 'Must be at least 8 characters.'
    if (newPassword !== confirm) next.confirm = "Passwords don't match."
    setErrors(next)
    if (Object.keys(next).length > 0) return

    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setSaved(true)
          setCurrentPassword('')
          setNewPassword('')
          setConfirm('')
        },
        onError: (err) => {
          setErrors(err.message === 'wrong_password' ? { current: "That isn't your current password." } : { current: 'Something went wrong. Please try again.' })
        },
      },
    )
  }

  return (
    <form className="kp-form" onSubmit={submit} data-testid="password-form">
      <AuthField
        id="profile-current-password"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => {
          setCurrentPassword(e.target.value)
          setSaved(false)
        }}
        error={errors.current}
      />
      <AuthField
        id="profile-new-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => {
          setNewPassword(e.target.value)
          setSaved(false)
        }}
        error={errors.next}
      />
      <AuthField
        id="profile-confirm-password"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value)
          setSaved(false)
        }}
        error={errors.confirm}
      />
      <button type="submit" className="candy-btn-quiet kid-tap kp-form-btn" disabled={change.isPending} data-testid="save-password">
        {change.isPending ? 'Saving…' : 'Change password'}
      </button>
      {saved ? (
        <p className="kp-form-note" role="status" data-testid="password-saved">
          Password changed!
        </p>
      ) : null}
    </form>
  )
}
