# State

Living document — rewritten as reality changes, not appended to. Accurate as
of the last commit on `master`. No remote is configured; nothing has been
pushed anywhere. How each piece landed, and how it was verified, is in
`changelog.md`; this file says only what exists now and what is still open.

## Built

Everything in this section exists in code and, where it touches the database,
live.

**Admin app** (routes and access rules: `routes-permissions.md`; every sidebar
nav entry is a real route):
- Auth: `/login`, `/signup`, role-aware post-login routing, the `/admin` guard
  (role re-read from the database on every run), open-redirect protection.

**Student app** (routes and access rules: `routes-permissions.md`; visuals:
`ui.md`):
- `/courses/$courseId` — the course roadmap: modules and lessons as a
  learning path with lock state (from `fn_course_lesson_states`), a progress
  bar, a sticky Continue bar, a tap sheet per lesson (a friendlier one for
  locked lessons), kid-friendly whole-page states (loading, not-enrolled,
  unavailable, empty, network-retry). Visually polished on 2026-09-21: Baloo 2
  on student screens, flat module banners with progress dots, a winding SVG path
  generated from the node positions, a node hierarchy (see `ui.md`). **Not
  linked from anywhere** — no home/dashboard screen exists yet, so it's
  reachable only by URL.
- `/courses/$courseId/lessons/$lessonId`: the lesson player: video, reading,
  game and quiz lessons, a server-driven active-time ring, a server-graded quiz,
  once-only XP with a completion sheet, a replay mode and screens for locked,
  not-enrolled and unavailable lessons (`ui.md`, `routes-permissions.md`). Games
  are treated as time-based (no game protocol exists). Redesigned to a
  dedicated UI/UX spec on 2026-09-23 (typography scale, motion tokens,
  measured colour contrast, a per-question quiz review, a teal completion
  medallion with confetti, tap-to-play video/game, a dev-only state gallery
  at `/dev/lesson-player-gallery`; details and the deliberate spec deviations
  are in `ui.md`). Verified in Chromium against the live project; not yet on
  a device or in the Capacitor webview.
- A pathless student layout route (`KidLayout`) gates both on a signed-in
  session only — no role check; RLS and the engine decide what a signed-in
  user may see.
- Admin shell and Dashboard: sidebar/topbar (title read from
  `app_settings.site_name`), KPI cards, a needs-attention list, a recent-activity
  table.
- Users: the `/admin/users` list (client-side search/filter/sort/paginate,
  create dialog, multi-select with bulk Move to trash, a CSV Export menu and an
  Import dialog) and the
  `/admin/users/$userId` detail page (account actions incl. Move to trash,
  stats, enrollments with manual enroll/revoke, per-course progress, badges,
  manual XP award). There is no separate Students page.
- Courses: the `/admin/courses` list (archive and Move to trash, multi-select)
  and the Course Builder (`/admin/courses/new`, `/admin/courses/$courseId/edit`;
  Basics and Curriculum tabs) with topics, lessons and quiz questions,
  drag-and-drop reordering including cross-topic lesson moves, checkboxes and
  bulk Move to trash on topics and lessons, YouTube/Vimeo embed links, and
  per-lesson *minimum time* and (quiz) *pass mark* settings with a bulk "Set
  minimum time" (enforced server-side by the lesson engine; see Backend).
- Games: the `/admin/games` list (Move to trash, multi-select) plus
  `GameDialog`, including a stored *Orientation* setting.
