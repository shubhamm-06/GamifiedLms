# Schema

Postgres 17 via Supabase, project `Gamified LMS`, ref `dmmvftodhcdbubuljqme`,
region `ap-northeast-1`. 16 tables across 6 domains, all RLS-enabled, plus 3
views and 1 deployed Edge Function.

**Source of truth is `supabase/migrations/`.** If this file and the live
database ever disagree, the migrations are correct — reconcile this file, not
the other way around. Every new migration: write the file here first, apply
via Supabase MCP second, regenerate `src/lib/database.types.ts` third, commit
all three together.

**Conventions:** all PKs are `uuid`. `timestamptz` for timestamps, default
`now()` unless noted. Money is an `int` in minor units (e.g. paise), never a
float. Every FK to `profiles.id` ultimately points at `auth.users.id` —
`profiles.id` **is** the auth user id, not a separate one. **Exactly one
soft-delete column exists anywhere in `public`: `payments.deleted_at`**
(migration 009, deliberately scoped there only — see `rules.md`); every
other delete in this schema is still a hard delete. (This line previously
claimed no soft-delete column existed at all — stale as of migration 009,
corrected here rather than left wrong.)

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

**`modules`** — optional grouping layer. `id`, `course_id` (FK, **`ON DELETE
CASCADE`**), `title`, `position`, `created_at`.

**`lessons`** — content unit. `id`, `course_id` (FK, **`ON DELETE CASCADE`**),
`module_id` (FK, nullable, **`ON DELETE SET NULL`**), `title`, `summary`,
`content_type` (`'video'|'text'|'quiz'|'game'`), `video_url`, `content_html`,
`game_id` (FK), `duration_seconds`, `xp_reward` (null inherits
`courses.default_lesson_xp` — never let the client do this fallback; use the
`lesson_effective_xp` view), `is_preview`, `status` (`'draft'|'published'`),
`position`, `created_at`. `position` is scoped per `module_id`, not per
course, and no constraint enforces that — see `rules.md` before writing it.

⚠️ **Two different cascade behaviors, easy to conflate — verified directly
against `information_schema.referential_constraints`, not assumed:**
- `courses → modules.course_id` and `courses → lessons.course_id` are both
  **`CASCADE`**. Deleting a course destroys its modules and lessons outright
  — there is no "orphaned lesson" state reachable this way. (Also why
  `courses` itself is never hard-deleted from the admin UI — see `rules.md`.)
- `modules → lessons.module_id` is **`SET NULL`**. Deleting a *topic* does
  **not** touch its lessons — they survive with `module_id = null` and the
  admin UI surfaces them under "Ungrouped" rather than losing them.

So a lesson can vanish two different ways depending on what's deleted above
it — cascaded away with its course, or merely ungrouped by losing its topic
— and the admin UI's confirm copy for each says the correct one explicitly
rather than a generic "are you sure?" (see `ui.md`).

**`video_url` convention (no separate column marks "embedded"):** stores
either a direct file/stream URL, unvalidated, or a normalized YouTube/Vimeo
embed URL (`https://www.youtube.com/embed/<id>` or
`https://player.vimeo.com/video/<id>`). `src/lib/video.ts` is the single
place that knows these two shapes — `isEmbedUrl()` distinguishes them,
`normalizeEmbedUrl()` converts a pasted share link into the canonical form.
The admin lesson form's Embed-link mode always writes through
`normalizeEmbedUrl()` and refuses to save if it returns `null`; raw
`<iframe>`/HTML embed code is never accepted or stored anywhere — only a
plain URL is ever extracted and persisted. Any future consumer (the
student-facing player, when it exists) should import from `video.ts` rather
than re-deriving these patterns.

