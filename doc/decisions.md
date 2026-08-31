# Decisions

Open product/technical decisions not yet resolved, and a log of resolved ones.
Anything decided in conversation with Claude Code but not yet visible anywhere in
code belongs here until it is.

## Resolved

- **TypeScript over JavaScript.** The repo is TypeScript from Phase 0 onward;
  nothing new gets written as `.js`/`.jsx`. (2026-08-31)
- **Tailwind v4**, CSS-first config (`@theme` in the main stylesheet, no
  `tailwind.config.js`), via the official Vite plugin. (2026-08-31)
- **npm only.** No pnpm/yarn/bun lockfiles in this repo. (2026-08-31)
- **Type-based folder structure**, deliberately simple:
  `src/{components,pages,hooks,lib}`. Not designed to scale to every future admin
  domain — revisit once multiple unrelated admin sections start crowding these four
  folders, not before. (2026-08-31)
- **Migrations live in the repo first.** `supabase/migrations/` is the source of
  truth going forward; a migration gets written there, then applied — the live
  database is not authoritative on its own. The four migrations already applied
  directly against the live project (`001`–`004`) were backfilled into the repo
  after the fact as a one-time exception, matching their live timestamps exactly so
  a future `supabase db pull` won't conflict. (2026-08-31)
- **Admin writes on `enrollments` and manual `xp_transactions`: "Option B."**
  Admins write these tables directly through RLS policies gated by `fn_is_admin()`,
  rather than routing every admin action through a `service_role` Edge Function.
  Rationale: these are low-risk, admin-initiated, already-audited-by-role actions
  (grant/revoke access, manual XP correction) where an extra network hop through an
  Edge Function adds latency and a second thing to deploy/maintain without a
  matching security benefit — `fn_is_admin()` is exactly as trustworthy inside a
  trigger as inside an Edge Function, since both ultimately check the same
  `profiles.role`. Manual XP inserts are additionally constrained to
  `source_type = 'manual'` at the policy level, so this path can never be used to
  spoof a `'lesson'`/`'quiz'`/`'game'` award. Implemented in migration `004`.
  (2026-08-31)
- **`payments`: scoped reconciliation, not open admin writes.** Unlike enrollments
  and XP, `payments` is externally-sourced financial record data — an admin should
  be able to annotate a row (mark it reconciled, leave a note) but never alter what
  the payment gateway actually reported. `fn_guard_payment_admin_update()` enforces
  this at the trigger level: any admin update touching a column other than
  `reconciliation_status`/`reconciliation_note` is rejected, regardless of what RLS
  would otherwise allow. Implemented in migration `004`. (2026-08-31)
- **`profiles.role` changes: admins allowed, not just `service_role`.** Extends the
  original service-role-only guard so `fn_is_admin()` callers can also change another
  user's role (e.g. promoting a new admin), without opening it to arbitrary client
  writes. Implemented in migration `004`.

## Open

- **Level formula interpretation.** The plan states
  `xp_required = 100 * level^1.5`. Implemented in `fn_compute_level()` as a
  *per-level threshold* (level `N` unlocks at `100 * N^1.5` total XP). The
  alternative reading — a *cumulative* sum of thresholds up to level `N` — produces
  a slower leveling curve. Needs a decision before this is relied on for anything
  user-facing.
- **`total_students` on enrollment expiry.** Currently only decrements on
  `active → revoked` (or any transition away from `active`), which does include
  `expired` — but whether an expired learner should still count as a "student" for
  display purposes is unresolved. Revisit if course-facing student counts start
  looking wrong to admins.
- **`total_lessons` — draft vs. published.** Currently counts all lessons
  regardless of `status`. Whether the admin-facing lesson count should only reflect
  published lessons is open.
- **`courses.gamification_enabled` and `badges.is_active` enforcement.**
  `is_active` is already checked inside `fn_evaluate_badges` (inactive badges are
  skipped). `gamification_enabled` is not checked anywhere — a course with it set to
  `false` still runs the full XP/badge pipeline for its lessons. Needs a decision on
  where that check belongs (trigger vs. Edge Function vs. UI-only) before it's
  meaningful.
- **Quiz grading and game XP clamping have no Edge Function yet.** The schema and
  RLS are built assuming server-side grading/clamping exists
  (`quiz_attempts`/`xp_transactions` inserts require `service_role`), but no such
  function is deployed. Nothing can currently insert a quiz attempt or a
  lesson/quiz/game XP transaction at all. Out of scope for the current admin-tooling
  phase, but blocks any learner-facing work until built.
- **Pre-signup payment claiming is unautomated.** The `email`-matching flow
  described in `business-logic.md` has no implementation — a payment that arrives
  before signup stays unclaimed until something (an Edge Function, a scheduled job)
  goes looking for it.
- **Leaderboard reset cadence, streak freeze, quiz retry policy, completion bonus
  XP, certificates.** Carried over from the original product scope as explicitly
  out of scope for now — not revisited during Phase 0/1.
