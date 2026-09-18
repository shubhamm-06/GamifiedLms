# State

Living document — rewritten as reality changes, not appended to. Accurate as
of the last commit on `master`. No remote is configured; nothing has been
pushed anywhere.

## Current WIP

Curriculum reordering is real drag-and-drop (2026-09-09/10):
`@dnd-kit/core`/`sortable`/`utilities`, mouse and keyboard both verified, a
single batch `upsert` per drop rather than one request per row. The earlier
up/down-button version is gone, not kept as a fallback. **The first pass of
this (2026-09-09) worked but was visibly janky** — dragged item overlapping
content above the list, a sibling appearing to vanish for ~1s, both from the
same missing pieces: no `<DragOverlay>` and no optimistic cache update on
drop. Fixed 2026-09-10; see `ui.md`'s drag-and-drop entry and `rules.md` for
what to copy next time. **A follow-up same day (2026-09-10) removed all
reorder animation entirely** (zero-transition snap, by deliberate product
choice, not a bug) — see `rules.md`'s new invariant; this is settled, not an
open question to revisit. **2026-09-12 added cross-topic lesson dragging**:
a lesson can be moved between topics and into/out of Ungrouped, landing at
the exact drop position. That required topics and lessons to share a single
`DndContext` (unavoidable, not preference — see `ui.md`), and confirmed that
`lessons.position` is per-topic rather than per-course (`rules.md`). Module
reordering itself is unchanged. Same 09-10 session: the lesson create/edit editor
moved from a slide-over Sheet (`LessonSheet.tsx`, now deleted) to a centered
Dialog (`LessonDialog.tsx`), matching the Dialog convention already used by
Admin Users — see `ui.md`'s updated nested-editing entry. Same 09-09 session:
video lessons can be pasted as a YouTube/Vimeo share link and normalized to
an embeddable URL (`src/lib/video.ts`), or a direct file/stream URL as before
— never raw `<iframe>`/HTML.

**2026-09-12, also: `/admin/users` became a TanStack Table v9 list** — the
last plain `<table>` in admin. Search (name + email, via
`globalFilteringFeature`), the role filter, sorting on Name/Email/Role/Joined
and pagination with page-size controls are now all client-side over one
fetched list; the server-side PostgREST search/filter/range it used before is
gone, along with the filter-expression sanitiser that only existed to protect
it. All three admin list tables now share one shape.

**2026-09-12, separately: `/admin/games` landed** — full create/edit/delete
via `GameDialog.tsx` (a Dialog, not a route — games are a flat record, same
convention as Admin Users) plus a `GameTable.tsx` list matching `CourseTable`
conventions. Migration 006 (additive) added `games.description` and
`games.thumbnail_url`, both nullable. `bundle_size_bytes`/`checksum` stay
`NOT NULL` at the column level but are optional in the form — a blank input
writes `0`/`''` rather than blocking submit, since nothing reads or verifies
either yet. Delete is a real delete (no archive column, unlike courses) and
is refused with a friendly "used by N lesson(s)" message when a lesson still
references the game, rather than a raw FK error. The lesson editor's game
picker (`useGames` in `useCurriculum.ts`) was moved to `useGames.ts` as the
single canonical query, shared by both the picker and the new list page —
it was duplicated across two files before this.

