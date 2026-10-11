import type { ReactNode } from 'react'
import { Link, type LinkComponentProps } from '@tanstack/react-router'

/**
 * `lesson-next` / `lesson-previous` are the lesson shell's own Next/Previous row
 * (ui.md "Lesson pages redesign" follow-up) — deliberately not the app-wide gold
 * `candy` style, so the lesson's own navigation never reads as "the" primary action
 * the way Home's CTAs do. Gold stays only on the rail's next-up row.
 */
type PrimaryVariant = 'candy' | 'muted' | 'secondary' | 'lesson-next' | 'lesson-previous'

interface CommonProps {
  variant: PrimaryVariant
  loading?: boolean
  children: ReactNode
  testId?: string
  /** 56x56, icon-only — the mobile Previous button only; pair with `aria-label`. */
  square?: boolean
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
  square,
  onClick,
  'aria-label': ariaLabel,
}: CommonProps & { onClick?: () => void; 'aria-label'?: string }) {
  const disabled = variant === 'muted' || loading
  return (
    <button
      type="button"
      className="lp-primary kid-tap kid-num"
      data-variant={loading ? 'candy' : variant}
      data-square={square ? 'true' : undefined}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onClick}
      data-testid={testId}
    >
      {loading ? <span className="lp-primary-spinner" aria-hidden /> : null}
      {children}
    </button>
  )
}

/** The same fixed shape, as a link (Next lesson, Previous lesson, Back to Home). Children
 * are direct flex items of `.lp-primary` (not wrapped in an extra span) so a label that
 * needs to truncate (`.lp-primary-label`, the mobile Next button) can actually shrink. */
export function PrimaryLink({
  variant,
  children,
  testId,
  square,
  ...linkProps
}: CommonProps & LinkComponentProps<'a'>) {
  return (
    <Link
      className="lp-primary kid-tap"
      data-variant={variant}
      data-square={square ? 'true' : undefined}
      data-testid={testId}
      {...linkProps}
    >
      {children}
    </Link>
  )
}
