# Business Logic

How XP, enrollment, payments, and grading actually work, as implemented in
`supabase/migrations/002_functions_and_triggers.sql`, `003_rls_policies.sql`, and
`004_admin_scoped_writes.sql`. If this disagrees with the migrations, the migrations
are correct — update this file.

## XP and leveling

- Every XP-earning event is one row inserted into `xp_transactions` (append-only,
  never updated or deleted; corrections are a negative-amount row). The client never
  writes `user_stats` directly — there is no client-facing write policy on it at all.
- `trg_xp_transactions_process` → `fn_process_xp_transaction()` runs `AFTER INSERT`
  on `xp_transactions` and, in one transaction:
  1. Upserts `user_stats.total_xp` (`+= amount`).
  2. Recomputes `level` via `fn_compute_level(total_xp)` — **implemented as a
     per-level threshold**: level `N` unlocks at `100 * N^1.5` total XP. Whether this
     should instead be a *cumulative* sum of per-level thresholds is open — see
     `decisions.md`.
  3. Updates the streak: same-day activity leaves `current_streak` unchanged,
     activity exactly one day after `last_activity_date` increments it, anything
     else (including the very first transaction) resets it to 1. `longest_streak`
     tracks the max ever seen.
  4. Calls `fn_evaluate_badges(user_id)`.
- Duplicate-safety: `uq_xp_transactions_dedupe` is a unique index on
  `(user_id, source_type, source_id) WHERE source_id IS NOT NULL`. A webhook retry,
  a double-tapped button, or a game posting its completion message twice all just
  hit a constraint violation instead of double-awarding — the insert should be done
  with `ON CONFLICT DO NOTHING` (or equivalent) by whatever calls it.
- `lesson_progress` reaching `status = 'completed'` also increments
  `user_stats.lessons_completed` (`trg_lesson_progress_completed`) and re-runs badge
  evaluation, independently of any XP transaction for the same event.

## Badges

- `fn_evaluate_badges(user_id)` loops every `is_active` badge and checks
  `condition_type` against the user's current `user_stats` row (`total_xp`,
  `current_streak`, `lessons_completed`) or, for `course_complete`, computes whether
  the user has completed every published lesson in at least `condition_value`
  enrolled-and-active courses.
- Newly-qualifying badges are inserted into `user_badges`
  (`ON CONFLICT (user_id, badge_id) DO NOTHING`), so re-running evaluation is always
  safe — badges are never revoked by this function.

## Enrollment

- Access is a row in `enrollments`, not a flag on `profiles`. `status` is
  `'active'` / `'expired'` / `'revoked'`; `source` is `'purchase'` / `'manual'` /
  `'free'`.
- `expires_at` must be computed **at insert time** from
  `courses.access_duration_days` — never read live from the course, so a later
  change to a course's duration doesn't retroactively change existing learners'
  terms. (This is a calling-convention rule, not something the schema enforces —
  whatever inserts the row is responsible for it.)
- `courses.total_students` is trigger-maintained
  (`fn_update_course_student_count`) off `enrollments.status` transitions to/from
  `'active'`. **Open:** expiry (`active → expired`) does not currently decrement the
  count — see `decisions.md`.
- Writes: as of migration 004 ("Option B"), an admin can insert/update/delete
  `enrollments` directly through RLS (`enrollments_admin_*` policies) — there is no
  requirement to route manual enrollment changes through an Edge Function. Non-admin
  writes still require `service_role` (the purchase/webhook path).

## Payments

- `payments` is the idempotency boundary for the whole purchase flow: a unique
  constraint on `provider_payment_id` means a webhook retry (or the gateway
  double-delivering the same event) is a no-op, not a duplicate purchase.
- **Pre-signup flow:** if a payment arrives before the buyer has an account,
  `user_id` is left null and the row is matched later by `email`. When that person
  signs up, unclaimed `paid` payments with a matching email should be looked up and
  turned into `enrollments` at that point. (Not automated yet — no Edge Function
  exists to do this; see "Known gaps" below.)
- **Scoped admin reconciliation, not open writes:** migration 004 gives admins an
  update path on `payments`, but `fn_guard_payment_admin_update()` blocks changes to
  every column except `reconciliation_status` / `reconciliation_note` unless the
  write comes from `service_role`. An admin can annotate a payment ("looked into
  this, it's fine" / refund note) but can never rewrite `amount`, `status`, or any
  other gateway-reported field. See `decisions.md`.

## Grading

- `quiz_questions.correct_option` must never reach a student. The base table is
  admin-only for `SELECT` (`quiz_questions_admin_select`); students read through
  `quiz_questions_public`, a view that strips `correct_option` and gates rows to
  admins, `is_preview` lessons, or users with an active enrollment in the lesson's
  course.
- `quiz_attempts` insert is restricted to `service_role` — the intent is that
  grading happens server-side (an Edge Function checks submitted answers against
  `quiz_questions.correct_option` and inserts the scored result), never client-side.
- Same pattern for games: `games.max_xp` is meant to cap what a single play can
  award, clamped server-side when the XP transaction is inserted.

## Known gaps (implemented in the DB, not yet wired up anywhere)

- **No Edge Functions are deployed.** Quiz grading, game XP clamping, the
  payment-webhook receiver, and the pre-signup payment-claiming flow are all
  designed for server-side enforcement in the schema/RLS, but none of that server
  code exists yet. Right now nothing can actually insert a `quiz_attempt`,
  `xp_transactions` row for `source_type IN ('lesson','quiz','game')`, or a
  `payments` row, because those all require `service_role`.
- `courses.gamification_enabled` and `badges.is_active` are columns that exist but
  aren't read by any trigger or policy yet — `is_active` is checked in
  `fn_evaluate_badges`, but `gamification_enabled` isn't checked anywhere (a course
  with it set to `false` still runs the full XP/badge pipeline). See `decisions.md`.
