# Routes & Permissions

Route tree is code-based in `src/router.tsx` (TanStack Router), not
file-based — new routes are added there, not by creating files under a
`routes/` directory.

## Frontend routes

| Route | Component | Access | Notes |
|---|---|---|---|
| `/` | `HomePage` | Public | Placeholder landing page; the destination for students and any non-admin bounced off `/admin` |
| `/login` | `LoginPage` | Public, but redirects signed-in admins | Accepts a `redirect` search param; see the login guard below |
| `/signup` | `SignupPage` | Public | On success: session present → `/`; no session (email confirmation required) → "check your email" copy |
| `/admin` | `DashboardPage` | Admin only | KPI cards, needs-attention list, recent-activity table |
| `/admin/users` | `UsersPage` | Admin only | List/search/filter/paginate users; create/edit/change-email/reset-password/delete dialogs |
| `/admin/courses` | `CoursesPage` | Admin only | Sortable/filterable list; row actions are status-contextual (no delete — see `rules.md`) |
| `/admin/courses/new` | `CourseCreatePage` | Admin only | Always inserts as `draft`. Curriculum tab locked until saved |
| `/admin/courses/$courseId/edit` | `CourseEditPage` | Admin only | Course Builder: Basics + Curriculum tabs. Bad id or RLS-hidden row renders "Course not found", not a crash |
| `/admin/games` | `GamesPage` | Admin only | Sortable/filterable list, same table conventions as `/admin/courses`. Create/edit is a `GameDialog`, not a route — games are a flat record with no nested child content. Delete is real (no archive/status column), refused with a friendly message if any lesson still references the game |

**`?tab=` search param.** Both course routes take `tab=basics|curriculum`
(`validateSearch` coerces anything else to `basics`). It's a real search param
rather than component state so the builder tab survives a refresh and can be
linked to — the create flow redirects straight to
`…/edit?tab=curriculum` after the first save. Because `tab` is required on
the edit route's search type, every `navigate` to it must pass one.

There is deliberately **no `/admin/courses/$courseId` index route** —
`$courseId/edit` stands alone, and the builder's Curriculum tab is where
modules, lessons and quiz questions are managed.

**Nav targets that don't exist yet** — `/admin/gamification`,
`/admin/students`, `/admin/orders`, `/admin/settings`. They're linked from the
sidebar and 404 inside the admin shell on purpose; no placeholder routes or
stub pages were created for them.

Modules, lessons and quiz questions are deliberately **not** routes of their
own — they only exist within a course, so they belong under a future
`/admin/courses/$courseId`, not top-level nav.

## The `/admin` guard

Enforced once, on the `/admin` layout route via `beforeLoad`, so every
descendant inherits it — verified that a direct hit on a deep path
(`/admin/courses`) is blocked, not just the index.

1. `requireAdmin` (`src/lib/adminSession.ts`) reads the session, then that
   user's `role` from `public.profiles`.
2. No session → `redirect({ to: '/login', search: { redirect: href } })`.
3. Session but `role !== 'admin'` → `redirect({ to: '/' })`, **silently** —
   no "unauthorized" page, since confirming an admin area exists is itself a
   small disclosure.
4. The role is re-read from the database **on every guard run** (the guard
   bypasses the query cache's stale window). A JWT is issued once and would
   keep asserting `admin` after the row was demoted, so neither the token's
   claims nor cached client state is trusted for this.
5. `AdminGuard` (component) re-reads the cached session and renders a
   skeleton while pending — defense-in-depth if a protected subtree is ever
   mounted outside the guarded tree, and it owns the loading UI so no
   protected content flashes.

## The `/login` guard

`redirectIfAdminAlreadySignedIn` runs in `/login`'s `beforeLoad`, so an admin
with a live session is sent on rather than shown the form — this covers a
restored session or a new tab, not just the submit handler. It deliberately
only redirects **admins**; students keep their existing behaviour.

After a successful `signInWithPassword`, `resolvePostLoginPath` decides the
destination from the role: admin → `/admin` (or the deep path they were
bounced from), everyone else → `/`.

**Open-redirect protection.** The `redirect` param is attacker-controllable,
so `safeInternalPath` rejects anything that isn't a rooted same-origin path —
protocol-relative (`//host`) and backslash-containing values included.
A non-admin carrying an `/admin` redirect has it dropped rather than being
bounced off the guard a moment later.

On sign-out the cached session is removed before navigating, otherwise
`/login`'s own guard could read a stale admin session and bounce straight
back to `/admin`.

## Edge Function endpoints

### `POST /functions/v1/admin-user-management`

See `schema.md` for the full action contract. Access rule: **admin only,
enforced server-side** — the function resolves the caller from the JWT, looks
up `profiles.role` via the service-role client, and returns `403 Forbidden`
before parsing the body if the caller isn't an admin. `verify_jwt: true` at
the platform level is a floor, not the authorization check itself.

Client wrapper: `src/lib/adminUserApi.ts`, invoked from
`src/hooks/admin/useUserMutations.ts`.
