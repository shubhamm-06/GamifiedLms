/**
 * The bootstrap admin account. It's hidden from destructive UI here and
 * refused server-side in the admin-user-management Edge Function —
 * deleting it would leave nobody able to reach the admin section.
 *
 * There is deliberately no DB-level guard yet, so a direct
 * service_role/dashboard delete still bypasses both layers. Tracked as
 * an open item in PROJECT_CONTEXT.md.
 */
export const PRIMARY_ADMIN_ID = '91392b37-91f1-4975-afda-e4c238c4d821'

/**
 * Minimum password length the project enforces for admin-created accounts
 * (Add user, Reset password, CSV import) and on the signup page. The Edge
 * Function checks the same number. GoTrue's own configured minimum is looser
 * (6, read from its weak_password error), so this is the stricter of the two.
 */
export const MIN_PASSWORD_LENGTH = 8

/** Postgres error codes the admin hooks branch on (`error.code`). */
export const UNIQUE_VIOLATION = '23505'
export const FK_VIOLATION = '23503'
export const CHECK_VIOLATION = '23514'
export const INSUFFICIENT_PRIVILEGE = '42501'

/** Shared admin date renderers: `4 Oct 2026` and `4 Oct 2026, 3:05 pm` in the viewer's locale. */
export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
export const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
