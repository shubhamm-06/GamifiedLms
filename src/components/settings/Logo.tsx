import { useBranding } from '@/hooks/useSettings'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings/schema'
import { cn } from '@/lib/utils'

/** The bundled SkillXP artwork, shown while the product keeps its default name and has no uploaded logo. */
const BUNDLED_LOGO = '/logo.png'

/**
 * The product mark, everywhere it appears (auth, student sidebar, admin sidebar).
 * An uploaded logo (Settings > Branding) when there is one; else the bundled
 * artwork while the default product name is in use; else a text wordmark of the
 * product name (Geist semibold, ink). The slot has a fixed height either way, so
 * swapping one for the other never shifts the layout. Uploaded SVGs are only ever
 * shown through <img>.
 */
export function Logo({
  size = 'nav',
  className,
  decorative = false,
  branding,
}: {
  size?: 'nav' | 'auth'
  className?: string
  decorative?: boolean
  /** A draft (admin preview) instead of the live branding. */
  branding?: Settings['branding']
}) {
  const live = useBranding()
  const { productName, logoUrl } = branding ?? live
  const src = logoUrl || (productName === DEFAULT_SETTINGS.branding.productName ? BUNDLED_LOGO : '')
  const height = size === 'auth' ? 'h-10' : 'h-8'
  if (src) {
    return (
      <img
        src={src}
        alt={decorative ? '' : productName}
        className={cn(height, 'w-auto max-w-[160px] object-contain object-left', className)}
        data-testid="logo"
      />
    )
  }
  return (
    <span
      className={cn(
        height,
        'inline-flex max-w-[160px] min-w-0 items-center font-semibold text-ink',
        size === 'auth' ? 'text-xl' : 'text-lg',
        className,
      )}
      aria-hidden={decorative || undefined}
      // Settings > Appearance > Fonts, heading role (a brand wordmark reads as a title).
      // On the admin sidebar, .admin-shell resets --learner-font-heading to `initial`, so
      // this always falls through to --font-sans (Geist) there, never a customer font.
      // (--learner-font-heading, not --font-heading: index.css's `@theme inline` already
      // owns --font-heading as a Tailwind utility token — see lib/settings/store.ts.)
      style={{ fontFamily: 'var(--learner-font-heading, var(--font-sans))' }}
      data-testid="logo"
    >
      <span className="truncate">{productName}</span>
    </span>
  )
}
