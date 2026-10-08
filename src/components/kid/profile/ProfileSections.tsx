import { useState, type FormEvent } from 'react'
import { ChevronRight, CircleHelp, FileText, LifeBuoy, Shield, Trash2, Vibrate, Volume2 } from 'lucide-react'
import { AuthField } from '@/components/auth/AuthField'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  useChangePassword,
  useDeletionRequest,
  useRequestDeletion,
  useRequestEmailChange,
  useUpdateDisplayName,
  type KidProfile,
} from '@/hooks/useKidProfile'
import { useBackClosable } from '@/hooks/useBackClosable'
import { useHapticsSetting } from '@/hooks/useHapticsSetting'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { useBranding } from '@/hooks/useSettings'
import * as haptics from '@/lib/haptics'

/*
 * The Profile page's account, preferences and log-out pieces, shared by the mobile
 * page (pages/KidProfilePage.tsx) and the >= 1024px one (DesktopProfile). Moved here
 * unchanged from KidProfilePage.tsx so both layouts render the same components.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Placeholders — swap for the real legal URLs before ship (flagged again in the task summary).
const PRIVACY_URL = 'https://wisdomhatch.example/privacy'
const TERMS_URL = 'https://wisdomhatch.example/terms'

/** Collapsed by default — one tap reveals the three edit forms and the deletion request beneath them. */
export function AccountSection({ profile }: { profile: KidProfile }) {
  // An inline section, not an overlay: Android Back does not collapse it (Profile goes Home).
  const [open, setOpen] = useState(false)
  return (
    <section className="kid-card kp-card" aria-label="Account">
      <h2 className="kp-card-title kp-collapse-heading">
        <button
          type="button"
          className="kp-collapse-trigger kid-tap"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          data-testid="account-toggle"
        >
          Account & Security
          <ChevronRight className="kp-collapse-chevron size-5" data-open={open} aria-hidden />
        </button>
      </h2>
      <div className="kp-collapse" data-open={open}>
        <div>
          <div className="kp-subsection">
            <h3 className="kp-subsection-title">Name</h3>
            <NameForm current={profile.displayName} />
          </div>
          <div className="kp-subsection">
            <h3 className="kp-subsection-title">Email</h3>
            <EmailForm current={profile.email} />
          </div>
          <div className="kp-subsection">
            <h3 className="kp-subsection-title">Password</h3>
            <PasswordForm />
          </div>
          <div className="kp-subsection" data-tone="danger">
            <DeleteAccountAction />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Sound preference, a mailto support row, and version/legal links — grouped under one card, same bounded-subsection pattern as Account. */
export function PreferencesSection() {
  const [soundEnabled, setSoundEnabled] = useSoundEffects()
  const [hapticsEnabled, setHapticsEnabled] = useHapticsSetting()
  // Settings > Branding: support email and help link, each shown only when set.
  const { productName, supportEmail, helpUrl } = useBranding()
  return (
    <section className="kid-card kp-card" aria-label="Preferences">
      <h2 className="kp-card-title">Preferences &amp; Support</h2>
      <div className="kp-subsection">
        <h3 className="kp-subsection-title">Sound &amp; haptics</h3>
        <div className="kp-toggle-row">
          <span className="kp-toggle-label">
            <Volume2 className="size-5" aria-hidden />
            Sound effects
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            className="kp-toggle kid-tap"
            data-on={soundEnabled}
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              haptics.select()
            }}
            data-testid="sound-toggle"
          >
            <span className="kp-toggle-thumb" />
          </button>
        </div>
        <div className="kp-toggle-row">
          <span className="kp-toggle-label">
            <Vibrate className="size-5" aria-hidden />
            Haptic feedback
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={hapticsEnabled}
            aria-label="Haptic feedback"
            className="kp-toggle kid-tap"
            data-on={hapticsEnabled}
            onClick={() => {
              const next = !hapticsEnabled
              setHapticsEnabled(next)
              // Turning it on buzzes once as a preview; turning it off stays silent.
              haptics.select()
            }}
            data-testid="haptics-toggle"
          >
            <span className="kp-toggle-thumb" />
          </button>
        </div>
      </div>
      {supportEmail || helpUrl ? (
        <div className="kp-subsection">
          <h3 className="kp-subsection-title">Help &amp; Support</h3>
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`} className="kp-row kid-tap" data-testid="help-support">
              <span className="kp-row-icon" data-color="teal">
                <LifeBuoy className="size-4" aria-hidden />
              </span>
              <span className="kp-row-text">Email support</span>
              <ChevronRight className="kp-row-chevron size-5" aria-hidden />
            </a>
          ) : null}
          {helpUrl ? (
            <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="kp-row kid-tap" data-testid="help-link">
              <span className="kp-row-icon" data-color="teal">
                <CircleHelp className="size-4" aria-hidden />
              </span>
              <span className="kp-row-text">Help</span>
              <ChevronRight className="kp-row-chevron size-5" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="kp-subsection">
        <h3 className="kp-subsection-title">About</h3>
        <p className="kp-about-version" data-testid="about-product">
          {productName} · Version {__APP_VERSION__}
        </p>
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="kp-row kid-tap" data-testid="privacy-link">
          <span className="kp-row-icon" data-color="plum">
            <Shield className="size-4" aria-hidden />
          </span>
          <span className="kp-row-text">Privacy Policy</span>
          <ChevronRight className="kp-row-chevron size-5" aria-hidden />
        </a>
        <a href={TERMS_URL} target="_blank" rel="noreferrer" className="kp-row kid-tap" data-testid="terms-link">
          <span className="kp-row-icon" data-color="gold">
            <FileText className="size-4" aria-hidden />
          </span>
          <span className="kp-row-text">Terms of Service</span>
          <ChevronRight className="kp-row-chevron size-5" aria-hidden />
        </a>
      </div>
    </section>
  )
}

/**
 * Not a hard delete: consistent with the app's archive-only philosophy, this
 * only inserts a row (`deletion_requests`, migration 027) after a confirm
 * step. An admin acting on it is a separate, later task.
 */
function DeleteAccountAction() {
  const deletionRequest = useDeletionRequest()
  const requestDeletion = useRequestDeletion()
  const [confirming, setConfirming] = useState(false)
  useBackClosable(confirming, () => setConfirming(false))

  if (deletionRequest.data) {
    return (
      <p className="kp-danger-note" role="status" data-testid="deletion-requested">
        Deletion requested. We'll be in touch about next steps.
      </p>
    )
  }

  return (
    <>
      <button type="button" className="kp-danger-link kid-tap" onClick={() => setConfirming(true)} data-testid="request-deletion">
        <Trash2 className="size-4" aria-hidden />
        Request account deletion
      </button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="kid-card kid-font max-w-[calc(100%-2rem)] text-ink ring-0 sm:max-w-sm">
          <DialogTitle className="kid-text-heading text-ink [font-family:var(--font-kid)]!">Delete your account?</DialogTitle>
          <DialogDescription className="kid-text-body text-ink">
            We'll receive your request and take care of the rest from here — this doesn't delete anything right away.
          </DialogDescription>
          <div className="mt-2 flex gap-3">
            <button type="button" className="candy-btn-quiet kid-tap flex-1" onClick={() => setConfirming(false)} data-testid="cancel-deletion">
              Cancel
            </button>
            <button
              type="button"
              className="candy-btn kid-tap flex-1"
              data-tone="coral"
              disabled={requestDeletion.isPending}
              onClick={() => requestDeletion.mutate(undefined, { onSuccess: () => setConfirming(false) })}
              data-testid="confirm-deletion"
            >
              {requestDeletion.isPending ? 'Sending…' : 'Yes, delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
      <button type="submit" className="candy-btn kid-tap kp-form-btn" disabled={update.isPending} data-testid="save-name">
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
          <button type="submit" className="candy-btn kid-tap kp-form-btn" disabled={request.isPending} data-testid="save-email">
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
      <button type="submit" className="candy-btn kid-tap kp-form-btn" disabled={change.isPending} data-testid="save-password">
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
