# Schema

Postgres 17 via Supabase, project `Gamified LMS`, ref `dmmvftodhcdbubuljqme`,
region `ap-northeast-1`. 14 tables across 5 domains, all RLS-enabled, plus 3
views and 1 deployed Edge Function.

**Source of truth is `supabase/migrations/`.** If this file and the live
database ever disagree, the migrations are correct — reconcile this file, not
the other way around. Every new migration: write the file here first, apply
via Supabase MCP second, regenerate `src/lib/database.types.ts` third, commit
all three together.

**Conventions:** all PKs are `uuid`. `timestamptz` for timestamps, default
`now()` unless noted. Money is an `int` in minor units (e.g. paise), never a
float. Every FK to `profiles.id` ultimately points at `auth.users.id` —
`profiles.id` **is** the auth user id, not a separate one. No soft-delete
column exists anywhere in `public` — every delete is a hard delete.

---

## Tables

### 1. Identity — `profiles`

Extends `auth.users`. `role` anchors every admin-gated RLS policy.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, FK → `auth.users.id` | Same id as the Supabase auth user |
| display_name | text | not null | Shown on leaderboards |
| avatar_url | text | nullable | |
| email | text | unique, not null | **Not kept in sync by any trigger** after signup — see below |
| phone_number | text | nullable | |
| role | text | not null, default `'student'` | `CHECK (role IN ('student','admin'))` — plain text, not an enum |
| created_at | timestamptz | not null, default now() | |

- `role` must never be client-writable except by an admin acting
  deliberately. `fn_prevent_role_change()` (`BEFORE UPDATE`) raises an
  exception on any `role` change unless the caller is `service_role` or
  `fn_is_admin()`.
- `profiles_public` view (`id`, `display_name`, `avatar_url`) is granted to
  `authenticated` and `anon` for leaderboard/display use, since RLS can't
  restrict individual columns on the base table.
- **XP and level are NOT here** — they live on `user_stats`, and that row
  only exists once a user has earned XP or completed a lesson. Anything
  showing XP per user must join `user_stats` and handle the null.
- `email` is populated once at signup by `fn_handle_new_user` and never
  touched again automatically — `admin-user-management`'s `update_email`
  action updates it explicitly alongside the Auth email change, or the two
  drift.

### 2. Course content

**`courses`** — top-level content container.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| slug | text | unique, not null | |
| title | text | not null | |
| subtitle | text | nullable | |
| description | text | nullable | Markdown or HTML |
| thumbnail_url | text | nullable | |
| status | text | default `'draft'` | `'draft'`, `'published'`, `'archived'` |
| is_free | boolean | default false | |
| price_amount | int | nullable | Minor units, null when `is_free` |
| currency | text | default `'INR'` | |
| external_product_id | text | nullable, indexed | Maps webhook payload → course |
| access_type | text | default `'lifetime'` | `'lifetime'` or `'fixed'` |
| access_duration_days | int | nullable | Required (and `> 0`) when `access_type = 'fixed'` (check constraint) |
| enrollment_status | text | default `'open'` | `'open'`, `'paused'`, `'closed'` — deliberately separate from `status`: a published course can pause enrollment while staying usable for existing learners |
| default_lesson_xp | int | default 10 | Fallback when a lesson has no `xp_reward` |
| gamification_enabled | boolean | default true | **Unenforced anywhere** — see `state.md` |
| total_students | int | default 0 | Trigger-maintained, see Triggers below |
| total_lessons | int | default 0 | Trigger-maintained, counts draft+published — see `state.md` |
| created_by | uuid | FK → `profiles.id` | |
| published_at | timestamptz | nullable | |
| created_at, updated_at | timestamptz | default now() | `updated_at` trigger-maintained |

**`modules`** — optional grouping layer. `id`, `course_id` (FK cascade),
`title`, `position`, `created_at`.

**`lessons`** — content unit. `id`, `course_id` (FK cascade), `module_id`
(FK, nullable), `title`, `summary`,
`content_type` (`'video'|'text'|'quiz'|'game'`), `video_url`, `content_html`,
`game_id` (FK), `duration_seconds`, `xp_reward` (null inherits
`courses.default_lesson_xp` — never let the client do this fallback; use the
`lesson_effective_xp` view), `is_preview`, `status` (`'draft'|'published'`),
`position`, `created_at`.

