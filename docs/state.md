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
- **The kid-side lesson engine, database and client layer only — no screen
  uses it** (migrations 017–019, `schema.md`): server-side heartbeat-counted
  active time, linear unlock, quiz grading, completion and XP-once through four
  RPCs; students have no write path to progress, attempts or XP. Typed wrappers
  and TanStack Query hooks (`lib/lessonEngine.ts`, `hooks/useLessonEngine.ts`)
  exist and have been type-checked and built, **not run against the live API**
  (the SQL functions were exercised over the real REST API; see the changelog).
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

- **Student-facing app.** No student screens exist; `/` is a scaffold landing
  page.
- **Quiz reveal.** Grading exists (`fn_submit_quiz`, v1: per-question
  correct/incorrect only — no correct option, no explanation, by assumption).
  Whether and when a student may see the right answer or the explanation is
  undecided (`rules.md`). `app_settings.quiz_pass_threshold_percent` is stored
  and admin-editable but read by nothing — the pass mark is per lesson.
- **Other XP award paths.** Only `'lesson'` (automatic) and `'manual'` (admin)
  award XP; the `'quiz'`, `'game'` and `'streak'` `source_type`s have no
  writer.
- **Payment gateway webhook and pre-signup payment claiming.** No receiver and
  no Edge Function — see `integrations.md`.
- **Game loading/playing.** Nothing consumes a game's bundle metadata
  (`games.bundle_size_bytes`, `games.checksum`).
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
- **Anything that uses the lesson engine.** No kid-facing screen (lesson
  player, roadmap) calls it yet, and `games.orientation` (stored, editable) is
  read by nothing — a landscape game's "rotate your phone" prompt needs the game
  player.
- **A parental gate** for the kid-side app — deferred by decision.

## In flight

Nothing. The trash-first task is complete (soft delete and the Trash page,
multi-select on every list table, Users CSV export and import, the final sweep)
and so is the admin side of the lesson timer / pass mark / game orientation
settings, and the database and client layer of the kid-side lesson engine (no
screens). Nothing is mid-way.

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
and the course counters) were re-read and matched.

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
3. Kid-facing screens on top of the lesson engine (course roadmap, lesson
   player), starting from `lib/lessonEngine.ts` — beat every
   `HEARTBEAT_INTERVAL_MS` while a lesson is in the foreground.
4. Decide enrollment expiry (below) before any student is expected to lose access.

## Open decisions & on the horizon

Each of these needs a product call or a deliberate follow-on; none is being
worked on.

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
  because the spec said `= now()`.
- **Admins cannot preview a lesson through the engine.** Not enrolled → `not_enrolled`
  for everything; an admin preview mode would be a separate, deliberate addition.
- **Preview lessons are readable by any signed-in user, a trashed one included**
  (existing `lessons` policy); `quiz_questions_public` and `lesson_effective_xp`
  mirror it.
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
- **The lesson-engine client layer has not been run against the live API**, only
  type-checked, linted and built; its error mapping (`hint`/`message` → code, and
  "Failed to fetch" → `network`) is written from the REST responses observed, not
  exercised through supabase-js. The generated types mark every `RETURNS TABLE`
  column non-null, including `module_id` and `completed_at`, which can be null;
  `fetchCourseLessonStates` maps them to `string | null` by hand.