**2026-09-12, also: `/admin/users/$userId` landed**, and the standalone
"Students" nav entry was dropped (not repointed — see `routes-permissions.md`
for why). Account/Stats/Enrollments/Progress/Badges on one routed page,
following Course Builder's "content-dense row earns a route, not a dialog"
precedent (`ui.md`). Manual enroll and manual XP award write straight through
existing admin RLS policies (migration 004) — no Edge Function, unlike
account actions; see `rules.md`. `expires_at` is computed at insert time from
the picked course's `access_type`/`access_duration_days`, per the
already-documented calling convention in `schema.md`. Progress denominators
are published-lesson counts, computed fresh from `lessons`/`lesson_progress`,
not `courses.total_lessons` (which counts drafts too). The account dialogs
(Edit/Change email/Reset password/Delete) are the exact same components as
the list page's, adapted to a richer query's shape rather than
re-implemented — the primary-admin delete guard is therefore one
implementation, not two that could drift. **Confirmed live, and worth
knowing:** a manual XP award updates `user_stats.last_activity_date` and
`current_streak` exactly as if the student had a real activity event today —
`fn_process_xp_transaction` doesn't branch on `source_type`. Not fixed here
(out of scope — this task's ask was to report it, not patch trigger logic);
see Known shortcuts below.

**2026-09-17: `/admin/orders` landed.** KPI cards (revenue, unresolved,
failed) plus a filterable payments list (status, reconciliation status) and
an `OrderDetailDialog` for the only edit this table permits — toggling
`reconciliation_status` and setting `reconciliation_note`. Confirmed live
against `fn_guard_payment_admin_update`: the actual PATCH request contains
only those two keys, nothing else, and every other column round-trips
untouched. At the time this page shipped there was no create or delete
action anywhere on it — see the 2026-09-18 entry below for why that's now
only half true. The Dashboard's `useRevenue` moved to `usePayments.ts`
unchanged, so both pages' revenue KPI call the identical hook — confirmed
both show the same number (₹3,000) against the same seeded rows.
`DashboardPage.tsx`'s only change is that one import's source file; nothing
about its rendering moved. Unclaimed payments (`user_id` null — a payment
can arrive before its buyer signs up) show the raw email plus an outline
"Unclaimed" badge, not an error state.

**2026-09-18: manual order creation landed on the same page.** "Add order"
(`AddOrderDialog.tsx`) records a payment made outside the gateway (bank
transfer, cash, a comp) and the enrollment it backs, in one call to a new
RPC, `fn_create_manual_order` (migration 007) — deliberately a plain
function, not `SECURITY DEFINER`, so its two inserts are gated by the
calling admin's own RLS rather than "can call this function". Delete is
still not a thing for this table; create now is, but only through this one
function — see `rules.md`'s corrected invariant (the 2026-09-17 entry
above's "no create path" claim is what changed).

The `expires_at` computation could not be shared with the existing
client-side manual-enroll path (`useEnrollUser` in `useUserDetail.ts`) —
one runs in the browser, the other inside Postgres, and there's no third
place either could call into without adding a hop neither operation needs.
It's re-implemented in SQL using the identical rule (`'fixed'` + a non-null
duration → `now() + N days`, else lifetime), and recorded in `rules.md` as
a "keep both in sync by hand" invariant rather than left to be rediscovered
as drift later. The course-picker exclusion logic (published only, not
already enrolled in any status) *was* shareable — extracted from
`EnrollCourseDialog.tsx` into `filterEnrollableCourses` in
`useUserDetail.ts`, now used by both.

The part of this task that actually needed proving rather than trusting the
transaction wrapper: pre-creating a conflicting enrollment directly (not
via the RPC), then calling the function for that same user+course,
confirmed it raises the specific friendly message (not a raw constraint
violation) and leaves **no orphaned payment row** — the payment insert that
ran moments earlier is rolled back too, since the re-raised exception is
never caught by anything further inside the function and so aborts the
whole call. Verified live via a direct SQL call to the function, not
through the UI, since the UI's own course picker never offers an
already-enrolled course in the first place.

One real bug found and fixed along the way, unrelated to the RPC itself:
`useUserEnrollments` had no `enabled` guard, so `AddOrderDialog` briefly
queried `enrollments?user_id=eq.` (empty string) before a student was
picked — Postgres correctly rejected it (`22P02`), but worse, the course
picker could show a still-enrolled course as eligible for a moment after
picking a student, before that user's enrollments had actually loaded
(`isPending` alone doesn't cover switching from one already-cached student
to another — `isFetching` does). Both are fixed: the query is disabled
until a real id is passed, and the course `<Select>` stays disabled with a
"Loading…" placeholder until the enrollments fetch has genuinely settled.