**`games`** — CDN-hosted HTML/CSS/JS bundle registry. `id`, `slug`, `title`,
`bundle_url`, `bundle_version`, `bundle_size_bytes`, `checksum`, `max_xp`
(**server-side ceiling** on a single play's award — must be clamped inside
whatever Edge Function eventually grades game completion; none exists yet),
`created_by`.

### 3. Learner activity

**`enrollments`** — access is a row here, not a flag on `profiles`. `id`,
`user_id`, `course_id` (unique together), `status`
(`'active'|'expired'|'revoked'`), `source` (`'purchase'|'manual'|'free'`),
`payment_id` (FK, nullable), `enrolled_at`, `expires_at` (nullable — **must
be computed at insert time** from `courses.access_duration_days`, never read
live, so a later course-duration change doesn't retroactively affect existing
learners; this is a calling-convention rule, not schema-enforced).

**`lesson_progress`** — per-user, per-lesson state. `id`, `user_id`,
`lesson_id` (unique together), `course_id` (denormalised), `status`
(`'not_started'|'in_progress'|'completed'`), `progress_percent`,
`completed_at`, `updated_at`. The unique `(user_id, lesson_id)` doubles as a
guard against double-awarding completion XP.

**`quiz_questions`** — `id`, `lesson_id` (FK cascade), `prompt`, `options`
(jsonb array of `{id, text}`), `correct_option` (**must never reach the
client unstripped**), `explanation`, `position`. `correct_option` stores an
option's **`id`**, not its text, so rewording an option can't orphan the
answer key; the admin UI only ever offers the current options as choices and
refuses to save a mismatch.

⚠️ **`lessons` has no `slug` column.** The original plan called for one and
this file claimed it until 2026-09-29 — the live table has never had it.
Lessons are addressed by `id`.

**`quiz_attempts`** — every submission kept, not just the best. `id`,
`user_id`, `lesson_id`, `score`, `max_score`, `passed`, `answers` (jsonb),
`attempted_at`. No pass-threshold column anywhere — see `state.md`.

### 4. Commerce — `payments`

Idempotency boundary for the purchase flow. `id`, `user_id` (nullable — null
if payment precedes signup), `course_id` (resolved via
`external_product_id`), `provider`, `provider_payment_id` (**unique** — the
important constraint; gateways retry on non-2xx and sometimes double-deliver
regardless), `email` (matches a later signup), `amount`, `currency`,
`status` (`'paid'|'refunded'|'failed'`), `raw_payload` (jsonb, full webhook
body), `received_at`, `reconciliation_status`
(`'unresolved'|'resolved'`, admin-writable), `reconciliation_note`
(admin-writable).

Pre-signup flow: leave `user_id` null, match unclaimed `paid` payments by
`email` when the buyer eventually signs up, then create their enrollment.
Not automated — no Edge Function does this yet.

### 5. Gamification

**`xp_transactions`** — append-only ledger, **never** updated or deleted;
corrections are negative-amount rows. `id`, `user_id`, `amount`, `reason`,
`source_type` (`'lesson'|'quiz'|'game'|'streak'|'manual'`), `source_id`
(nullable), `created_at`. Unique index
`uq_xp_transactions_dedupe (user_id, source_type, source_id) WHERE source_id
IS NOT NULL` makes replayed events a no-op instead of a double-award —
insert with `ON CONFLICT DO NOTHING`.

**`user_stats`** — one row per user, trigger-maintained only, never
client-writable by any role. `user_id` (PK), `total_xp`, `level`,
`current_streak`, `longest_streak`, `last_activity_date`,
`lessons_completed`.

**`badges`** — `id`, `slug`, `name`, `description`, `icon_url`,
`condition_type`
(`'lessons_completed'|'streak_days'|'total_xp'|'course_complete'`),
`condition_value`, `is_active` (enforced — see Triggers), `created_by`.

**`user_badges`** — `id`, `user_id`, `badge_id` (unique together),
`unlocked_at`.

