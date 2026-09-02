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