- Orders and payments: `/admin/orders` — KPI cards, filters, Add order (a
  manual payment plus its enrollment, via `fn_create_manual_order`), CSV export
  and import, bulk selection (the shared kit), Active/Trash views, permanent
  delete of trashed rows (payments' own older Trash, unchanged).
- Settings: `/admin/settings` — Commerce (manual-order providers, currencies,
  default-currency picker), Gamification (quiz pass threshold), Site Identity.
- Gamification: `/admin/gamification` — badge CRUD (Move to trash,
  multi-select) and the editable level curve (`level_thresholds`).
- Trash: `/admin/trash` — six tabs (courses, modules, lessons, games, badges,
  users), each a full table with Restore, Delete permanently and Empty trash, per
  item and in bulk; restore blocked under a trashed parent; permanent delete
  typed-`DELETE` with a readable reason for anything that can't be deleted. The
  sidebar shows the total count. Every "delete" elsewhere is "Move to trash"
  with an Undo toast (users get one lightweight confirm), and every list table
  uses the shared multi-select kit.

**Backend:**
- **The kid-side lesson engine** (migrations 017–019, `schema.md`):
  server-side heartbeat-counted active time, linear unlock, quiz grading,
  completion and XP-once through four RPCs; students have no write path to
  progress, attempts or XP. Typed wrappers and TanStack Query hooks
  (`lib/lessonEngine.ts`, `hooks/useLessonEngine.ts`) are now exercised through
  the course roadmap, both directly (real JWTs against the REST API) and via
  the real UI (Chromium) — see the changelog.
- Schema through migration 019 (`schema.md`), RLS on every table, the
  XP → level/streak/badge trigger machinery, the lesson-completion XP award
  (`fn_award_lesson_xp`, skipped for courses with `gamification_enabled =
  false`), and an admin-editable level curve.
- Trash-first deletion (migrations 013 and 014, the Edge Function's `trash` /
  `restore` / `delete`, and the UI above): soft delete on courses, modules,
  lessons, games, badges and profiles, hidden through parents, RLS-enforced
  permanent delete, counters and XP/badge functions that skip trashed content,
  and every own-row policy gated so a trashed user's old token stops working.
  Verified with role-switched queries, against the deployed function and by
  driving the real UI (`changelog.md`).
- Edge Function `admin-user-management` — deployed, version 3, ACTIVE,
  `verify_jwt: true`, with `bulk_create` (CSV import), `trash`, `restore` and a
  stricter `delete`. `trash`, `restore`, `delete` and `bulk_create` have been
  exercised end to end; `update_email` and `update_password` have not, and
  `create` has not been called directly since it moved onto the shared
  `createAuthUser` helper that `bulk_create` runs (next step 1).

## Designed but not built

The schema or docs anticipate each of these; no working code exists for any.

- **A home/dashboard screen for students.** `/` is still a scaffold landing
  page and does not link to `/courses/$courseId` — the roadmap is reachable
  only by typing or being sent its URL.
- **A bottom tab bar** for the student app. `--kid-bottom-inset` (kid.css) is
  reserved for it so adding one later needs no re-layout, but it doesn't exist.
- **Native back-button handling and a Capacitor session audit** for the
  student app — noted as follow-ups, not started (see Next steps).
- **Quiz reveal.** Grading exists (`fn_submit_quiz`, v1: per-question
  correct/incorrect only — no correct option, no explanation, by assumption).
  The player shows right or wrong per question; each question's explanation
  appears after grading only once migration 020 is applied (proposed, awaiting
  approval, which also means amending the quiz-answers invariant in `rules.md`).
  The correct option is never shown. Whether to reveal it is undecided. `app_settings.quiz_pass_threshold_percent` is stored
  and admin-editable but read by nothing — the pass mark is per lesson.
- **Other XP award paths.** Only `'lesson'` (automatic) and `'manual'` (admin)
  award XP; the `'quiz'`, `'game'` and `'streak'` `source_type`s have no
  writer.
- **Payment gateway webhook and pre-signup payment claiming.** No receiver and
  no Edge Function — see `integrations.md`.
- **A game protocol.** The player loads a game's `bundle_url` in a sandboxed
  frame and completes it on the timer. Nothing reads `games.bundle_size_bytes`,
  `games.checksum` or `games.max_xp`, no message contract lets a game report a
  score, and both games in the live database have placeholder `example.com` bundle
  URLs, so no real game has been loaded. A game that needs storage or network
  identity will not work inside `sandbox="allow-scripts"`.
- **File uploads.** No Storage bucket exists (`storage.buckets` is empty), so
  `courses.thumbnail_url` and a lesson's `video_url` are paste-a-URL fields.
- **Native builds, hosting, CI.** Capacitor is installed but `npx cap add
  ios/android` hasn't been run; the frontend runs only on the local Vite dev
  server; no CI exists (`env-deploy.md`).
- **A Course Builder "Additional" tab** (prerequisites/FAQs/audience). The
  schema has no columns for it; deliberately not built.
- **Admin control over the locked design tokens** from `/admin/settings` — the
  next step toward a white-labelable platform, deliberately deferred; the token
  set in `ui.md` stays code-only until a task asks for it.
- **Rich-text editing** for a lesson's `content_html` (a raw HTML textarea
  today) — a separate dependency decision.