---

## Views

- **`lesson_effective_xp`** — `coalesce(lessons.xp_reward,
  courses.default_lesson_xp)`, so the client never does this fallback
  itself.
- **`profiles_public`** — `id`, `display_name`, `avatar_url` only, granted
  to `authenticated`/`anon`.
- **`quiz_questions_public`** — strips `correct_option`; row-gated (in the
  view definition itself, not a table policy) to admins, `is_preview`
  lessons, or users with an active enrollment in the lesson's course.

---

## Trigger functions

All live as of migrations 002–005.

| Trigger | Fires on | Function | Does |
|---|---|---|---|
| `trg_auth_user_created` | `AFTER INSERT auth.users` | `fn_handle_new_user` (`SECURITY DEFINER`) | Creates the matching `profiles` row; `display_name`/`phone_number` from `raw_user_meta_data` (email-local-part fallback for `display_name`); `role` hardcoded `'student'`; `ON CONFLICT (id) DO NOTHING` |
| `trg_xp_transactions_process` | `AFTER INSERT xp_transactions` | `fn_process_xp_transaction` (`SECURITY DEFINER`) | Upserts `user_stats.total_xp`, recomputes `level` via `fn_compute_level()`, updates streak, calls `fn_evaluate_badges()` |
| `trg_lesson_progress_completed` | `AFTER UPDATE lesson_progress` (→ `'completed'`) | `fn_update_lessons_completed` (`SECURITY DEFINER`) | Bumps `user_stats.lessons_completed`, re-runs badge evaluation |
| `trg_enrollments_student_count` | `AFTER I/U/D enrollments` | `fn_update_course_student_count` (`SECURITY DEFINER`) | Maintains `courses.total_students` off transitions to/from `'active'` — decrements on **any** move away from active, including to `'expired'` (see `state.md` re: the stale inline comment) |
| `trg_lessons_lesson_count` | `AFTER I/D lessons` | `fn_update_course_lesson_count` (`SECURITY DEFINER`) | Maintains `courses.total_lessons` — counts all statuses |
| `trg_courses_updated_at` | `BEFORE UPDATE courses` | generic `updated_at` setter | |
| `trg_profiles_prevent_role_change` | `BEFORE UPDATE profiles` | `fn_prevent_role_change` | Blocks `role` changes unless `service_role` or `fn_is_admin()` |
| `trg_payments_guard_admin_update` | `BEFORE UPDATE payments` | `fn_guard_payment_admin_update` | Blocks any column but `reconciliation_status`/`reconciliation_note` from changing outside `service_role` |

**`fn_compute_level(total_xp)`** — per-level threshold, level `N` unlocks at
`100 * N^1.5` total XP, recomputed on every rollup (not stored
independently). Whether it should instead be a cumulative sum of thresholds
is open — see `state.md`.

**`fn_evaluate_badges(user_id)`** — loops every `is_active` badge, checks
`condition_type` against current `user_stats`, or for `course_complete`
computes whether every published lesson is complete in ≥ `condition_value`
enrolled-and-active courses. Inserts newly-qualifying badges
(`ON CONFLICT DO NOTHING`) — never revokes.

**`fn_is_admin()`** (`SECURITY DEFINER`, `stable`) — the single check every
admin-gated policy calls into: `profiles.role = 'admin'` for `auth.uid()`.

---

## RLS policy matrix

RLS enabled on all 14 tables since migration 001 (deny-all before migration
003 landed). Service-role rows below are documentation, not enforcement —
`service_role` bypasses RLS entirely regardless — but stating intent keeps
the SQL self-explanatory.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | self or admin | — (via signup trigger, not a policy) | self (own row) or admin (any row, `role` guarded by trigger) | — |
| `courses` | `status='published'` or admin | admin | admin | admin |
| `modules` | actively-enrolled or admin | admin | admin | admin |
| `lessons` | `is_preview`, actively-enrolled, or admin | admin | admin | admin |
| `games` | any authenticated or admin | admin | admin | admin |
| `quiz_questions` | admin only (base table) | admin | admin | admin |
| `quiz_attempts` | self or admin | `service_role` only | — | — |
| `enrollments` | self or admin | `service_role` or admin | `service_role` or admin | `service_role` or admin |
| `lesson_progress` | self or admin | self | self | — |
| `payments` | self or admin | `service_role` only | `service_role` (any column) or admin (scoped, see trigger table) | — |
| `xp_transactions` | self or admin | `service_role`, or admin when `source_type='manual'` | — | — |
| `user_stats` | public (`true`) | — | — | — |
| `badges` | any authenticated or admin | admin | admin | admin |
| `user_badges` | public (`true`) | `service_role` only | — | — |

