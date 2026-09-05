# Routes & Permissions

Route tree is code-based in `src/router.tsx` (TanStack Router), not
file-based — new routes are added there, not by creating files under a
`routes/` directory.

## Frontend routes

| Route | Component | Access | Notes |
|---|---|---|---|
| `/` | `HomePage` | Public | Placeholder landing page; also the redirect target after a successful login/signup with no pending redirect |
| `/login` | `LoginPage` | Public | Accepts a `redirect` search param (path to return to after login — set by the admin guard) |
| `/signup` | `SignupPage` | Public | On success: session present → navigate `/`; no session (email confirmation required) → "check your email" copy |
| `/admin` | — | Admin only | Guarded; redirects to `/admin/users` |
| `/admin/users` | `UsersPage` | Admin only | List/search/filter/paginate users; create/edit/change-email/reset-password/delete dialogs |

## The `/admin` guard

Enforced once, at the parent route, via `beforeLoad` — not per-child, so a
new admin page inherits protection automatically without remembering to add
a check.

1. `beforeLoad` calls `requireAdmin(queryClient, location.href)`
   (`src/lib/adminSession.ts`), which primes a shared TanStack Query cache
   entry (`['admin','session']`) by calling `supabase.auth.getSession()`
   then reading that user's `profiles.role`.
2. No session → `redirect({ to: '/login', search: { redirect: href } })`.
   `LoginPage` reads that param and returns the user there after a
   successful login.
3. Session but `role !== 'admin'` → `redirect({ to: '/' })`, **silently, no
   "unauthorized" messaging** — telling a non-admin that an admin section
   exists at all is itself a small disclosure, so it just looks like a
   normal redirect home.
4. `AdminGuard` (component) re-reads the same cached query and shows a full
   skeleton while pending — normally a cache hit from step 1, so there's no
   second loading flash. It exists as defense-in-depth in case a protected
   subtree is ever mounted outside the guarded route tree, and to own the
   skeleton's rendering.

The cache entry has a 30s `staleTime` — convenience only, so a revoked admin
loses UI access reasonably quickly. **RLS and the Edge Function's own
role check are the real enforcement**; neither trusts this cache.

## Edge Function endpoints

### `POST /functions/v1/admin-user-management`

See `schema.md` for the full action contract (payload shapes, behavior per
action). Access rule: **admin only, enforced server-side** — the function
resolves the caller from the JWT, looks up `profiles.role` via the
service-role client, and returns `403 Forbidden` before parsing the request
body if the caller isn't an admin. `verify_jwt: true` at the platform level
is a floor, not the actual authorization check — do not lower it, and do not
treat JWT presence alone as sufficient anywhere that calls this function.

Client wrapper: `src/lib/adminUserApi.ts` (`createUser`, `updateUserEmail`,
`updateUserPassword`, `deleteUser`), invoked from
`src/hooks/admin/useUserMutations.ts`.