Encountered but deliberately not touched: one pre-existing `enrollments`
row (the real student, the real "Wisdom Hatch Kids" course, `source =
'manual'`) predates this task and wasn't created by anything in this
session — left alone rather than assumed safe to delete.

**2026-09-18, same day: Add Order refinements — auto-fill, `/admin/settings`,
CSV export/import.** Three pieces landed together:
- **Amount/currency auto-fill.** Picking a course in `AddOrderDialog` fills
  `amount`/`currency` from `courses.price_amount`/`courses.currency`
  (`handleCourseChange`, mirroring `CourseForm.tsx`'s title→slug pattern
  rather than a `useEffect`), falling back to `0` for a free/unpriced course.
  Stays editable afterward — goodwill comps and partial amounts are a named
  use case. This required relaxing amount validation from "> 0" to "≥ 0",
  since `0` is now a legitimate auto-filled, submittable value.
- **`/admin/settings` landed**, migration 008's `manual_order_providers`
  table (admin-only RLS, seeded `bank_transfer`/`cash`/`comp`) behind it. One
  section, `ManualOrderProvidersSection.tsx` — add a label, toggle
  active/inactive via a plain `<ul>` + `<Switch>`, deliberately not a
  TanStack Table (see `ui.md`). Deactivate only, no delete — the table has no
  delete RLS policy at all. `payments.provider` stays free text, NOT a FK to
  this table — see `rules.md`'s new invariant. Add Order's Provider field
  changed from a free-text `Input` to a `Select` sourced from this table's
  active rows only.
- **CSV export/import on `/admin/orders`.** Export dumps whatever the
  page's current status/reconciliation filters show (`filterPaymentsForExport`
  in `usePayments.ts`, a small deliberate duplicate of `OrderTable`'s filter
  predicate rather than a refactor into its TanStack internals). Import
  (`ImportOrdersDialog.tsx`) calls `fn_create_manual_order` once per row —
  the same RPC and code path Add Order uses (`callCreateManualOrder`,
  extracted out of `useCreateManualOrder`'s `mutationFn` so both call sites
  share it) — sequentially and per-row atomically: one bad row (unknown
  email, unknown course slug, duplicate enrollment) is caught individually
  and reported in a results summary, not rolled back with the rest. A
  downloadable template CSV ships with the dialog. Confirmed live: the
  no-orphaned-payment guarantee holds in this bulk path too, not just
  Add Order's single-row path — pre-seeded a real conflicting enrollment,
  confirmed the payment count for that exact pair was identical before and
  after a partially-failing import.

Verified live end-to-end for all three: course-selection auto-fill including
the free-course-to-0 case; adding/deactivating a provider correctly changes
what Add Order's dropdown offers; export matches an applied filter, both
unfiltered and filtered; import correctly bulk-creates a valid row and
distinctly reports all three failure kinds (bad email, bad slug, duplicate
enrollment) with the no-orphaned-payment guarantee intact. The `payments`
table was completely empty at the time migration 008 was written, so no
seeded provider label (`bank_transfer`/`cash`/`comp`) could have collided
with any existing free-text `provider` value — confirmed by direct query,
not assumed.