- **Analytics.** `analytics.md` deliberately doesn't exist until this starts.
- **Orientation locking.** `games.orientation` drives only a "turn your phone"
  hint in the player. Locking the screen needs a native plugin
  (`@capacitor/screen-orientation`), which is not installed.
- **A parental gate** for the kid-side app — deferred by decision.
- **Admin control over the locked design tokens** already covers `--surface`
  too (added this task, same status as the rest of the token set).

## In flight

The lesson player is built and committed. One piece waits on a decision:
migration 020 (`supabase/migrations/20260922000000_020_lesson_player_server.sql`,
untracked, NOT applied) needs approval before anything touches the database.
Everything else is complete: the trash-first work, the admin lesson settings, the
kid-side engine, the course roadmap and the lesson player.

## Live data reality

The database is no longer empty: it holds real content the user is actively
authoring. Row counts on 2026-09-19 — `profiles` 3 (1 admin, 2 students),
`courses` 2 (both published), `modules` 3, `lessons` 2, `enrollments` 3,
`payments` 2 (none trashed), `xp_transactions` 1, `user_stats` 1; config tables
`app_settings` 1, `manual_order_providers` 3, `currencies` 178,
`level_thresholds` 30; zero rows in `games`, `quiz_questions`, `quiz_attempts`,
`lesson_progress`, `badges` and `user_badges`; nothing is trashed and no auth
user is banned. Verification passes use
SQL-created throwaway accounts and separately-titled test rows — never the real
"Wisdom Hatch Kids" content — and remove them afterwards (account rule:
`rules.md`). On 2026-09-20 the profile, content, enrollment, payment, XP,
stats, game and badge counts were re-read after each Phase 4 fixture round and
matched the figures above; the config-table counts were not re-read. The two
real lessons (1 `text`, 1 `video`) carry the migration 015 defaults
(`min_time_seconds` 90, `pass_percentage` 60), re-read on 2026-09-20 after that
task's fixtures were removed. After the lesson-engine task's fixtures were
removed the counts above (including `lesson_progress` 0, `quiz_attempts` 0,
`quiz_questions` 0, `xp_transactions` 1, `user_stats` 1, `user_badges` 0, `badges` 0
and the course counters) were re-read and matched. The lesson player task did the
same on 2026-09-22 (profiles 3, courses 3, modules 7, lessons 17, enrollments 5,
`lesson_progress` 0, `quiz_attempts` 0, `quiz_questions` 14, `xp_transactions` 1,
`user_stats` 1, payments 2, games 2, badges 0, and the course counters
`demo-fun-with-numbers` 1 student / 15 lessons, `dsgf` 0 / 0, `wisdom-hatch-kids` 2 / 2).

## Blockers

None.

## Next steps, roughly in order

1. Smoke-test the `admin-user-management` actions not yet exercised end to end
   against the live deployment: `update_email`, `update_password` and a direct
   `create` (now on the shared helper). (`trash`, `restore` and `delete` were
   exercised on 2026-09-19, including the has-history refusal, and
   `bulk_create` on 2026-09-20.)
2. Add the DB-level guard against deleting the primary admin
   (`91392b37-91f1-4975-afda-e4c238c4d821`). The UI and the Edge Function both
   refuse it; a direct `service_role`/dashboard delete or an `auth.users`
   cascade still isn't stopped.
3. Decide migration 020 (below), then test the player on a real phone and in the
   Capacitor webview (`ui.md` lists what has not been exercised).
4. A student home/dashboard screen that links to `/courses/$courseId` — the
   roadmap currently has no entry point.
5. Decide enrollment expiry (below) before any student is expected to lose access.
6. A bottom tab bar, native back-button handling and a Capacitor session audit
   for the student app (`--kid-bottom-inset` is reserved but nothing uses it).

## Open decisions & on the horizon

Each of these needs a product call or a deliberate follow-on; none is being
worked on.

- **Migration 020 needs a yes or no (file written, not applied).** Section A makes
  `fn_submit_quiz` return each question's `explanation` inside a graded result (it
  reads `quiz_questions.explanation`, nothing else changes; it needs an amended
  invariant in `rules.md`, and the choice to send explanations for every question or
  only for wrong answers). Section B (optional) carries the heartbeat's sub-second
  remainder. Nothing else in the schema changes; no policy, grant or view is touched.
  The player already handles both states: with 020 unapplied a graded result simply has no explanation.
