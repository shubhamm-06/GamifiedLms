# Routes & Permissions

Route tree is code-based in `src/router.tsx` (TanStack Router), not
file-based — new routes are added there, not by creating files under a
`routes/` directory.

## Frontend routes

| Route | Component | Access | Notes |
|---|---|---|---|
| `/` | `HomePage` | Public | Placeholder landing page; the destination for students and any non-admin bounced off `/admin` |
| `/courses/$courseId` | `CoursePage` | Signed-in (student route group, below) | The course roadmap — modules and lessons as a learning path with lock state, progress and a Continue button. **Not linked from anywhere yet** (no home/dashboard screen exists) — reachable only by typing or being sent the URL. Takes an optional `?open=<lessonId>` search param (`validateSearch` keeps a non-empty string, else nothing): the page opens that lesson's sheet once on arrival, then clears the param with a replace navigation so Back and refresh do not reopen it. The lesson player sends a locked lesson here this way |
| `/courses/$courseId/lessons/$lessonId` | `LessonPlayerPage` | Signed-in (student route group) | The kid-facing lesson player: video, reading (`text`), game and quiz lessons, with a server-driven active-time ring, a server-graded quiz and a completion sheet. Access is decided by the engine, not by role (see "The lesson player route" below): not enrolled, expired or an unenrolled admin sees the not-enrolled screen; a locked lesson is sent to the roadmap with `?open=`; a missing, unpublished or wrong-course lesson sees an unavailable screen. A completed lesson opens in replay mode (no timer, no XP) |
| `/login` | `LoginPage` | Public, but redirects signed-in admins | Accepts a `redirect` search param; see the login guard below |
| `/signup` | `SignupPage` | Public | On success: session present → `/`; no session (email confirmation required) → "check your email" copy |
| `/admin` | `DashboardPage` | Admin only | KPI cards, needs-attention list, recent-activity table |
| `/admin/users` | `UsersPage` | Admin only | List/search/filter/paginate users; create dialog; **Export** menu (Selected rows / Current filtered results / All users, with an Include trashed toggle) and **Import** dialog (CSV → the Edge Function's `bulk_create`); row click navigates to the detail route below |
| `/admin/users/$userId` | `UserDetailPage` | Admin only | Account (edit/change-email/reset-password/**move to trash** — same dialogs and Edge Function calls as the list; a trashed user's page shows a link to Trash instead of the button), Stats (`user_stats`, left-joined — no row yet is a normal empty state, not an error), Enrollments (manual enroll/revoke/**restore access**, direct RLS writes, plus **reset progress** through an admin-gated RPC), Progress (published-lesson completion per course), Badges, manual XP award. Replaces the standalone "Students" concept — see below |
| `/admin/courses` | `CoursesPage` | Admin only | Sortable/filterable list; row actions are status-contextual plus **Move to trash** (immediate, Undo toast); nothing here deletes — see `rules.md`. The row menu's first item, **View course**, opens `/courses/$courseId` in a new tab (every status) |
| `/admin/courses/new` | `CourseCreatePage` | Admin only | Always inserts as `draft`. Curriculum tab locked until saved |
| `/admin/courses/$courseId/edit` | `CourseEditPage` | Admin only | Course Builder: Basics + Curriculum tabs. Bad id or RLS-hidden row renders "Course not found", not a crash. A **View course** button in the page header opens `/courses/$courseId` in a new tab |
| `/admin/games` | `GamesPage` | Admin only | Sortable/filterable list, same table conventions as `/admin/courses`. Create/edit is a `GameDialog`, not a route — games are a flat record with no nested child content. Row action **Move to trash** (immediate, Undo toast). Permanent delete exists only on `/admin/trash`, where it is refused with "Used by N lessons" if any lesson — trashed ones included — still uses the game |
| `/admin/gamification` | `GamificationPage` | Admin only | Sidebar label "Badges & XP". Two stacked sections on one page (not tabs): **Badges** — a TanStack list plus a `BadgeDialog` for create/edit (a Dialog, not a route — flat record, same convention as Games), row actions Edit / Activate-Deactivate / **Move to trash** (immediate, Undo toast); permanent delete exists only on `/admin/trash`, where it is refused with "N student(s) already unlocked it" when `user_badges` references the badge. **Level Thresholds** (migration 012) — an editable list over `level_thresholds`: add the next level, edit `xp_required` (explicit Save per row), delete any level except 1 (level 1's field is disabled and it has no delete — UI-only protection, see `rules.md`). The client checks the strict-monotonic rule first as fast feedback; the DB trigger is what actually enforces it |
| `/admin/orders` | `OrdersPage` | Admin only | Takes `?view=active\|trash` (defaults `active`, see `?view=` note below). KPI cards (revenue, unresolved, failed) always exclude trashed rows regardless of which view is open + sortable/filterable payments list (status, reconciliation status). Detail/reconciliation is an `OrderDetailDialog`, not a route — a flat record with a 2-field edit, same convention as Games. "Add order" (`AddOrderDialog`) records a payment made outside the gateway plus its enrollment, via the `fn_create_manual_order` RPC (migration 007) — not two sequential inserts; amount/currency auto-fill from the selected course (falls back to 0 for a free course), staying editable after. "Export CSV" dumps the currently-filtered, currently-viewed (active or trash) list; "Import CSV" (`ImportOrdersDialog`) bulk-creates via the same `fn_create_manual_order` RPC, once per row, per-row atomic (one bad row doesn't roll back the rest) — a results summary reports per-row success/failure. Bulk row selection (the shared multi-select kit: checkbox column, header select-all scoped to the current page, and a "Select all N matching" option in the bar for the whole filtered set) drives a selection toolbar: Active offers Mark Resolved/Unresolved, Export selected, and Move to Trash; Trash offers Restore, Export selected, and Delete Permanently (migration 009) — each a single batched request, never one per row. Row-level equivalents live in a per-row dropdown menu once there's more than one possible action (View details/Move to Trash in Active; Restore/Delete Permanently in Trash). Permanent delete is real, RLS-gated to already-trashed rows only (`payments_admin_delete_from_trash`) — see `rules.md` |
| `/admin/settings` | `SettingsPage` | Admin only | Takes `?tab=commerce\|gamification\|identity` (defaults `commerce`, see `?tab=` note below). Commerce: Manual Order Providers + Currencies (both add/toggle/delete list editors, not TanStack Tables) + the Default currency picker (a searchable combobox, migration 011 — plain `Select` doesn't scale to ~180 seeded currencies). Gamification: quiz pass threshold, alone for now, matching the sidebar's own naming for this area. Site Identity: site name/URL, support email, terms/privacy URLs. Each tab saves its own slice of the `app_settings` singleton independently (or, for the currency picker, immediately on selection) — not one cross-tab form — still no settings framework, each tab is one purpose-built component |
| `/admin/trash` | `TrashPage` | Admin only | Takes `?tab=courses\|modules\|lessons\|games\|badges\|users` (defaults `courses`, see `?tab=` note below). The only screen that permanently deletes anything. Six tabs, each a full table (search, sort, pagination, multi-select) with Restore, Delete permanently and Empty trash — per item and in bulk. Restore is blocked (with a tooltip) while a parent is trashed; permanent delete is typed-`DELETE`, per-item, and a blocked item stays in Trash with a readable reason. Hangs off the `/admin` layout, so the same `requireAdmin` guard covers it. Sidebar entry under ADMINISTRATION with a total-count badge |

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

**`?tab=` on `/admin/trash`.** Takes `tab=courses|modules|lessons|games|badges|users` (defaults `courses`) — its own value set, the identical real-search-param convention. Switching tab remounts it, so search and selection start fresh. `Link`/`navigate` to `/admin/trash` must pass a `tab`, since it is required on the route's search type.

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

## Student routes

A pathless layout route (`id: 'student'`, no URL segment of its own) wraps
every kid-facing route the same way the `/admin` layout route wraps every
admin page: `beforeLoad` calls `requireStudentSession` (`lib/studentSession.ts`)
— no session redirects to `/login?redirect=<page>`, and a successful login
returns the student to it (the existing `resolvePostLoginPath` already honours
a same-origin `redirect`, so nothing there changed). **There is deliberately
no role check** — unlike `requireAdmin`, this guard only asks "is anyone signed
in." What a signed-in user may actually see is decided entirely by RLS
(`schema.md`'s policy matrix) and the lesson-engine functions: an unenrolled
student gets the friendly not-enrolled screen from `not_enrolled`, a trashed
user's still-valid token gets the same screen, an admin who isn't enrolled
gets it too (there is no admin preview through the engine — `state.md`). The
route's component is `KidLayout` (`ui.md`), so every child gets the sticky top
bar for free.

`/courses/$courseId` reads: `courses`/`modules`/`lessons` (one nested
`select`, filtered to `lessons.status = 'published'` client-side — see the
finding below), `lesson_effective_xp` (a second request in parallel; the view
can't be embedded in the first — no FK path from `lessons` to it, confirmed
live as `PGRST200`), and `fn_course_lesson_states` (the lock-state source of
truth). One content query plus one RPC call per page load, verified over the
real network log. **Admins get no special treatment on this page.** The admin panel's "View course" links here in a new tab; an admin who is **not enrolled** in that course sees the "not enrolled" screen — **by design for now** (no preview mode, no enrollment bypass; `state.md` lists a preview mode as a follow-up). The same URL shows the roadmap to an enrolled student. Opening it from an unenrolled admin session logs one expected `400` on `rpc/fn_course_lesson_states` (the engine's `not_enrolled` refusal) in that tab's console.

**Finding, not a route bug:** `lessons_select_enrolled_or_preview_or_admin`
has no `status = 'published'` check, so an enrolled student's direct table read
returns draft lessons too (confirmed live); the page filters `status` itself
since it must anyway to match the engine's sequence, so nothing leaks to the
screen, but a different reader of this table would see them. Recorded in
`state.md`; fixing the policy is a one-line, separately-scoped change.

**The lesson player route** (`/courses/$courseId/lessons/$lessonId`). Everything the
page shows is chosen from the server's answers, in this order:
1. `fn_course_lesson_states(courseId)` refused `not_enrolled` (no enrollment, an
   `expired` or `revoked` one, a trashed user, an admin who is not enrolled): the
   not-enrolled screen. `lesson_unavailable` (draft or trashed course): the
   unavailable screen.
2. The lesson is absent from the states (unpublished, trashed, or the id belongs to
   another course): the unavailable screen. Nothing is fetched for it.
3. The lesson's state is `locked`: `<Navigate>` to `/courses/$courseId?open=<lessonId>`
   (replace), which opens the friendly locked sheet. **The lesson row (title, body,
   video link, quiz questions) is not requested at all for a locked lesson**, although
   the `lessons` policy would allow the read.
4. Otherwise the lesson row (`lessons` filtered to `status = 'published'`, with the
   course's `gamification_enabled`), `lesson_effective_xp`, and for a game lesson the
   `games` row are read, and quiz questions come from `quiz_questions_public` only.

While a lesson is open the same rules apply live: a heartbeat, quiz submission or
completion refused with `locked`, `not_enrolled` or `lesson_unavailable` swaps the
page for the matching screen (or the locked redirect). A failed background refetch
of the states never tears down a lesson that is already on screen. Replay (state
`completed` at open) sends no heartbeats and grants no XP; the mode is latched when
the lesson opens, so completing it does not turn the play screen into a replay.
Verified with real JWTs against the RPCs and in a real browser (`changelog.md`); an
unenrolled, expired or admin session logs one expected `400` on `rpc/fn_course_lesson_states`.

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

## Database functions callable by admins (PostgREST RPC)

Migration 021, both behind `/admin/users/$userId`. `EXECUTE` is granted to
`authenticated` and the admin check runs **inside** each `SECURITY DEFINER`
body, so a non-admin reaching them directly is refused, not merely hidden from
the button. Verified by calling both with a non-admin JWT under
`set local role authenticated` (both raised `not_authorized`, and nothing was
deleted); `anon` has no `EXECUTE` at all.

| Function | Who may call | Refusal |
|---|---|---|
| `fn_admin_course_progress_summary(p_user_id, p_course_id)` | Admin | `not_authorized` |
| `fn_admin_reset_course_progress(p_user_id, p_course_id)` | Admin | `not_authorized` |

Restore access is deliberately NOT an RPC: it is a plain `enrollments` insert
through `enrollments_admin_insert`, the same direct-RLS path manual enroll
already uses (`rules.md` on why account actions need an Edge Function and
enrollment writes do not).

## Database functions callable by students (PostgREST RPC)

The lesson engine (migration 017; behaviour in `schema.md`). Each is
`SECURITY DEFINER`, derives the user from `auth.uid()` and is executable by
`authenticated` only — `anon` gets `42501`. A trashed user's still-valid token gets
`not_enrolled`. Client wrappers: `src/lib/lessonEngine.ts`; hooks:
`src/hooks/useLessonEngine.ts`, used by the roadmap and the lesson player (`useLessonClock`
in `src/hooks/` owns the heartbeat loop).

| Function | Who may call | Refusals (`hint`/`message`) |
|---|---|---|
| `fn_course_lesson_states(p_course_id)` | Signed-in, actively enrolled in the course | `not_enrolled`, `lesson_unavailable` (draft/trashed course) |
| `fn_lesson_heartbeat(p_lesson_id)` | Enrolled, lesson unlocked | `not_enrolled`, `lesson_unavailable`, `locked` |
| `fn_complete_lesson(p_lesson_id)` | Enrolled, lesson unlocked | the above plus `too_early`, `quiz_not_passed` |
| `fn_submit_quiz(p_lesson_id, p_answers)` | Enrolled, quiz lesson unlocked | `not_enrolled`, `lesson_unavailable` (also: not a quiz), `locked`, `invalid_answers` |

Admins are not special here: an admin who is not enrolled gets `not_enrolled`
(no admin preview through the engine). Nothing in the engine accepts a user id
from the client, and its internal helpers (`fn_is_enrolled`, `fn_lesson_states`,
`fn_lesson_unlocked_for`, `fn_engine_*`) and `fn_evaluate_badges` are not
executable by clients. Two caller-only helpers (`fn_caller_enrolled`,
`fn_caller_lesson_unlocked`) are executable by `authenticated` because views
call them; each reveals only the caller's own status. `quiz_questions_public` and
`lesson_effective_xp` are readable by `authenticated` (row rules in `schema.md`);
`profiles_public` likewise. `anon` can read none of the three views.

## Edge Function endpoints

### `POST /functions/v1/admin-user-management`

See `schema.md` for the full action contract. Access rule: **admin only,
enforced server-side** — the function resolves the caller from the JWT, looks
up `profiles.role` and `deleted_at` via the service-role client, and returns
`403 Forbidden` before parsing the body if the caller isn't an admin **or is a
trashed admin**. `verify_jwt: true` at the platform level is a floor, not the
authorization check itself (observed 2026-09-20 against `bulk_create`: a
request with no credentials at all, or a malformed bearer token, is rejected
`401` by the platform; a request carrying only the publishable `apikey`, the
anon key as the bearer, or a valid non-admin JWT reaches the function and gets
its `403`).

Actions: `create`, `bulk_create`, `update_email`, `update_password`, and — since
migration 013 — `trash`, `restore` and `delete`. Removing a user is two-step: `trash`
(flags the profile, bans the login, revokes sessions), then `delete` only for a
user already in the trash with no activity history. `trash` and `delete` both
refuse the calling admin, the primary admin and the last non-trashed admin
server-side, returning a machine-readable `code` (`self_target`,
`primary_admin`, `last_admin`; also `not_found`, `already_trashed`,
`not_trashed`, `has_history`). `trash` is called from the Users list and the user detail page, `restore` from the Undo toast and `/admin/trash`, and `delete` only from `/admin/trash`.

`bulk_create` (CSV import) takes 1–25 rows per call — an empty list or a 26th
row is refused `400` — creates students only, skips any email that already has
an account (active or trashed) and returns one result per row (`created` /
`skipped_exists` / `skipped_trashed` / `failed` with a reason code). Its response
can carry generated passwords, so it is sent `Cache-Control: no-store`. It is
called only from the Users import dialog.

Client wrapper: `src/lib/adminUserApi.ts`, invoked from
`src/hooks/admin/useUserMutations.ts` (and, for `bulk_create`,
`src/hooks/admin/useImportUsers.ts`).
