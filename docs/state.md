# State

Living document — rewritten as reality changes, not appended to. Accurate as
of the last commit on `master`. No remote is configured; nothing has been
pushed anywhere.

## Current WIP

Courses admin landed (2026-09-09): `/admin/courses` list (sort, search,
status filter, client-side pagination), plus dedicated `/admin/courses/new`
and `/admin/courses/$courseId/edit` routes sharing one form component.
Lifecycle is Publish / Archive / Restore — there is no delete affordance
anywhere, by design. Verified end-to-end against the live database (created,
edited, published, archived, restored, and confirmed a slug clash surfaces
inline); test data removed afterwards.

The admin shell (sidebar/topbar layout, dashboard, role-aware post-login
routing) landed earlier the same day. Remaining nav items — Games,
Badges & XP, Students, Orders & Payments, Settings — still point at routes
that don't exist and 404 inside the shell by design.

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
3. Course **detail** route (`/admin/courses/$courseId`) for modules, lessons
   and quiz questions — must support full inline **create/edit**, not just
   viewing. Not scaffolded at all yet, deliberately.
4. Then the remaining nav destinations (Games, Badges & XP, Students,
   Orders & Payments, Settings).

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
  `courses.thumbnail_url` is a paste-a-URL field. No upload flow is wired;
  building one means creating a bucket and its policies first.
- **Admin shell is desktop-only** — no mobile responsiveness, deliberately.
- **No `AdminLayout` tests** and no CI at all.
- **First-admin "can never be deleted"** — enforced at UI + Edge Function
  layers only (next step #2).
- **`total_students`** decrements on any transition away from `'active'`,
  including `'expired'` — matches the trigger code, contradicts that code's
  own inline comment. Open product question: should an expired learner still
  count as a student?
- **`total_lessons`** counts draft + published, not published-only.
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