Blank cells mean no policy exists — RLS defaults to deny, so that operation
is impossible for `anon`/`authenticated`. `user_stats` and `user_badges` have
**no client write policy for any role** — only the trigger functions above
write them.

Two `SELECT` layers on `quiz_questions`: the base table's policy is
admin-only. Students must always read through `quiz_questions_public`
instead, which strips `correct_option`.

---

## Edge Functions

### `admin-user-management` — **deployed, ACTIVE**

Deno runtime, `jsr:@supabase/supabase-js@2`, `verify_jwt: true`. Version 1,
created 2026-09-02 07:38:49 UTC (deployed outside any session with a direct
record of it completing — the prior deploy attempt was blocked by the MCP
connector being disconnected; confirmed live via `list_edge_functions` on
2026-09-05). **The four actions below have not been end-to-end tested against
the deployed function yet** — see `state.md`.

Uses `SUPABASE_SERVICE_ROLE_KEY` (Deno default secret, never hardcoded).
Every request resolves the caller from the `Authorization` bearer token, then
checks `profiles.role` via the **service-role** client (never the
caller-scoped one) before parsing any payload — non-admins get `403` first.
Client-side guards are UX only; this is the real enforcement point.

| Action | Payload | Behavior |
|---|---|---|
| `create` | `email`, `password`, `display_name`, `role` | `createUser({ email_confirm: true })`; `display_name` → `user_metadata` for the signup trigger. Trigger always writes `role='student'`; an `admin` request is a follow-up `UPDATE` — if that fails, reports the account was created as a student rather than a false success. Duplicate email → "Email already registered". |
| `update_email` | `userId`, `newEmail` | `updateUserById({ email, email_confirm: true })`, then explicitly syncs `profiles.email` (nothing else does). |
| `update_password` | `userId`, `newPassword` | Direct admin-set password, min 8 chars, no reset email/link, never echoed back. |
| `delete` | `userId` | Refuses `PRIMARY_ADMIN_ID` (`91392b37-91f1-4975-afda-e4c238c4d821`) with 400 before touching Auth; otherwise `deleteUser`, cascades to `profiles`. |

Raw Auth/Postgres errors never reach the client — mapped to a short message,
detail logged server-side via `console.error`.

---

## Migrations log

| # | File | Applied (UTC) | Summary |
|---|---|---|---|
| 001 | `20260830151837_001_initial_schema.sql` | 2026-08-30 15:18:37 | 14 tables, RLS enabled (deny-all), `lesson_effective_xp` + `quiz_questions_public` views |
| 002 | `20260830153212_002_functions_and_triggers.sql` | 2026-08-30 15:32:12 | `fn_is_admin()`, `updated_at` trigger, student/lesson counters, `fn_compute_level()`, `fn_evaluate_badges()`, XP rollup trigger, `lessons_completed` trigger, `profiles.role` guard |
| 003 | `20260830153242_003_rls_policies.sql` | 2026-08-30 15:32:42 | Full access-matrix RLS policy set; `profiles_public` view; gated `quiz_questions_public` |
| 004 | `20260831135811_004_admin_scoped_writes.sql` | 2026-08-31 13:58:11 | Admin direct writes on `enrollments`; admin `manual`-only `xp_transactions`; admin `profiles.role` changes; `payments` reconciliation columns + guard trigger |
| 005 | `20260901075705_005_auth_profile_trigger.sql` | 2026-09-01 07:57:05 | `fn_handle_new_user()` auto-creates `profiles` on signup |

No migration has added `admin-user-management` — it's an Edge Function, not a
schema change, deployed independently (see above).
