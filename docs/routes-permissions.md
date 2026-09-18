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
| `/admin/users` | `UsersPage` | Admin only | List/search/filter/paginate users; create dialog; row click navigates to the detail route below |
| `/admin/users/$userId` | `UserDetailPage` | Admin only | Account (edit/change-email/reset-password/delete — same dialogs and Edge Function calls as the list), Stats (`user_stats`, left-joined — no row yet is a normal empty state, not an error), Enrollments (manual enroll/revoke, direct RLS writes), Progress (published-lesson completion per course), Badges, manual XP award. Replaces the standalone "Students" concept — see below |
| `/admin/courses` | `CoursesPage` | Admin only | Sortable/filterable list; row actions are status-contextual (no delete — see `rules.md`) |
| `/admin/courses/new` | `CourseCreatePage` | Admin only | Always inserts as `draft`. Curriculum tab locked until saved |
| `/admin/courses/$courseId/edit` | `CourseEditPage` | Admin only | Course Builder: Basics + Curriculum tabs. Bad id or RLS-hidden row renders "Course not found", not a crash |
| `/admin/games` | `GamesPage` | Admin only | Sortable/filterable list, same table conventions as `/admin/courses`. Create/edit is a `GameDialog`, not a route — games are a flat record with no nested child content. Delete is real (no archive/status column), refused with a friendly message if any lesson still references the game |
| `/admin/gamification` | `GamificationPage` | Admin only | Sidebar label "Badges & XP". Two stacked sections on one page (not tabs): **Badges** — a TanStack list plus a `BadgeDialog` for create/edit (a Dialog, not a route — flat record, same convention as Games), row actions Edit / Activate-Deactivate / Delete; delete is real (RLS permits it) but refused with "N student(s) already unlocked this — deactivate it instead" when `user_badges` references the badge. **Level Thresholds** (migration 012) — an editable list over `level_thresholds`: add the next level, edit `xp_required` (explicit Save per row), delete any level except 1 (level 1's field is disabled and it has no delete — UI-only protection, see `rules.md`). The client checks the strict-monotonic rule first as fast feedback; the DB trigger is what actually enforces it |
| `/admin/orders` | `OrdersPage` | Admin only | Takes `?view=active\|trash` (defaults `active`, see `?view=` note below). KPI cards (revenue, unresolved, failed) always exclude trashed rows regardless of which view is open + sortable/filterable payments list (status, reconciliation status). Detail/reconciliation is an `OrderDetailDialog`, not a route — a flat record with a 2-field edit, same convention as Games. "Add order" (`AddOrderDialog`) records a payment made outside the gateway plus its enrollment, via the `fn_create_manual_order` RPC (migration 007) — not two sequential inserts; amount/currency auto-fill from the selected course (falls back to 0 for a free course), staying editable after. "Export CSV" dumps the currently-filtered, currently-viewed (active or trash) list; "Import CSV" (`ImportOrdersDialog`) bulk-creates via the same `fn_create_manual_order` RPC, once per row, per-row atomic (one bad row doesn't roll back the rest) — a results summary reports per-row success/failure. Bulk row selection (checkbox column, header select-all scoped to the active filter) drives a selection toolbar: Active offers Mark Resolved/Unresolved, Export selected, and Move to Trash; Trash offers Restore, Export selected, and Delete Permanently (migration 009) — each a single batched request, never one per row. Row-level equivalents live in a per-row dropdown menu once there's more than one possible action (View details/Move to Trash in Active; Restore/Delete Permanently in Trash). Permanent delete is real, RLS-gated to already-trashed rows only (`payments_admin_delete_from_trash`) — see `rules.md` |
| `/admin/settings` | `SettingsPage` | Admin only | Takes `?tab=commerce\|gamification\|identity` (defaults `commerce`, see `?tab=` note below). Commerce: Manual Order Providers + Currencies (both add/toggle/delete list editors, not TanStack Tables) + the Default currency picker (a searchable combobox, migration 011 — plain `Select` doesn't scale to ~180 seeded currencies). Gamification: quiz pass threshold, alone for now, matching the sidebar's own naming for this area. Site Identity: site name/URL, support email, terms/privacy URLs. Each tab saves its own slice of the `app_settings` singleton independently (or, for the currency picker, immediately on selection) — not one cross-tab form — still no settings framework, each tab is one purpose-built component |

**`?tab=` search param.** Both course routes take `tab=basics|curriculum`
(`validateSearch` coerces anything else to `basics`). It's a real search param
rather than component state so the builder tab survives a refresh and can be
linked to — the create flow redirects straight to
`…/edit?tab=curriculum` after the first save. Because `tab` is required on
the edit route's search type, every `navigate` to it must pass one.

There is deliberately **no `/admin/courses/$courseId` index route** —
`$courseId/edit` stands alone, and the builder's Curriculum tab is where
modules, lessons and quiz questions are managed.

**`?view=` search param.** `/admin/orders` takes `view=active|trash`
(`validateSearch` coerces anything else to `active`), the same
`?tab=`-as-real-search-param convention as above — survives a refresh, is
linkable, and switching it (via the `Tabs` control) clears any current row
selection, since Active and Trash are disjoint row sets and a selection
made in one means nothing in the other.

**`?tab=` on `/admin/settings`.** Takes `tab=commerce|gamification|identity`
(defaults `commerce`) — its own value set, unrelated to the course routes'
`basics|curriculum`, but the identical convention: a real search param, not
component state. Superseded a shorter-lived `providers|platform` pair from
when this route had only two tabs (see `changelog.md`) — Platform's fields
now have an actual home to be grouped by instead of one undifferentiated
second tab. Because `tab` is required on this route's search type too,
every `Link`/`navigate` to `/admin/settings` must pass one — e.g. Add
Order's "no active providers, add one in Settings" link passes `search={{
tab: 'commerce' }}` explicitly rather than relying on the default.

**Every sidebar nav target is now a real route.** `/admin/gamification` was the
last one that 404'd inside the admin shell by design (no placeholder page was
ever created for it); `/admin/settings` was the one before it.

**There is no `/admin/students` nav entry, and never a route.** A standalone
students list would just duplicate `/admin/users` (already lists everyone,
with a role filter) — the actual gap was a detail view, which `/admin/users`
now has via `$userId`. The nav slot was dropped rather than repointed at
`/admin/users`, since a second sidebar link to the exact same destination as
"Admin Users" would be clutter, not a feature.

Modules, lessons and quiz questions are deliberately **not** routes of their
own — they only exist within a course, so they are managed inside Course
Builder's Curriculum tab (`/admin/courses/$courseId/edit?tab=curriculum`), not
top-level nav.

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
