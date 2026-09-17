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
Remaining nav items — Badges & XP, Settings — still point at routes that
don't exist and 404 inside the shell by design.

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
3. The remaining nav destinations — Badges & XP, Settings, in no particular
   order.

## Known shortcuts / tech debt

- **Dashboard revenue is summed client-side.** PostgREST aggregate functions
  aren't guaranteed enabled on this project, and adding a view/RPC needs a
  migration. Fine at current volume; revisit if `payments` grows.
- **Revenue is filtered to INR.** Summing mixed currencies is meaningless.
  If a second currency ever appears this needs a per-currency breakdown, not
  a wider filter.
- **Nav uses one `to as never` cast** (`AdminLayout`'s `NavLink`) because
  most nav targets aren't in the typed route tree yet. Remove as real routes
  land.
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
- **Quiz pass threshold isn't stored anywhere** — needs a schema decision
  before quiz authoring/grading is built.
- **`courses.gamification_enabled` is unenforced everywhere** — no trigger,
  no Edge Function, no UI check. The dashboard's attention list surfaces this
  gap and its copy must keep saying so rather than implying the flag does
  something.
- **Level formula** (`fn_compute_level`) is a per-level XP threshold
  (`100 * N^1.5`); cumulative-sum alternative still open.
- **Capacitor session handling** unaudited in a webview; no native platforms.
- **No Edge Function** yet for quiz grading, game XP clamping, the payment
  webhook receiver, or pre-signup payment claiming.
- *(Cleared 2026-09-12)* `CourseTable`/`GameTable` shared `UserTable`'s
  unstable-`state` pagination bug; all three now memoise it, verified live
  against 15 courses and 14 games. Kept as a line here only because the
  failure mode is easy to reintroduce — see `ui.md`.
- **`games.bundle_size_bytes`/`checksum` are accepted but never verified.**
  The admin form takes them as optional plain inputs (defaulting to `0`/`''`
  if left blank) because nothing downstream reads them yet — there is no
  game-loading/playing surface. Once one exists and starts trusting either
  value (e.g. verifying a downloaded bundle's integrity, or a Capacitor
  caching decision keyed on size), it must not assume every row's value is
  real; `0`/`''` reads as "not provided," not as a verified fact.
