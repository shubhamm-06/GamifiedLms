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
  create dialog) and the `/admin/users/$userId` detail page (account actions,
  stats, enrollments with manual enroll/revoke, per-course progress, badges,
  manual XP award). There is no separate Students page.
- Courses: the `/admin/courses` list (archive only — courses are never
  hard-deleted) and the Course Builder (`/admin/courses/new`,
  `/admin/courses/$courseId/edit`; Basics and Curriculum tabs) with topics,
  lessons and quiz questions, drag-and-drop reordering including cross-topic
  lesson moves, and YouTube/Vimeo embed links.
- Games: the `/admin/games` list plus `GameDialog`; delete is real and refused
  with a "used by N lesson(s)" message while a lesson still references the game.
- Orders and payments: `/admin/orders` — KPI cards, filters, Add order (a
  manual payment plus its enrollment, via `fn_create_manual_order`), CSV export
  and import, bulk selection, Active/Trash views, permanent delete of trashed
  rows.
- Settings: `/admin/settings` — Commerce (manual-order providers, currencies,
  default-currency picker), Gamification (quiz pass threshold), Site Identity.
- Gamification: `/admin/gamification` — badge CRUD and the editable level curve
  (`level_thresholds`).

**Backend:**
- Schema through migration 012 (`schema.md`), RLS on every table, the
  XP → level/streak/badge trigger machinery, the lesson-completion XP award
  (`fn_award_lesson_xp`, skipped for courses with `gamification_enabled =
  false`), and an admin-editable level curve.
- Edge Function `admin-user-management` — deployed, version 1, ACTIVE,
  `verify_jwt: true`. Its source matches the documented action contract; its
  four actions have never been exercised end-to-end (next step 1).

## Designed but not built

The schema or docs anticipate each of these; no working code exists for any.

- **Student-facing app.** No student screens exist; `/` is a scaffold landing
  page.
- **Quiz grading.** `quiz_questions_public` strips the answer key and
  `quiz_attempts` is `service_role`-insert only, but no grading Edge Function
  exists, so nothing writes attempts. `app_settings.quiz_pass_threshold_percent`
  is stored and admin-editable but read by nothing.
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

## In flight

Nothing is half-built. The working tree carries only the documentation sync
recorded in `changelog.md`.

## Live data reality

The database is no longer empty: it holds real content the user is actively
authoring. Row counts on 2026-09-19 — `profiles` 3 (1 admin, 2 students),
`courses` 2 (both published), `modules` 3, `lessons` 2, `enrollments` 3,
`payments` 2 (none trashed), `xp_transactions` 1, `user_stats` 1; config tables
`app_settings` 1, `manual_order_providers` 3, `currencies` 178,
`level_thresholds` 30; zero rows in `games`, `quiz_questions`, `quiz_attempts`,
`lesson_progress`, `badges` and `user_badges`. Verification passes use
SQL-created throwaway accounts and separately-titled test rows — never the real
"Wisdom Hatch Kids" content — and remove them afterwards (account rule:
`rules.md`).

## Blockers

None.

## Next steps, roughly in order

1. Smoke-test all four `admin-user-management` actions (create, change email,
   reset password, delete) against the live deployment. Never done end-to-end —
   it was blocked when written, and the deployment was discovered after the
   fact. From the FK graph, `delete` should fail for any user who has child rows
   (`schema.md`); that is inferred, not observed.
2. Add the DB-level guard against deleting the primary admin
   (`91392b37-91f1-4975-afda-e4c238c4d821`). The UI and the Edge Function both
   refuse it; a direct `service_role`/dashboard delete or an `auth.users`
   cascade still isn't stopped.
3. Quiz grading is the next real gamification gap (see Designed but not built).

## Open decisions & on the horizon

Each of these needs a product call or a deliberate follow-on; none is being
worked on.

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
  verification so far has been manual and live against the real project.
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
- **`games.bundle_size_bytes`/`checksum` are accepted but never verified.** The
  admin form takes them as optional plain inputs (defaulting to `0`/`''` when
  blank) because nothing downstream reads them — there is no game-loading
  surface. Once one exists and starts trusting either value, it must not assume
  every row's value is real; `0`/`''` reads as "not provided," not as a
  verified fact.
- **Capacitor session handling is unaudited** in a webview; no native
  platforms exist.