**`games`** — CDN-hosted HTML/CSS/JS bundle registry. `id`, `slug`, `title`,
`description` (nullable, added migration 006), `thumbnail_url` (nullable,
paste-only — same convention as `courses.thumbnail_url`, no Storage bucket),
`bundle_url`, `bundle_version`, `bundle_size_bytes`, `checksum`, `max_xp`
(**server-side ceiling** on a single play's award — must be clamped inside
whatever Edge Function eventually grades game completion; none exists yet),
`created_by`. `bundle_size_bytes` and `checksum` are `NOT NULL` at the column
level but optional in the admin form — nothing reads or verifies either yet
(the game-loading/playing side doesn't exist), so a blank input writes `0` /
`''` rather than blocking submit on metadata nobody can usefully supply
today. If a future consumer starts relying on either for integrity checking,
that reader should treat `0`/`''` as "not provided," not as a real value.

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
`attempted_at`. The pass threshold itself now lives in
`app_settings.quiz_pass_threshold_percent` (migration 010) — not on this
table, and not yet read by anything, since quiz grading doesn't exist. See
`state.md`.

### 4. Commerce — `payments`

Idempotency boundary for the purchase flow. `id`, `user_id` (nullable — null
if payment precedes signup), `course_id` (resolved via
`external_product_id`), `provider`, `provider_payment_id` (**unique** — the
important constraint; gateways retry on non-2xx and sometimes double-deliver
regardless), `email` (matches a later signup), `amount`, `currency`,
`status` (`'paid'|'refunded'|'failed'`), `raw_payload` (jsonb, full webhook
body), `received_at`, `reconciliation_status`
(`'unresolved'|'resolved'`, admin-writable), `reconciliation_note`
(admin-writable), `deleted_at` (migration 009, nullable timestamptz, no
default — null means active, non-null means trashed; see below).

Pre-signup flow: leave `user_id` null, match unclaimed `paid` payments by
`email` when the buyer eventually signs up, then create their enrollment.
Not automated — no Edge Function does this yet.

**Admin insert path (migration 007, `payments_admin_insert`).** An admin can
now create a payment directly (`FOR INSERT TO authenticated WITH CHECK
(fn_is_admin())`, no constraint on `provider` — free text, per product
decision), but only ever through `fn_create_manual_order(...)` (below), never
a bare `.insert()` — the function is what generates a collision-proof
`provider_payment_id`, looks up the paying user's email, and creates the
backing enrollment in the same transaction. This is additive: the update
guard (`fn_guard_payment_admin_update`) was unchanged at the time, and there
was still no admin delete policy at all — see `rules.md`. **Both since
superseded by migration 009, directly below** — the guard now also permits
`deleted_at`, and a scoped delete policy exists.

**Trash / permanent delete (migration 009).** `deleted_at` is the only
soft-delete column anywhere in this schema, deliberately scoped to
`payments` alone — see `rules.md` before treating it as a precedent.
Trashing/restoring is an ordinary admin `UPDATE` of `deleted_at`
(`payments_admin_update`, unconditional beyond `fn_is_admin()` — it doesn't
care whether the row is already trashed), and
`fn_guard_payment_admin_update`'s blocklist was never touched by
`deleted_at` since the column didn't previously exist in it — updating it
was already implicitly permitted the moment the column was added; the
`CREATE OR REPLACE` in migration 009 only brings the error message text in
line with reality. **Permanent delete is a real `DELETE`, gated by
`payments_admin_delete_from_trash` (`FOR DELETE TO authenticated USING
(fn_is_admin() AND deleted_at IS NOT NULL)`) — the actual enforcement
mechanism, not a UI convention.** A bare `DELETE` from an authenticated
admin session on a still-active row silently affects zero rows (RLS, not an
error) — verified directly against the REST endpoint with a real admin
bearer token, not just "the button doesn't appear." `enrollments.payment_id
→ payments.id` is `NO ACTION` (confirmed via `pg_constraint`), so a payment
still backing an enrollment can't be permanently deleted even once trashed —
the client maps that `23503` to a specific message rather than a raw
Postgres error (see `useDeletePaymentsPermanently` in `usePayments.ts`).
Trashing/restoring never touches `enrollments.payment_id` — a payment's
`deleted_at` only affects that payment row's own visibility and reporting.

**`manual_order_providers`** (migration 008) — admin-configurable list of
provider labels offered by the Add Order / Import Orders dropdown. `id` (uuid
PK), `label` (text, unique, not null), `is_active` (boolean, default true),
`created_at`. Seeded with `bank_transfer`, `cash`, `comp`. **`payments.provider`
stays plain free text, NOT a foreign key to this table** — see `rules.md` for
why that's a deliberate, permanent design call rather than an oversight.
Deactivating a row here only removes it from the dropdown going forward;
existing `payments.provider` values already copied from it are untouched
(text snapshot, not a live reference). No delete policy exists — deactivate
only, matching the project's archive-don't-delete convention elsewhere.

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

### 6. Platform configuration — `app_settings`

**A deliberate singleton (migration 010).** `id` (uuid PK), `default_currency`
(text, not null, default `'INR'`), `quiz_pass_threshold_percent` (int, not
null, default `70`), `site_name` (text, not null, default `'Wisdom Hatch
Kids'`), `site_url` (nullable), `support_email` (nullable), `terms_url`
(nullable), `privacy_url` (nullable). Exactly one row exists, seeded by the
migration itself — **no INSERT policy exists for any client role**, which is
the actual mechanism that keeps it a singleton; a bare `.insert()` from an
authenticated (even admin) session raises a `42501` RLS violation, verified
live, not assumed. No DELETE policy either, for the same reason: nothing
should ever be able to remove the one row the app depends on.

Two confirmed gaps this closes: `default_currency` gives an actual place to
set what "the platform default" is (previously `courses.currency` and
`payments.currency` each independently defaulted to `'INR'` with nothing
admin-configurable behind that); `quiz_pass_threshold_percent` gives quiz
grading a value to eventually read (nothing consumes it yet — quiz grading
doesn't exist — this table only makes the value settable and storable). See
`state.md` for the specific follow-on this unblocks (`CourseForm.tsx`'s
hardcoded `currency: 'INR'` default should read from here instead — flagged,
not built, since that's a separate small change on its own).

`site_name` replaces `AdminLayout.tsx`'s previously-hardcoded sidebar text.

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
| `trg_payments_guard_admin_update` | `BEFORE UPDATE payments` | `fn_guard_payment_admin_update` | Blocks any column but `reconciliation_status`/`reconciliation_note`/`deleted_at` (migration 009) from changing outside `service_role` |

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

**`fn_create_manual_order(p_user_id, p_course_id, p_provider, p_amount,
p_currency, p_note)`** (migration 007) — records a payment that happened
outside the gateway and its backing enrollment, atomically. Deliberately a
**plain function, not `SECURITY DEFINER`**: its two inserts run under the
*calling admin's own RLS* (`payments_admin_insert`,
`enrollments_admin_insert`), which is what should gate this — a
`SECURITY DEFINER` version would gate on nothing but "can call this
function". In order: looks up the user's `email` from `profiles`; generates
`provider_payment_id` as `'manual-' || gen_random_uuid()::text` (never
accepts one from the caller — that's a system concern, not something to ask
an admin to type); inserts the payment with `status='paid'`,
`received_at=now()`, and `raw_payload = {"manual_entry": true, "entered_by":
auth.uid(), "note": p_note}` (satisfies the `NOT NULL` constraint and keeps
an audit trail without touching the free-text `provider` column); computes
`expires_at` from the course's `access_type`/`access_duration_days` using
the **same formula as the client-side manual-enroll path**
(`useEnrollUser` in `useUserDetail.ts`) — necessarily re-implemented in SQL
rather than shared code, since one runs in the browser and the other inside
Postgres; see `rules.md` for the "keep both in sync by hand" invariant this
creates; inserts the enrollment with `source='purchase'` (a payment now
backs it, so it's semantically a purchase, not a bare manual enrollment) and
`payment_id` set to the new payment's row. If the enrollment insert hits the
`(user_id, course_id)` unique constraint, that specific exception is caught
and re-raised as a plain, specific message ("This student already has an
enrollment for this course.") — since the re-raise happens with nothing
further catching it, the whole call still aborts and rolls back, so the
payment insert from moments earlier is undone too. Returns the new
payment's `id`.

---

## RLS policy matrix

RLS enabled on all 15 tables (14 since migration 001, deny-all before
migration 003 landed; `manual_order_providers` since migration 008, admin-only
from creation). Service-role rows below are documentation, not enforcement —
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
| `payments` | self or admin | `service_role`, or admin via `fn_create_manual_order` only (never a bare insert — migration 007) | `service_role` (any column) or admin (scoped, see trigger table) | admin, only when `deleted_at IS NOT NULL` (migration 009) |
| `xp_transactions` | self or admin | `service_role`, or admin when `source_type='manual'` | — | — |
| `user_stats` | public (`true`) | — | — | — |
| `badges` | any authenticated or admin | admin | admin | admin |
| `user_badges` | public (`true`) | `service_role` only | — | — |
| `manual_order_providers` | admin only | admin only | admin only | admin only |
| `app_settings` | public (`true`), including `anon` | — | admin only | — |

Blank cells mean no policy exists — RLS defaults to deny, so that operation
is impossible for `anon`/`authenticated`. `user_stats` and `user_badges` have
**no client write policy for any role** — only the trigger functions above
write them. `app_settings` has no INSERT or DELETE policy for any role
either, but for a different reason than `user_stats`/`user_badges` — it's a
deliberate singleton (migration 010), not a trigger-maintained rollup;
nothing should ever add a second row or remove the one it has.

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
| 006 | `20260912092250_006_games_description_thumbnail.sql` | 2026-09-12 09:22:50 | Additive: `games.description`, `games.thumbnail_url` (both nullable) |
| 007 | `20260918184559_007_manual_order_creation.sql` | 2026-09-18 18:45:59 | `payments_admin_insert` RLS policy (admin insert, no `provider` constraint); `fn_create_manual_order(...)` — plain function, atomically creates a manual payment + its backing enrollment |
| 008 | `20260917191418_008_manual_order_providers.sql` | 2026-09-18 | `manual_order_providers` table (admin-only RLS on all 4 ops), seeded with `bank_transfer`/`cash`/`comp`; sources the Add Order / Import Orders provider dropdown, not a FK from `payments.provider` |
| 009 | `20260918211500_009_payments_soft_delete.sql` | 2026-09-18 21:15:00 | `payments.deleted_at` (nullable, no default) — the only soft-delete column in this schema; `fn_guard_payment_admin_update` re-verified live and updated to also permit `deleted_at`; `payments_admin_delete_from_trash` — real DELETE, only when already trashed |
| 010 | `20260919090000_010_app_settings.sql` | 2026-09-19 09:00:00 | `app_settings` — a deliberate singleton table (one seeded row, no INSERT/DELETE policy for any role), public SELECT, admin-only UPDATE. Closes the `default_currency` and `quiz_pass_threshold_percent` gaps; `site_name` replaces `AdminLayout`'s hardcoded sidebar text |

No migration has added `admin-user-management` — it's an Edge Function, not a
schema change, deployed independently (see above).
