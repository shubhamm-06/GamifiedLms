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
- Courses: the `/admin/courses` list (archive only in the UI today) and the
  Course Builder (`/admin/courses/new`, `/admin/courses/$courseId/edit`; Basics
  and Curriculum tabs) with topics, lessons and quiz questions, drag-and-drop
  reordering including cross-topic lesson moves, and YouTube/Vimeo embed links.
- Games: the `/admin/games` list plus `GameDialog` (its Delete action is
  currently a no-op — see In flight).
- Orders and payments: `/admin/orders` — KPI cards, filters, Add order (a
  manual payment plus its enrollment, via `fn_create_manual_order`), CSV export
  and import, bulk selection, Active/Trash views, permanent delete of trashed
  rows.
- Settings: `/admin/settings` — Commerce (manual-order providers, currencies,
  default-currency picker), Gamification (quiz pass threshold), Site Identity.
- Gamification: `/admin/gamification` — badge CRUD and the editable level curve
  (`level_thresholds`).

**Backend:**
- Schema through migration 013 (`schema.md`), RLS on every table, the
  XP → level/streak/badge trigger machinery, the lesson-completion XP award
  (`fn_award_lesson_xp`, skipped for courses with `gamification_enabled =
  false`), and an admin-editable level curve.
- Trash-first deletion, database and Edge Function layer (migration 013): soft
  delete on courses, modules, lessons, games, badges and profiles, hidden
  through parents, RLS-enforced permanent delete, counters and XP/badge
  functions that skip trashed content, and the module / course-blocker /
  restore-blocker RPCs. Verified with role-switched queries and against the
  deployed function (`changelog.md`). No UI uses any of it yet.
- Edge Function `admin-user-management` — deployed, version 2, ACTIVE,
  `verify_jwt: true`, with `trash` and `restore` and a stricter `delete`.
  `trash`, `restore` and `delete` have been exercised end to end; `create`,
  `update_email` and `update_password` have not (next step 1).

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
- **The trash-first UI** — `/admin/trash` (per-entity tabs, restore, permanent
  delete with a typed-`DELETE` confirm, empty trash), "Move to trash" with an
  Undo toast on every list, a shared multi-select and bulk-action bar on every
  admin table (only `/admin/orders` has selection today), and a Users CSV
  export/import (with a `bulk_create` Edge Function action). Phases 3–5 of the
  trash-first task.

## In flight

**Trash-first deletion, Phase 2 of 5 done (database + Edge Function); the UI
phases are outstanding.** Until Phase 3 replaces them, these admin actions
still issue a plain `DELETE`, which migration 013's RLS only allows on a
trashed row:
- **Delete topic, Delete lesson (Course Builder), Delete game, Delete badge:**
  the `DELETE` matches zero rows and returns no error, so the UI shows its
  success toast while **nothing is removed**. (`useCurriculum.ts`,
  `useGames.ts`, `useBadges.ts` check only `error`.)
- **Delete user (list and detail):** the Edge Function now refuses a user who
  isn't trashed (`not_trashed`), so the dialog shows an error instead of
  deleting; there is no UI yet to trash a user.
Quiz-question delete, provider/currency delete and payment trash/delete are
unaffected. Courses were never deletable from the UI.

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
`rules.md`).

## Blockers

None.

## Next steps, roughly in order

1. Smoke-test the three `admin-user-management` actions that still haven't been
   exercised end to end against the live deployment: `create`, `update_email`
   and `update_password`. (`trash`, `restore` and `delete` were exercised on
   2026-09-19, including the has-history refusal.)
2. Add the DB-level guard against deleting the primary admin
   (`91392b37-91f1-4975-afda-e4c238c4d821`). The UI and the Edge Function both
   refuse it; a direct `service_role`/dashboard delete or an `auth.users`
   cascade still isn't stopped.
3. Trash-first deletion Phase 3 (shared multi-select and bulk-action bar, the
   Trash page, Undo toasts, and replacing the broken Delete actions listed
   under In flight), then Phase 4 (Users CSV export/import), then Phase 5 (full
   verification and docs).
4. Quiz grading is the next real gamification gap (see Designed but not built).

## Open decisions & on the horizon

Each of these needs a product call or a deliberate follow-on; none is being
worked on.

- **A trashed user's still-valid access token keeps working on self-only
  tables.** Trashing bans the login, revokes sessions and cuts off the user's
  `profiles` row, admin powers, and all content visibility — but the access
  token already issued stays valid until it expires (default one hour, not
  verified for this project), and policies that are only "own rows"
  (`enrollments`, `lesson_progress`, `payments`, `xp_transactions`,
  `quiz_attempts` selects; `lesson_progress` insert/update) are not gated on
  trashed status. Observed 2026-09-19: an old token could still read its own
  enrollments and update its own `lesson_progress` row. Closing it means adding
  `not fn_user_is_trashed(auth.uid())` to those policies; not done, since it
  goes beyond the approved migration 013.
- **The last-admin guard is unreachable in normal use.** The caller must be a
  non-trashed admin different from the target, so at least two non-trashed
  admins always exist; the guard only fires on a race between two admins
  trashing each other. It is implemented and defense-in-depth, but has not
  been exercised.
- **The Supabase security advisor now flags five more `SECURITY DEFINER`
  functions as executable by `anon`/`authenticated`** — the three RLS helpers
  (`fn_user_is_trashed`, `fn_course_is_live`, `fn_lesson_is_live`, which must
  stay executable because policies run them as the caller) and the two new
  trigger functions (`fn_module_trash_lesson_count`,
  `fn_profile_trash_student_count`, which could have `EXECUTE` revoked). Ten
  older functions are flagged the same way.
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