**2026-09-18, same day: Trash / permanent delete for `/admin/orders`.**
Migration 009 adds `payments.deleted_at` (nullable, no default) — the only
soft-delete column anywhere in this schema, deliberately scoped to payments
alone (see `rules.md`'s new invariant for why this isn't a precedent).
`fn_guard_payment_admin_update`'s live source was re-read via
`pg_get_functiondef` before editing it, not assumed from the earlier
migration's file — it turned out to be a blocklist of forbidden columns,
not an allowlist as the task described it, so `deleted_at` was already
implicitly permitted the moment the column existed; the `CREATE OR REPLACE`
only updates the error message text to stay accurate. The actual
enforcement that a payment can't be hard-deleted while still active is
`payments_admin_delete_from_trash` (RLS, `USING (fn_is_admin() AND
deleted_at IS NOT NULL)`) — confirmed live via a direct authenticated REST
call (not just observing the button's absence) that a bare `DELETE` against
an active row silently affects zero rows.

`/admin/orders` gained a `?view=active|trash` toggle (`Tabs`, same
`?tab=`-as-search-param convention as Course Builder). Active excludes
trashed rows and its own row/bulk "Move to Trash" action opens a
reversible-but-still-confirmed dialog; Trash shows only trashed rows plus a
"Trashed on" column, with Restore (no confirmation — the safe direction)
and Delete Permanently (a real DELETE, strongly worded, distinct copy from
Move to Trash's) as its row/bulk actions. All KPI cards (revenue,
unresolved, failed) now filter out trashed rows regardless of which view is
open, since trashing is supposed to remove something from the real numbers,
not just hide it from one list. Trashing/restoring never touches
`enrollments.payment_id` — confirmed live that a payment backed by a real
enrollment keeps that enrollment completely untouched through a trash cycle
(the actual payment record's `deleted_at` is the only thing that changes).
Permanent delete on a still-linked payment (enrollments.payment_id is
`NO ACTION`) is mapped to a specific message ("This payment is linked to an
active enrollment; remove that enrollment first") rather than a raw
Postgres `23503`, the same established pattern as the lesson-delete FK
case. The row-actions column changed from a single "View details" icon
button to a `DropdownMenu` now that there's more than one possible
per-row action, following this file's own already-stated threshold for
when that switch is warranted.

One subtlety worth remembering for the next bulk-toolbar feature:
selection is independent state that doesn't clean itself up when a row
disappears from view. `removeFromSelection(ids)` in `OrdersPage.tsx`
deletes exactly the acted-upon ids from the selection map — not a blanket
clear — since the same handler backs both a bulk action (`ids` is the
whole selection) and a single row's dropdown action (`ids` is just that
one row, possibly not even selected); a blanket clear would wipe an
unrelated in-progress selection in the second case. Switching between
Active and Trash also clears the whole selection, since the two views are
disjoint row sets and a selection made in one means nothing in the other.

Verified live end-to-end: trashing removes a row from Active and from every
KPI total without touching its enrollment; restoring brings it back
correctly (both the row and the KPI numbers); a direct REST `DELETE`
against an active row is refused at the RLS level, not just hidden by the
UI; permanent delete on a still-linked payment fails with the friendly
message and the row survives; permanent delete on a genuinely orphaned
trashed payment succeeds and the row is actually gone; both bulk Move to
Trash and bulk Delete Permanently fire exactly one network request each for
a two-row selection, not two.

**2026-09-19: Platform Settings.** Migration 010 adds `app_settings`, a
deliberate singleton table — one seeded row, no INSERT or DELETE policy for
any client role at all, which is the actual mechanism (not a UI convention)
that keeps it a singleton; verified live that even an admin's direct
`INSERT` against the REST API is refused with a `42501` RLS violation.
SELECT is public (`using (true)`, readable by `anon`), UPDATE is admin-only.
Closes two confirmed gaps: `default_currency` (referenced by
`courses.currency`/`payments.currency` defaults, but nothing previously let
an admin set what "the platform default" actually is) and
`quiz_pass_threshold_percent` (needed before quiz grading exists, stored
nowhere before this — still not consumed by anything, this task only makes
it settable and storable).

`/admin/settings` split into `?tab=providers|platform` (`Tabs`, same
search-param convention as Course Builder and `/admin/orders`'s `?view=`) —
Providers is the pre-existing Manual Order Providers section, unchanged;
Platform is one form over the `app_settings` row, grouped into Commerce /
Gamification / Site Identity `Section`s, saving the whole row on submit
rather than per-field. `AdminLayout`'s sidebar header now reads
`app_settings.site_name` instead of a hardcoded string — confirmed live
that an admin's save is reflected in the sidebar immediately (no reload)
and survives a hard reload (a genuine read, not a client-only optimistic
value). **This `?tab=providers|platform` shape was short-lived — see the
2026-09-19 Currency management entry below, which replaced it with three
tabs the same day.**

**2026-09-19, later the same day: Provider delete, currency management,
Settings tab restructure.** Three pieces:
- **Delete on Manual Order Providers.** The live RLS policy
  (`manual_order_providers_admin_delete`) already granted admin `DELETE` —
  re-verified directly against `pg_policy` rather than assumed, which
  turned up that `schema.md` had been wrong the whole time claiming "no
  delete policy exists" (corrected there, not left standing). Delete is a
  true hard delete, confirmed safe by `payments.provider` having no FK to
  this table; Deactivate and Delete both stay available in the UI, each
  behind its own confirm `AlertDialog`.
- **Migration 011: `currencies`.** Same admin-only RLS shape as
  `manual_order_providers`. Seeded with the full ISO 4217 active-codes
  list — 178 rows, sourced from Wikipedia's ISO 4217 article wikitext (not
  hand-typed; cross-checked against Node's own `Intl.supportedValuesOf
  ('currency')`, which returned only 162 — CLDR's currency data is a
  curated subset of the official ISO list, so the wikitext source was used
  as authoritative, including the precious-metal/special codes CLDR
  omits). `app_settings.default_currency` is now a FK to `currencies(code)`
  (`NO ACTION`) — confirmed live that this correctly refuses deleting
  whichever currency is currently the platform default, with a friendly
  message instead of a raw `23503`.
- **`/admin/settings` restructured again, same day: `?tab=commerce|
  gamification|identity`, replacing the brand-new `providers|platform`
  pair from earlier today.** Commerce holds Providers + Currencies + the
  default-currency picker; Gamification holds just the quiz threshold;
  Site Identity holds the site/contact/legal fields. Splitting one
  `app_settings` row across three tabs meant `useUpdateAppSettings`'s input
  became a `Partial` so each tab (or, for the currency picker, each
  selection) saves only the fields it owns. The default-currency picker
  became a searchable `Popover`+`Command` combobox (first use of that
  pattern in this codebase) — a plain `Select` doesn't work at ~180
  options; confirmed live that typing actually filters the list (178 → 1
  for an exact-name search) rather than just being visually scrollable.

**Deliberate follow-on, flagged rather than built here (twice now):**
`CourseForm.tsx`'s create-mode default (`currency: 'INR'`, hardcoded) should
read `app_settings.default_currency` instead, so a platform-level currency
change actually affects new courses. **Additionally, and also explicitly
deferred:** `courses.currency`/`payments.currency` stay plain text, not FK'd
to the new `currencies` table — wiring that up touches `CourseForm.tsx` and
`fn_create_manual_order`'s existing write paths and needs its own pass
(including deciding what happens to a course/payment already carrying a
currency code that later gets deleted or deactivated), not a side effect of
adding the currencies list itself.

**Deferred, explicitly out of scope for this task:** design-tokens theming
(letting an admin adjust the locked color set in `ui.md` from
`/admin/settings`) is the next piece this Settings page would need for a
genuinely white-labelable platform, but nothing here builds toward it —
`ui.md`'s token set stays locked and code-only until a task actually asks
for that.

**2026-09-19, later still: Gamification — level thresholds, badges CRUD,
lesson XP award.** Migration 012 plus `/admin/gamification` (the last nav
target that 404'd by design).
- **Level thresholds.** `level_thresholds` replaces the hardcoded curve in
  `fn_compute_level`. Seeded 1–30 by running the OLD formula's own math
  (inlined in the migration) — verified identical to the old function for
  every XP value 0–16,431 (zero mismatches), and the one real student (600
  XP) stayed at level 4 through the backfill, so nothing needed to change for
  them. `schema.md` had the curve off by one (`100·N^1.5`; it's `100·(N−1)^1.5`).
  `fn_compute_level` went `IMMUTABLE` → `STABLE`. A DB trigger enforces strict
  monotonicity — verified by refusing bad writes directly (below, equal to,
  and above a neighbor) and through a direct admin REST call, not just via the
  UI, which also checks first for fast feedback. Level 1's "exists, stays 0" is
  UI-only by design (see `rules.md`).
- **Lesson XP award.** New `fn_award_lesson_xp` + `trg_lesson_progress_award_xp`,
  independent of the existing counter-bump trigger. Verified via direct SQL
  `lesson_progress` writes on both the INSERT-as-completed and
  UPDATE-transition paths: awards `lessons.xp_reward` when set; falls back to
  `courses.default_lesson_xp` only when NULL; an explicit 0 creates no
  transaction at all; nothing in a `gamification_enabled = false` course;
  re-completing the same lesson (UPDATE or delete + re-insert) doesn't
  double-award. **The task's literal `ON CONFLICT (user_id, source_type,
  source_id) DO NOTHING` does not work** against the partial dedupe index
  (`42P10`, verified) — the migration adds the matching `WHERE source_id IS
  NOT NULL` predicate.
- **Also found while verifying** (both pre-existing, both untouched, both
  recorded under Known shortcuts): the `lessons_completed` counter and its
  badges are not gated on `gamification_enabled` (the gap the task asked to
  flag — confirmed live), and the counter isn't deduped on re-completion.
  `schema.md`'s trigger table also claimed `trg_lesson_progress_completed`
  fired on `UPDATE` only; `pg_get_triggerdef` says `INSERT OR UPDATE` —
  corrected.
- **Badges CRUD.** List + `BadgeDialog` (a Dialog, not a route — same
  convention as Games), condition-value label/hint follow the selected type,
  Deactivate as the non-destructive alternative to Delete. Delete-while-unlocked
  is refused with "N student(s) already unlocked this" — verified against a
  `user_badges` row produced by the real `fn_evaluate_badges` path (a manual XP
  award crossing the badge's threshold), then again succeeding once that row
  was gone.
- **Copy fixed as a direct consequence:** the dashboard attention item for
  `gamification_enabled = false` courses said "XP still accrues" — false as of
  this migration. Reworded to "lesson XP is skipped, but lesson counts and
  badges still accrue" (`useDashboard.ts`). Not in the task's scope list, but
  leaving an untrue statement in the admin UI that this change made untrue
  wasn't reasonable.

Course Builder itself landed 2026-09-09 (the tabbed create/edit shell and
the Curriculum tab's create/edit/delete for topics, lessons, and quiz
questions) — a prior pass of this file mistyped that date as 2026-09-29;
see `changelog.md` for the correction. Deliberately not built there: a
Tutor-style "Additional" tab (prerequisites/FAQs/audience have no columns
in this schema).

All of the above verified end-to-end against the live database each time,
using a throwaway SQL-created admin and a separately-titled test course —
never the real "Wisdom Hatch Kids" course/content the user is actively
authoring, which this project's data now includes. Test data and accounts
removed after each verification pass.

Earlier the same phase: `/admin/courses` list with lifecycle actions, the
admin shell (sidebar/topbar, dashboard), and role-aware post-login routing.
Every sidebar nav target is a real route now — `/admin/gamification` (Badges
& XP) was the last one to land, see the 2026-09-19 Gamification entry above.

## Live data reality

The production database is effectively empty and **the empty state is what
you see when you run the app**: 2 profiles (1 admin `Shubham Admin`, 1 student
`Test`) and **zero rows** in `courses`, `modules`, `lessons`, `games`,
`enrollments`, `payments`, `quiz_questions`, `quiz_attempts`,
`xp_transactions`, `user_stats`, `badges`, `user_badges`.

`user_stats` has no row for the existing student — rows are only created once
XP is first earned. Any join to it must be a left join that tolerates null.

## Blockers

None.

## Next steps, roughly in order

1. Smoke-test all four `admin-user-management` Edge Function actions against
   the live deployment (create, change email, reset password, delete). Still
   never done end-to-end — it was blocked when written, and the deployment
   was discovered after the fact.
2. Add the DB-level guard against deleting the primary admin
   (`91392b37-91f1-4975-afda-e4c238c4d821`). UI and Edge Function both refuse
   it; a direct `service_role`/dashboard delete or `auth.users` cascade still
   isn't stopped.
3. Quiz authoring/grading is the next real gamification gap — nothing
   reads `app_settings.quiz_pass_threshold_percent` yet, and `xp_transactions`
   `source_type` `'quiz'`/`'game'` have no award path (only `'lesson'` does now).

## Known shortcuts / tech debt

- **Dashboard revenue is summed client-side.** PostgREST aggregate functions
  aren't guaranteed enabled on this project, and adding a view/RPC needs a
  migration. Fine at current volume; revisit if `payments` grows.
- **Revenue is filtered to INR.** Summing mixed currencies is meaningless.
  If a second currency ever appears this needs a per-currency breakdown, not
  a wider filter.
- **`app_settings.default_currency` (migration 010) is settable in
  `/admin/settings` but not consumed anywhere yet.** `CourseForm.tsx`'s
  create-mode default is still the hardcoded string `'INR'`. Flagged as a
  follow-on when Platform Settings landed, deliberately not built as a side
  effect of adding the settings table — wiring it up is a small, separate
  change to `CourseForm.tsx`'s initial values.
- **`courses.currency`/`payments.currency` are NOT foreign keys to
  `currencies` (migration 011) — plain text, by explicit design, not an
  oversight.** Only `app_settings.default_currency` got the FK. Wiring the
  other two up touches `CourseForm.tsx` and `fn_create_manual_order`'s
  existing write paths and is real additional scope beyond "manage a
  currency list" — flagged as a follow-on, not built here. See `rules.md`
  for why this needs its own pass rather than a quick constraint add.
- **Nav uses one `to as never` cast** (`AdminLayout`'s `NavLink`). Every
  nav target is a real route now, but the cast is still load-bearing:
  `/admin/orders` and `/admin/settings` declare a required search param, which
  a typed `Link` would force every nav entry to pass. Not a leftover to remove.
- **No Storage bucket exists** (`storage.buckets` is empty), so
  `courses.thumbnail_url` and a lesson's `video_url` are both paste-a-URL
  fields. No upload flow is wired; building one means creating a bucket and
  its policies first.
- **Lesson `content_html` is a raw HTML textarea** — a rich-text editor is a
  separate dependency decision.
- **`game_id` falls back to pasting a raw UUID** when the `games` table is
  empty — the picker switches to a real dropdown as soon as any game exists,
  which now happens via `/admin/games` rather than never.
- **Video embed only recognizes YouTube/Vimeo share links.** No other
  provider is detected; an unrecognized link is a validation error, not a
  silent save.
- **Admin shell is desktop-only** — no mobile responsiveness, deliberately.
- **No `AdminLayout` tests** and no CI at all.
- **First-admin "can never be deleted"** — enforced at UI + Edge Function
  layers only (next step #2).
- **`total_students`** decrements on any transition away from `'active'`,
  including `'expired'` — matches the trigger code, contradicts that code's
  own inline comment. Open product question: should an expired learner still
  count as a student?
- **`total_lessons`** counts draft + published, not published-only.
- **A manual XP award (`/admin/users/$userId`) moves the streak as if it
  were a real activity day.** `fn_process_xp_transaction` treats every
  `xp_transactions` insert identically regardless of `source_type` — it
  always updates `last_activity_date` to today and advances/resets
  `current_streak` accordingly. Confirmed live: awarding XP to a student
  with no activity today still set `last_activity_date` to today and
  `current_streak` to 1. An admin correction for XP a student earned on a
  *past* day (or a bare adjustment unrelated to any activity) will silently
  inflate their streak. Not fixed — flagged for review, since fixing it
  means deciding whether `source_type = 'manual'` should skip the streak
  update entirely, which is a product call, not an obvious bug fix.
- **Quiz pass threshold is now stored (`app_settings.quiz_pass_threshold_percent`,
  migration 010) but still consumed by nothing** — quiz grading itself
  still doesn't exist. The schema-decision gap is closed; the grading logic
  that would read this value is a separate, later task.
- **`courses.gamification_enabled` is enforced for lesson XP ONLY** (since
  migration 012). `fn_update_lessons_completed` — the `lessons_completed`
  counter bump and the badge evaluation it runs — is NOT gated on it, and never
  was, so a gamification-off course still increments
  `user_stats.lessons_completed` and can still unlock
  `lessons_completed`/`course_complete` badges; it just never awards XP.
  Verified live (counter 3→4 in a gamification-off course), deliberately not
  fixed — that's a product call about what "off" means for badges. The
  dashboard's attention item wording was updated to say exactly this (it
  previously said "XP still accrues", which stopped being true).
- **`user_stats.lessons_completed` is not deduped on re-completion.** Found
  while testing the XP trigger: the counter bumps on every transition into
  `'completed'`, so resetting a lesson and completing it again (or a
  delete + re-insert of the `lesson_progress` row) increments it again
  (verified live, 4→6), even though the XP award correctly does not repeat.
  Pre-existing behavior of `fn_update_lessons_completed`, not touched here —
  it can over-count toward `lessons_completed` badges. XP is unaffected
  (deduped by `uq_xp_transactions_dedupe`).
- **Editing `level_thresholds` does not recompute stored levels.**
  `user_stats.level` is denormalised and only recomputed on a student's next
  XP event; migration 012's backfill was one-time. The admin UI says so.
  Add a recompute-on-save (or a "recalculate levels" action) if that ever
  matters.
- **Level curve edge behaviors, all intentional:** above the highest level
  (30 as seeded) a student stays at it until an admin adds more (the old
  formula was unbounded — it would have reached level 31 at 16,432 XP);
  deleting a middle level leaves a numbering gap (the list skips it — level
  numbers are not renumbered); level 1's "exists, stays 0" rule is UI-only,
  not in the DB (see `rules.md`).
- **Capacitor session handling** unaudited in a webview; no native platforms.
- **No Edge Function** yet for quiz grading, game XP clamping, the payment
  webhook receiver, or pre-signup payment claiming.
- *(Cleared 2026-09-12)* `CourseTable`/`GameTable` shared `UserTable`'s
  unstable-`state` pagination bug; all three now memoise it, verified live
  against 15 courses and 14 games. Kept as a line here only because the
  failure mode is easy to reintroduce — see `ui.md`.
- **CSV order import is one RPC round-trip per row, client-side, sequential.**
  `importManualOrders` (`usePayments.ts`) calls `fn_create_manual_order` once
  per row in a loop rather than any server-side bulk path — fine at the scale
  this project is at (a handful to low hundreds of rows), since it's what
  lets a single bad row fail without a special-case rollback for the rest.
  Would need a real server-side bulk endpoint if anyone ever imports
  thousands of rows at once; not built now, since that scale problem doesn't
  exist yet.
- **`games.bundle_size_bytes`/`checksum` are accepted but never verified.**
  The admin form takes them as optional plain inputs (defaulting to `0`/`''`
  if left blank) because nothing downstream reads them yet — there is no
  game-loading/playing surface. Once one exists and starts trusting either
  value (e.g. verifying a downloaded bundle's integrity, or a Capacitor
  caching decision keyed on size), it must not assume every row's value is
  real; `0`/`''` reads as "not provided," not as a verified fact.
