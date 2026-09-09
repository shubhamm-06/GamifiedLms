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
open question to revisit. Same 09-10 session: the lesson create/edit editor
moved from a slide-over Sheet (`LessonSheet.tsx`, now deleted) to a centered
Dialog (`LessonDialog.tsx`), matching the Dialog convention already used by
Admin Users — see `ui.md`'s updated nested-editing entry. Same 09-09 session:
video lessons can be pasted as a YouTube/Vimeo share link and normalized to
an embeddable URL (`src/lib/video.ts`), or a direct file/stream URL as before
— never raw `<iframe>`/HTML.

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
Remaining nav items — Games, Badges & XP, Students, Orders & Payments,
Settings — still point at routes that don't exist and 404 inside the shell
by design.

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
3. The remaining nav destinations — Games first, since `content_type = 'game'`
   lessons currently fall back to pasting a raw game UUID (the `games` table
   is empty and has no admin UI).
4. Then Badges & XP, Students, Orders & Payments, Settings.

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
- **`game_id` falls back to pasting a raw UUID** while the `games` table is
  empty and has no admin UI. The picker switches to a real dropdown as soon
  as any game exists.
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
