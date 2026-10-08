import type { FormEvent, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/settings/Logo'
import { useBranding } from '@/hooks/useSettings'
import type { Settings } from '@/lib/settings/schema'
import { cn } from '@/lib/utils'

// Settings > Appearance > Fonts: the h1 and the submit button are this screen's heading
// role (see ui.md "Settings system > Fonts"); everything else is the inherited body role
// (.auth-page in styles.css). "default" sets no --learner-font-heading, so `inherit`
// (today's Geist, from the admin-shared global font-sans) renders unchanged.
// (--learner-font-heading, not --font-heading: index.css's `@theme inline` already owns
// --font-heading as a Tailwind utility token — see lib/settings/store.ts.)
const HEADING_FONT = { fontFamily: 'var(--learner-font-heading, inherit)' }

interface AuthCardProps {
  heading: string
  subheading?: string
  children: ReactNode
  /** The "other screen" link line under the card content. */
  footer?: ReactNode
  /** When set, children render inside a form whose submit button is drawn here. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  submitLabel?: string
  submitting?: boolean
  /** Server / form-level error, shown above the submit button. */
  error?: string | null
  /** Settings > Branding draft for the admin's live preview; the live settings otherwise. */
  branding?: Settings['branding']
  /** Render inside a preview box instead of filling the screen. */
  preview?: boolean
}

export function AuthCard({
  heading,
  subheading,
  children,
  footer,
  onSubmit,
  submitLabel,
  submitting = false,
  error,
  branding: draft,
  preview = false,
}: AuthCardProps) {
  const live = useBranding()
  const b = draft ?? live
  const bg = b.login.background
  // Settings > Branding: white (default), a solid colour or a cover image. On anything but
  // white, the product mark moves into the card so it is always legible.
  const plain = bg.type === 'none' || (bg.type === 'color' && bg.color.toUpperCase() === '#FFFFFF') || (bg.type === 'image' && !bg.imageUrl)
  const pageStyle =
    bg.type === 'color' && !plain
      ? { backgroundColor: bg.color }
      : bg.type === 'image' && bg.imageUrl
        ? { backgroundImage: `url("${bg.imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : undefined
  const mark = (
    <div className="flex flex-col items-center gap-1.5 text-center" data-testid="auth-mark">
      <Logo size="auth" branding={b} />
      {b.tagline ? <p className="max-w-[320px] text-sm text-ink/70">{b.tagline}</p> : null}
    </div>
  )
  const help = b.footerText || b.supportEmail || b.helpUrl
  return (
    <div
      className={cn(
        'auth-page flex flex-col items-center justify-center gap-6 bg-white p-4 text-ink sm:p-6',
        preview ? 'min-h-[520px] rounded-lg' : 'min-h-dvh',
      )}
      style={pageStyle}
      data-testid="auth-page"
    >
      {plain ? mark : null}
      <div className="w-full max-w-[400px] rounded-[12px] border border-ink/15 bg-white p-8 shadow-sm">
        {plain ? null : <div className="mb-6">{mark}</div>}
        <h1 className="text-center text-2xl font-semibold leading-tight" style={HEADING_FONT}>
          {heading}
        </h1>
        {subheading ? <p className="mt-1.5 text-center text-sm text-ink/60">{subheading}</p> : null}
        <div className="mt-6">
          {onSubmit ? (
            // The admin preview sits inside the settings form, so it renders a plain box, never a nested form.
            preview ? (
              <div className="flex flex-col gap-4">
                {children}
                {error ? (
                  <p role="alert" className="text-sm text-coral-d">
                    {error}
                  </p>
                ) : null}
                <Button
                  type={preview ? 'button' : 'submit'}
                  disabled={submitting}
                  aria-busy={submitting}
                  style={HEADING_FONT}
                  className="relative h-10 w-full rounded-[8px] bg-gold text-sm font-medium text-gold-fg hover:bg-gold-d focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-teal/60 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="absolute left-3.5 animate-spin" size={16} aria-hidden /> : null}
                  {submitLabel}
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
                {children}
                {error ? (
                  <p role="alert" className="text-sm text-coral-d">
                    {error}
                  </p>
                ) : null}
                <Button
                  type={preview ? 'button' : 'submit'}
                  disabled={submitting}
                  aria-busy={submitting}
                  style={HEADING_FONT}
                  className="relative h-10 w-full rounded-[8px] bg-gold text-sm font-medium text-gold-fg hover:bg-gold-d focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-teal/60 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="absolute left-3.5 animate-spin" size={16} aria-hidden /> : null}
                  {submitLabel}
                </Button>
              </form>
            )
          ) : (
            children
          )}
        </div>
        {footer ? <p className="mt-6 text-center text-sm text-ink/60">{footer}</p> : null}
      </div>
      {help ? (
        <div className={cn('max-w-[400px] space-y-1 text-center text-xs', plain ? 'text-ink/60' : 'rounded-md bg-white/90 px-3 py-2 text-ink/70')} data-testid="auth-help">
          {b.footerText ? <p>{b.footerText}</p> : null}
          {b.supportEmail || b.helpUrl ? (
            <p className="flex flex-wrap justify-center gap-x-3">
              {b.supportEmail ? (
                <a className="underline underline-offset-2 hover:text-ink" href={`mailto:${b.supportEmail}`}>
                  {b.supportEmail}
                </a>
              ) : null}
              {b.helpUrl ? (
                <a className="underline underline-offset-2 hover:text-ink" href={b.helpUrl} target="_blank" rel="noopener noreferrer">
                  Help
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}