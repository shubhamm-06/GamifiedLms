import type { ReactNode } from 'react'
import { Link, type LinkComponentProps } from '@tanstack/react-router'

type PrimaryVariant = 'candy' | 'muted' | 'secondary'

interface CommonProps {
  variant: PrimaryVariant
  loading?: boolean
  children: ReactNode
  testId?: string
}

/**
 * The one primary action in the bottom bar (spec Part B3/B4). Fixed size no
 * matter the label, the variant or whether it is loading, so nothing shifts
 * when the label changes or a spinner appears. "muted" always carries its own
 * reason in the label text passed in (never a bare disabled button); it is a
 * state this component renders, not a decision it makes.
 */
export function PrimaryButton({
  variant,
  loading,
  children,
  testId,
  onClick,
}: CommonProps & { onClick?: () => void }) {
  const disabled = variant === 'muted' || loading
  return (
    <button
      type="button"
      className="lp-primary kid-tap kid-num"
      data-variant={loading ? 'candy' : variant}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      data-testid={testId}
    >
      {loading ? <span className="lp-primary-spinner" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  )
}

/** The same fixed shape, as a link (Next lesson, Back to roadmap). */
export function PrimaryLink({
  variant,
  children,
  testId,
  ...linkProps
}: CommonProps & LinkComponentProps<'a'>) {
  return (
    <Link
      className="lp-primary kid-tap"
      data-variant={variant}
      data-testid={testId}
      {...linkProps}
    >
      {children}
    </Link>
  )
}