- **Dead time after a pause.** The server cannot be told the child left, so after
  a pause the client waits until 32 s after its last beat before sending the next (so
  the beat lands past the server's 30 s window and credits 0). Cost: up to about 32 s
  of visible time is not counted after each pause. Removing it needs a small migration
  (a `p_resumed` flag on `fn_lesson_heartbeat` that credits 0 and restarts the clock).
  In dev, React StrictMode sends the opening beat twice within a fraction of a second; harmless (the second credits 0).
- **The Capacitor App plugin is not installed** (`@capacitor/app`), so the player
  uses the Page Visibility API and online/offline events only. In a native webview
  backgrounding may not fire `visibilitychange` reliably; adding the plugin's
  `appStateChange` listener to `useLessonClock` is the fix, and needs a dependency approval.
- **Reading lessons are shown, not sanitised.** No HTML sanitiser is installed, so
  `content_html` is trusted only because it renders in a script-less sandboxed frame
  with a restrictive CSP (`rules.md`). An admin can still put a link or a big image
  in it. If lesson HTML ever comes from anyone but an admin, add a sanitiser.

- **The last-admin guard is unreachable in normal use.** The caller must be a
  non-trashed admin different from the target, so at least two non-trashed
  admins always exist; the guard only fires on a race between two admins
  trashing each other. It is implemented and defense-in-depth, but has not
  been exercised.
- **Security-advisor follow-up (partly done).** Last run 2026-09-20, just BEFORE
  019 (not re-run after): 13 `SECURITY DEFINER` functions executable by `anon`,
  19 by `authenticated`. Four are RLS helpers (`fn_user_is_trashed`,
  `fn_course_is_live`, `fn_lesson_is_live`, `fn_is_admin`) that must stay
  executable because policies run them as the caller. Eight are trigger or
  event-trigger functions that predate the trash work and were left alone
  (`fn_award_lesson_xp`, `fn_handle_new_user`, `fn_prevent_role_change`,
  `fn_process_xp_transaction`, `fn_update_course_lesson_count`,
  `fn_update_course_student_count`, `fn_update_lessons_completed`,
  `rls_auto_enable`); calling a trigger function through RPC is not expected to
  do anything useful, but that was not tried, so this is an advisor finding, not a
  demonstrated hole. `fn_evaluate_badges(uuid)`, which was the one
  directly callable exception, was closed by migration 019. The four engine
  functions and the two caller-only view helpers are listed as
  `authenticated`-executable by design. Also flagged: three functions with a
  mutable `search_path` (`fn_set_updated_at`, `fn_compute_level`,
  `fn_create_manual_order`) and leaked-password protection being off. The three
  `SECURITY DEFINER` views the advisor lists at ERROR level were audited on
  2026-09-20 and are **accepted, with a written rationale** in `schema.md`
  (Views): each needs owner privileges, none exposes a correct answer or
  explanation any more, and the write hole in `profiles_public` is closed
  (016). The advisor will keep listing them.
- **Enrollment expiry is not enforced anywhere.** `enrollments.status` can be
  `'expired'` but nothing sets it, and `expires_at` is read by no policy, function or
  trigger, so an enrollment past its `expires_at` still opens the course and the
  lesson engine (observed with a status-`active` enrollment three days past
  `expires_at`). Decide whether to enforce it in `fn_is_enrolled` (one place, the
  lessons policy would then need the same change) or set `'expired'` on a schedule.
- **Enrolled students can read draft lessons directly.** From the policy text
  (not exercised over REST): `lessons_select_enrolled_or_preview_or_admin` gates on
  `fn_lesson_is_live` (trashed or not) and enrollment, with no `status =
  'published'` check, so a draft lesson's row is readable by an enrolled student.
  The engine ignores drafts (they are not in the sequence and every function
  answers `lesson_unavailable`); the table read is the leftover. Adding the status
  check to the policy is a one-line change.
- **A heartbeat under-credits by up to a second per beat.** It credits whole
  seconds and stamps `last_heartbeat_at = now()`, dropping the fraction: 10 s
  beats were credited 10 for gaps of 10.43, 10.84 and 10.76 s. Twelve back-to-back
  beats over 3.00 s of server time credited 0 (the intent: hammering never
  inflates). Carrying the remainder (advancing `last_heartbeat_at` only by the
  credited seconds) would lose nothing and still never over-credit; not done
  because the spec said `= now()`. Migration 020, section B (proposed, optional)
  implements the carry.
- **Admin preview banner on the course page is not built, and cannot be as
  specified.** The redesign task asked for a slim "Admin preview. This is what
  enrolled students see." banner for an admin who is not enrolled, without
  changing what the not-enrolled state returns and without new queries or RPCs.
  Two things block it. (1) For an unenrolled admin the engine refuses
  (`not_enrolled`), so the page shows the not-enrolled screen and never has
  roadmap data; a banner claiming "this is what enrolled students see" would sit
  on a screen that shows nothing of the kind. (2) The student pages load no role
  or profile data, so knowing the viewer is an admin needs a new read (a
  `profiles` query or `fn_is_admin` call). A meaningful banner needs the preview
  mode below (the engine and the `courses`/`modules`/`lessons` policies admitting
  an admin without writing progress) and a role read. Until that is decided, an
  unenrolled admin keeps the existing not-enrolled screen.
- **Admins cannot preview a lesson through the engine.** Not enrolled → `not_enrolled`
  for everything; an admin preview mode would be a separate, deliberate addition.
- **Follow-up: admin preview mode (view a course without enrolling).** The admin
  panel now has a "View course" action (list menu and editor header) that opens
  `/courses/$courseId` in a new tab, but an admin who isn't enrolled sees the
  "not enrolled" screen there. A real preview needs a deliberate design: the
  engine functions and the `courses`/`modules`/`lessons` policies would have to
  admit an admin without creating progress or XP rows for them, and the page
  would need a visible "previewing" state. Nothing of that exists; it was
  explicitly out of scope for the button.
- **Preview lessons are readable by any signed-in user, a trashed one included**
  (existing `lessons` policy); `quiz_questions_public` and `lesson_effective_xp`
  mirror it.
- **An enrolled student in an ARCHIVED course sees the "isn't ready" screen,
  not the roadmap — an inconsistency between two rules, not a bug in either.**
  The lesson engine treats `archived` the same as `published` (mirroring the
  `lessons` policy), but `courses_select_published_or_admin` only shows
  `status = 'published'` rows to a non-admin, so `CoursePage`'s course-content
  query returns no course row and the page can't tell "archived" apart from
  "doesn't exist" — it shows `UnavailableScreen`. Observed live with a fixture
  archived course. Fixing it means either loosening the courses policy to admit
  `archived`, or having the page ask the engine (which already allows it)
  instead of the courses table for this one fact.
- **The course-content query can't embed `lesson_effective_xp`.** No FK path
  exists from `lessons` to that view (confirmed live, `PGRST200`), so
  `useCourseRoadmap` fetches it as a second, unfiltered request in parallel
  with the course query — RLS already limits the rows to what the caller may
  see. Giving the view a `course_id` column (denormalised from `lessons`) would
  let it be embedded and filtered instead of read whole; not done, since the
  view's current row-gating logic would need to move or duplicate.
- **Do the three real profiles' display names look right?** `profiles_public` was
  writable by `anon` from migration 003 until 016. No write was observed in the
  data, but nothing recorded one either; worth a glance at the three names.
- **Payments' Trash view still says "permanently" / "can't be undone" outside
  `/admin/trash`.** `/admin/orders` keeps its own older Active/Trash split with
  a "Delete Permanently" action (migration 009, built before trash-first). The
  rule for the six trash-first entities is that only `/admin/trash` deletes;
  payments are outside that set and were left untouched, but they contradict a
  strict reading of it. Options: leave, or add a Payments tab to `/admin/trash`.
- **Config-list rows still have a "Delete" action** — currencies, manual-order
  providers, level thresholds and quiz questions hard-delete from their own
  screens with their own confirm. They are not trash-first entities (no
  `deleted_at`), so they were not converted; say so if they should be.
- **Two password minimums.** The project enforces 8 characters; Supabase Auth's
  own configured minimum is 6 (observed 2026-09-20 — `schema.md`). An account
  created through the app is held to 8; whether a direct Auth or dashboard call
  could create a 6–7-character one is inferred, not tested. Raising Auth's
  minimum to 8 in the dashboard would make the two agree.
- **The Orders CSV export/import still uses the original helpers** — no UTF-8
  BOM, no formula-injection guard, comma-only parsing — while the Users CSV uses
  the generic ones in `lib/csv.ts`. Orders were left alone because payments were
  out of scope for the Users CSV work; moving them over is a small follow-up if
  wanted.
- **A lost `bulk_create` reply can lose a generated password.** There is no
  idempotency key: if the reply to a chunk is lost after the server created its
  accounts, the retry finds them and reports them as skipped, and their
  generated passwords are gone. The import summary lists such rows under "Needs
  attention" and the recovery is Reset password. Observed by dropping a reply in
  a test (3 accounts existed, the retry reported 3 skipped, no password was
  recoverable).
- **Should `text` lessons default to a minimum time?** The spec named video,
  game and quiz. `text` lessons pre-fill 90 s (and the column default gives every
  existing lesson 90), the same as video and game. Say if reading time should
  default to Off instead.
- **What `courses.gamification_enabled = false` should mean.** It gates lesson
  XP only. `fn_update_lessons_completed` — the `lessons_completed` counter bump
  and the badge evaluation it runs — ignores it, so a gamification-off course
  still increments `user_stats.lessons_completed` and can unlock
  `lessons_completed`/`course_complete` badges (verified live). See `rules.md`.
  The dashboard's attention-item copy already says exactly this.
- **Should a manual XP award move the streak?** `fn_process_xp_transaction`
  treats every `xp_transactions` insert alike, so an admin award always sets
  `last_activity_date` to today and advances or resets `current_streak`
  (verified live). An admin correction for XP earned on a past day silently
  inflates a streak; fixing it means deciding whether `source_type = 'manual'`
  skips the streak update.
- **Should an expired learner still count in `courses.total_students`?**
  `trg_enrollments_student_count` decrements on any move away from `'active'`,
  including to `'expired'` — which contradicts the trigger code's own inline
  comment.
- **`user_stats.lessons_completed` isn't deduped on re-completion.** It bumps
  on every transition into `'completed'` (reset and complete again, or delete
  and re-insert the `lesson_progress` row — verified live, 4→6), so it can
  over-count toward `lessons_completed` badges. XP is unaffected
  (`uq_xp_transactions_dedupe`). Fixing it needs a trigger change.
- **Editing `level_thresholds` doesn't recompute stored levels.**
  `user_stats.level` is denormalised and updates only on a student's next XP
  event; migration 012's backfill was one-time. The admin UI says so. Add
  recompute-on-save or a "recalculate levels" action if it ever matters.
- **`app_settings.default_currency` is settable but consumed by nothing.**
  `CourseForm.tsx`'s create-mode default is still the hardcoded string
  `'INR'`; wiring it up is a small, separate change.
- **`courses.currency` and `payments.currency` aren't FKs to `currencies`** —
  plain text by explicit design (`rules.md`). Constraining them touches
  `CourseForm.tsx` and `fn_create_manual_order`, and needs a decision on what
  happens to a row carrying a currency code that is later deleted or
  deactivated.
- **Migration filenames don't match the live versions for 006–012.** Renaming
  the files to the versions `list_migrations` reports is a migrations-folder
  change that hasn't been made; detail in `schema.md`.

## Known shortcuts / tech debt

- **Dashboard revenue is summed client-side.** PostgREST aggregate functions
  aren't guaranteed enabled on this project, and adding a view/RPC needs a
  migration. Fine at current volume; revisit if `payments` grows.
- **Revenue is filtered to INR.** Summing mixed currencies is meaningless. If a
  second currency ever appears this needs a per-currency breakdown, not a
  wider filter.
- **Nav uses one `to as never` cast** (`AdminLayout`'s `NavLink`) — still
  load-bearing, not a leftover; rationale in `ui.md`.
- **A lesson's `game_id` falls back to pasting a raw UUID** while the `games`
  table is empty, which it is today; the picker becomes a dropdown as soon as
  any game exists.
- **Video embeds only recognize YouTube/Vimeo share links.** Any other link is
  a validation error, not a silent save.
- **The admin shell is desktop-only** — no mobile responsiveness, deliberately.
- **No automated tests and no CI.** No test runner or test files exist;
  verification so far has been manual and live against the real project. The
  Phase 4 checks — real-browser Playwright scripts, direct calls to the deployed
  function and Node scripts over the CSV/import logic — were throwaway scripts
  kept outside the repo, so they cannot be re-run from it.
- **`courses.total_lessons` counts draft and published lessons**, not
  published-only.
- **Level-curve edge behaviors, all intentional:** above the highest level (30
  as seeded) a student stays at it until an admin adds more (the old formula was
  unbounded — it would have reached level 31 at 16,432 XP); deleting a middle
  level leaves a numbering gap (levels are not renumbered); level 1's "exists,
  stays 0" rule is UI-only, not in the database (`rules.md`).
- **CSV order import is one RPC round-trip per row, client-side, sequential.**
  `importManualOrders` (`usePayments.ts`) calls `fn_create_manual_order` once
  per row in a loop rather than any server-side bulk path — fine at this scale
  (a handful to low hundreds of rows), and it is what lets a single bad row fail
  without a special-case rollback for the rest. Importing thousands of rows at
  once would need a real server-side bulk endpoint; not built, since that scale
  problem doesn't exist yet.
- **Import size limits are unmeasured.** The preview renders every row (up to
  1000) without virtualisation, and each file read scans every profile email (in
  pages of 1000) to spot existing accounts. The largest import run through the UI
  was 60 rows; a 1000-row parse was checked in Node only.
- **Not exercised in Phase 4:** opening an exported file in desktop Excel (the
  BOM, CRLF and quoting were checked at the byte level, not in Excel);
  keyboard-only use of the export menu and the import dialog; mobile widths; a
  full 1000-row import through the UI; the 60-second request timeout against a
  real (not injected) stall; PostgREST's 1000-row cap (no table here is that
  large).
- **`games.bundle_size_bytes`/`checksum` are accepted but never verified.** The
  admin form takes them as optional plain inputs (defaulting to `0`/`''` when
  blank) because nothing downstream reads them — there is no game-loading
  surface. Once one exists and starts trusting either value, it must not assume
  every row's value is real; `0`/`''` reads as "not provided," not as a
  verified fact.
- **Capacitor session handling is unaudited** in a webview; no native
  platforms exist.
- **LAN-testing (insecure-context) audit, 2026-09-21.** Over `http://<LAN-IP>`
  the page is not a secure context. Audit of `src/` and the built bundle: the
  only secure-context-only call was `crypto.randomUUID` in
  `QuizQuestionsEditor.tsx` (now `uuid()`, fixed). No use anywhere of
  `navigator.clipboard`, `crypto.subtle`, `mediaDevices`, `share`,
  `Notification`, `serviceWorker` or `wakeLock`. `crypto.getRandomValues`
  (the admin password generator) and `URL.createObjectURL` (CSV downloads)
  work everywhere. Dependencies: supabase-js uses `crypto.subtle` only for
  OAuth/PKCE (feature-detected, falls back) and `getClaims` signature
  checks — this app calls neither. **Known LAN-testing limitations that
  remain:** none in current code. Any *future* feature that needs a
  secure-context API (camera, clipboard-copy without a fallback, push,
  service workers/PWA install) cannot be exercised over `http://<LAN-IP>`.
  Not exercised over the LAN: a real phone, the Capacitor webview, iOS Safari.
- **The lesson-engine client layer is now exercised** (heartbeat, complete,
  states) through the course roadmap over the real REST API and the real UI;
  `fn_submit_quiz` is still only exercised directly (no screen calls it — the
  lesson player doesn't exist). The generated types mark every `RETURNS TABLE`
  column non-null, including `module_id` and `completed_at`, which can be null;
  `fetchCourseLessonStates` maps them to `string | null` by hand.
- **The roadmap's network-failure and reduced-motion checks used Playwright's
  request interception and `reducedMotion` emulation, not a real device or a
  real dropped connection.** A real device, the Capacitor webview, real
  safe-area insets and the native back button were not exercised for this
  screen either — same open item as the rest of the mobile app.
- **A real screen reader was not used.** Accessibility checks were
  programmatic: `role`/`aria-label` text, computed focus, and contrast ratios
  computed from rendered colors — not a VoiceOver/NVDA/TalkBack pass.
- **A completed course's engine state and `courses.total_lessons` mean
  different things — expected, not a bug.** The roadmap's denominator is
  `fn_course_lesson_states`' row count (live, published lessons only);
  `courses.total_lessons` counts draft + published live lessons (`known
  shortcuts`, below). Observed live: a course with 1 draft lesson mixed into 9
  published ones showed "0 of 9 lessons" while `total_lessons` read 10. Anything
  that shows course-wide lesson counts to a student must use the states
  function, never the counter.
