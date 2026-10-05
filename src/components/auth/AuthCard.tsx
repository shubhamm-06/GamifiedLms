import type { FormEvent, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/brand'

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
}: AuthCardProps) {
  return (
    <div className="auth-page flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-4 text-ink sm:p-6">
      <img src="/logo.png" alt={APP_NAME} width={720} height={155} className="h-10 w-auto" />
      <div className="w-full max-w-[400px] rounded-[12px] border border-ink/15 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold leading-tight">{heading}</h1>
        {subheading ? <p className="mt-1.5 text-center text-sm text-ink/60">{subheading}</p> : null}
        <div className="mt-6">
          {onSubmit ? (
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
              {children}
              {error ? (
                <p role="alert" className="text-sm text-coral-d">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="relative h-10 w-full rounded-[8px] bg-gold text-sm font-medium text-ink hover:bg-gold-d focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-teal/60 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="absolute left-3.5 animate-spin" size={16} aria-hidden /> : null}
                {submitLabel}
              </Button>
            </form>
          ) : (
            children
          )}
        </div>
        {footer ? <p className="mt-6 text-center text-sm text-ink/60">{footer}</p> : null}
      </div>
    </div>
  )
}
