# Schema

Postgres 17 via Supabase, project `Gamified LMS`, ref `dmmvftodhcdbubuljqme`,
region `ap-northeast-1`. 18 tables across 6 domains, all RLS-enabled, plus 3
views and 1 deployed Edge Function.

**Source of truth is `supabase/migrations/`.** If this file and the live
database ever disagree, the migrations are correct — reconcile this file, not
the other way around. Every new migration: write the file here first, apply
via Supabase MCP second, regenerate `src/lib/database.types.ts` third, commit
all three together.

**Conventions:** all PKs are `uuid`. `timestamptz` for timestamps, default
`now()` unless noted. Money is an `int` in **whole currency units** (whole
rupees for INR — not paise/cents), never a float; see `rules.md` for the
invariant and why. Every FK to `profiles.id` ultimately points at `auth.users.id` —
`profiles.id` **is** the auth user id, not a separate one. **Two soft-delete
mechanisms exist in `public`, deliberately different:** `deleted_at` +
`deleted_by` on `courses`, `modules`, `lessons`, `games`, `badges` and
`profiles` (migration 013 — section 7, "Trash-first deletion"), and the older,
separate `payments.deleted_at` (migration 009 — section 4, no `deleted_by`).
Every other delete in this schema is a hard delete.

---

## Tables

### 1. Identity — `profiles`

Extends `auth.users`. `role` anchors every admin-gated RLS policy.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, FK → `auth.users.id` | Same id as the Supabase auth user |
| display_name | text | not null | Shown on leaderboards |
| avatar_url | text | nullable | |
| email | text | unique, not null | **Not kept in sync by any trigger** after signup — see below. Stays a plain unique constraint even though profiles can be trashed (section 7) |
| phone_number | text | nullable | |
| role | text | not null, default `'student'` | `CHECK (role IN ('student','admin'))` — plain text, not an enum |
| created_at | timestamptz | not null, default now() | |
| deleted_at, deleted_by | timestamptz, uuid | nullable | Migration 013 trash columns — `service_role`-writable only; see section 7 |

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
| slug | text | not null | Unique among **live** rows only — partial unique index `uq_courses_slug_live` (migration 013) |
| title | text | not null | |
| subtitle | text | nullable | |
| description | text | nullable | Markdown or HTML |
| thumbnail_url | text | nullable | |
| status | text | default `'draft'` | `'draft'`, `'published'`, `'archived'` |
| is_free | boolean | default false | |
| price_amount | int | nullable | Whole currency units (not minor units), null when `is_free` |
| currency | text | default `'INR'` | |
| external_product_id | text | nullable, indexed | Maps webhook payload → course |
| access_type | text | default `'lifetime'` | `'lifetime'` or `'fixed'` |
| access_duration_days | int | nullable | Required (and `> 0`) when `access_type = 'fixed'` (check constraint) |
| enrollment_status | text | default `'open'` | `'open'`, `'paused'`, `'closed'` — deliberately separate from `status`: a published course can pause enrollment while staying usable for existing learners |
| default_lesson_xp | int | default 10 | Fallback when a lesson has no `xp_reward` |
| gamification_enabled | boolean | default true | Gates ONLY the lesson-completion XP award (`fn_award_lesson_xp`, migration 012). **Still not enforced** on the `lessons_completed` counter bump or its badge evaluation — see `state.md` |
| total_students | int | default 0 | Trigger-maintained, see Triggers below |
| total_lessons | int | default 0 | Trigger-maintained; counts **live** lessons, draft + published (not trashed, not under a trashed module) — see Triggers and `state.md` |
| created_by | uuid | FK → `profiles.id` | |
| published_at | timestamptz | nullable | |
| created_at, updated_at | timestamptz | default now() | `updated_at` trigger-maintained |
| deleted_at, deleted_by | timestamptz, uuid | nullable | Migration 013 trash columns (section 7). `status = 'archived'` is independent of trash |

**`modules`** — optional grouping layer. `id`, `course_id` (FK, **`ON DELETE
CASCADE`**), `title`, `position`, `created_at`, `deleted_at`, `deleted_by`
(migration 013).

**`lessons`** — content unit. `id`, `course_id` (FK, **`ON DELETE CASCADE`**),
`module_id` (FK, nullable, **`ON DELETE SET NULL`**), `title`, `summary`,
`content_type` (`'video'|'text'|'quiz'|'game'`), `video_url`, `content_html`,
`game_id` (FK), `duration_seconds`, `xp_reward` (null inherits
`courses.default_lesson_xp` — never let the client do this fallback; use the
`lesson_effective_xp` view), `is_preview`, `status` (`'draft'|'published'`),
`position`, `created_at`, `deleted_at`, `deleted_by` (migration 013).
`position` is scoped per `module_id`, not per course, and no constraint
enforces that — see `rules.md` before writing it.

⚠️ **Two different cascade behaviors, easy to conflate — verified directly
against `information_schema.referential_constraints`, not assumed:**
- `courses → modules.course_id` and `courses → lessons.course_id` are both
  **`CASCADE`**. Deleting a course destroys its modules and lessons outright
  — there is no "orphaned lesson" state reachable this way. (Also why a
  course is only permanently deleted from the Trash, and only when nothing
  references it — see section 7 and `rules.md`.)
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

**`games`** — CDN-hosted HTML/CSS/JS bundle registry. `id`, `slug` (unique
among live rows only — `uq_games_slug_live`), `title`,
`description` (nullable, added migration 006), `thumbnail_url` (nullable,
paste-only — same convention as `courses.thumbnail_url`, no Storage bucket),
`bundle_url`, `bundle_version`, `bundle_size_bytes`, `checksum`, `max_xp`
(**server-side ceiling** on a single play's award — must be clamped inside
whatever Edge Function eventually grades game completion; none exists yet),
`created_by`, `deleted_at`, `deleted_by` (migration 013). `bundle_size_bytes`
and `checksum` are `NOT NULL` at the column
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
`completed_at`, `updated_at`. The unique `(user_id, lesson_id)` guarantees one
row per user per lesson — it is **not** what prevents double-awarding
completion XP, since nothing stops a row leaving and re-entering
`'completed'`. That dedupe is `uq_xp_transactions_dedupe` on `xp_transactions`
(see `fn_award_lesson_xp` below); `user_stats.lessons_completed` has no dedupe
(see `state.md`).

**`quiz_questions`** — `id`, `lesson_id` (FK cascade), `prompt`, `options`
(jsonb array of `{id, text}`), `correct_option` (**must never reach the
client unstripped**), `explanation`, `position`. `correct_option` stores an
option's **`id`**, not its text, so rewording an option can't orphan the
answer key; the admin UI only ever offers the current options as choices and
refuses to save a mismatch.

⚠️ **`lessons` has no `slug` column.** The original plan called for one and
this file claimed it until 2026-09-09 — the live table has never had it.
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

**Trash / permanent delete (migration 009).** `payments.deleted_at` is the
older, separate soft-delete mechanism (no `deleted_by`, no parent hiding) —
`rules.md` keeps it distinct from the migration-013 trash-first columns
(section 7).
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
(text snapshot, not a live reference). **`manual_order_providers_admin_delete`
has existed since migration 008 and genuinely grants admin `DELETE`** — this
file previously claimed "no delete policy exists," which was wrong the
whole time (re-verified directly against `pg_policy`, not assumed, before
correcting this). A hard delete here is safe for the same reason
deactivating is: `payments.provider` has no FK to this table, so removing a
row can never touch a historical payment record. Deactivate and delete both
stay available in the UI, serving different purposes — deactivate hides a
label temporarily, delete removes it for good.

**`currencies`** (migration 011) — admin-configurable list of currencies.
`code` (text PK, ISO 4217 — e.g. `'INR'`, `'USD'`), `name` (text, not null —
e.g. "Indian rupee"), `is_active` (boolean, default true). Seeded with the
full standard ISO 4217 active-codes list, 178 rows, sourced from the
current ISO 4217 active-codes table rather than hand-typed, including the
precious-metal and special codes (XAU/XAG/XPD/XPT, XDR/XSU/XUA/XTS/XXX) —
so admins deactivate what this platform doesn't use rather than typing in
what it does. Same admin-only-on-every-operation RLS shape as
`manual_order_providers`. **`app_settings.default_currency` is a foreign
key to `currencies(code)`** (`NO ACTION`, the Postgres default when
unspecified — not `CASCADE`) — the correct, deliberate side effect is that
an admin can no longer delete the currency currently set as the platform
default without changing the default first; the client maps the resulting
`23503` to a specific message rather than a raw Postgres error (see
`useDeleteCurrency` in `useCurrencies.ts`), the same established pattern as
the lesson-delete and payment-permanent-delete FK cases. **`courses.currency`
and `payments.currency` stay plain text, NOT FK'd to this table** —
explicitly out of scope, see `rules.md` and `state.md`.

### 5. Gamification

**`xp_transactions`** — append-only ledger, **never** updated or deleted;
corrections are negative-amount rows. `id`, `user_id`, `amount`, `reason`,
`source_type` (`'lesson'|'quiz'|'game'|'streak'|'manual'`), `source_id`
(nullable), `created_at`. Unique index
`uq_xp_transactions_dedupe (user_id, source_type, source_id) WHERE source_id
IS NOT NULL` makes replayed events a no-op instead of a double-award —
insert with `ON CONFLICT DO NOTHING`.

**`level_thresholds`** (migration 012) — `level` (int PK), `xp_required`
(int, not null). The admin-editable level curve `fn_compute_level` reads.
Seeded with levels 1–30, **computed from the old formula's own math** (smallest
XP at which it first reached each level — verified identical to the old
`fn_compute_level` for every XP value 0–16,431, zero mismatches), so there was
no discontinuity for anyone who already had XP. Level `N` unlocks at
`100·(N−1)^1.5` XP under that seed (this file previously said `100·N^1.5`,
which was off by one level). RLS: `SELECT` for `authenticated` (a level-progress
UI will eventually read it; `anon` cannot), `INSERT`/`UPDATE`/`DELETE`
admin-only. **Strict monotonicity is enforced by
`trg_level_thresholds_validate`, not just the UI** — verified by refusing bad
writes directly (below neighbor, equal to a neighbor, above neighbor) and via
a direct admin REST call. **Level 1 (must exist, `xp_required` must stay 0) is
deliberately NOT enforced in the DB** — protected only in the admin UI (field
disabled, no delete); `fn_compute_level` degrades gracefully if it's ever
missing or nonzero (`coalesce(..., 1)`).

**`user_stats`** — one row per user, trigger-maintained only, never
client-writable by any role. `user_id` (PK), `total_xp`, `level`,
`current_streak`, `longest_streak`, `last_activity_date`,
`lessons_completed`. **`level` is denormalised** — recomputed by
`fn_process_xp_transaction` on each XP event, so editing `level_thresholds`
does not change any stored level until that student's next XP event (migration
012 ran a one-time backfill; nothing repeats it).

**`badges`** — `id`, `slug`, `name`, `description`, `icon_url`,
`condition_type`
(`'lessons_completed'|'streak_days'|'total_xp'|'course_complete'`),
`condition_value`, `is_active` (enforced — see Triggers), `created_by`,
`deleted_at`, `deleted_by` (migration 013). No `created_at` column. Admin CRUD
via `/admin/gamification` (RLS: `badges_admin_insert/update/delete`,
`fn_is_admin()`; delete only when trashed). `slug` is unique among live rows
only (`uq_badges_slug_live`).

**`user_badges`** — `id`, `user_id`, `badge_id` (unique together),
`unlocked_at`. **`badge_id → badges.id` is `NO ACTION`** (confirmed via
`pg_constraint`), so deleting a badge any student has unlocked is refused with
`23503`; the client maps that to "N student(s) already unlocked this —
deactivate it instead" (verified against a real row produced by the real
evaluator, not just the FK's existence). Deactivating (`is_active = false`)
stops new unlocks without touching anyone who already earned it.

### 6. Platform configuration — `app_settings`

**A deliberate singleton (migration 010).** `id` (uuid PK), `default_currency`
(text, not null, default `'INR'`, **FK → `currencies(code)` since migration
011** — see section 4 above), `quiz_pass_threshold_percent` (int, not
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

### 7. Trash-first deletion (migration 013)

`deleted_at timestamptz null` and `deleted_by uuid null` on `courses`,
`modules`, `lessons`, `games`, `badges` and `profiles`; `NULL` means live.
`deleted_by` is a FK → `profiles.id` **`ON DELETE SET NULL`**, so a trashed row
never blocks deleting the admin who trashed it. Each table has a partial index
`where deleted_at is not null`. (`payments.deleted_at` is the older, separate
mechanism in section 4.) The invariants live in `rules.md`; this section is the
mechanism.

- **Parents hide children; children are never mass-marked.** A lesson is
  *live* only if it, its course and its module (if any) are all not trashed
  (`fn_lesson_is_live`); a module is visible only under a live course.
  Restoring a parent restores the view of its children exactly as they were —
  a lesson trashed on its own stays trashed.
- **`deleted_by` is stamped, not trusted** (`fn_stamp_deleted_by`, `BEFORE
  INSERT OR UPDATE` on all six tables). Trashing sets it to `auth.uid()`,
  overwriting anything a client sent; restoring sets it null; while trashed a
  client cannot rewrite it; a client `INSERT` can never create an
  already-trashed row. Only a non-client caller (`service_role`, a migration,
  plain SQL) may supply a non-null `deleted_by` — the Edge Function does, for
  profiles. "Client" means request role `authenticated` or `anon`.
- **`profiles.deleted_at`/`deleted_by` are writable by `service_role` only**
  (`fn_guard_profile_trash_columns`, SQLSTATE `42501` for clients). Both
  profile UPDATE policies (self, admin) would otherwise let a client skip the
  Edge Function's guards and the auth ban. Migrations, `execute_sql` and the
  SQL test-account cleanup are unaffected. There is deliberately **no delete
  trigger on `profiles`**: a user's permanent delete is guarded in the Edge
  Function only.
- **Slug uniqueness is among live rows only.** `uq_courses_slug_live`,
  `uq_games_slug_live` and `uq_badges_slug_live` (`unique (slug) where
  deleted_at is null`) replaced `courses_slug_key`, `games_slug_key` and
  `badges_slug_key`. A trashed row's slug can be reused; restoring it while
  the slug is taken fails with `23505`. `profiles.email` stays a plain unique
  constraint — a trashed user is only banned, so `auth.users` still holds the
  email.
- **Permanent delete is trash-first at the database.** `courses_admin_delete`,
  `modules_admin_delete`, `lessons_admin_delete`, `games_admin_delete` and
  `badges_admin_delete` are now `USING (fn_is_admin() AND deleted_at IS NOT
  NULL)`; a bare `DELETE` on a live row affects zero rows. No FK behavior
  changed (table below).
- **A trashed admin loses admin immediately:** `fn_is_admin()` requires
  `profiles.deleted_at is null`, even for a token that has not expired.
  Trashed users also lose read/update on their own `profiles` row, and
  `user_stats`/`user_badges` rows of trashed users are hidden from non-admins.
  Self-only policies on other tables (`enrollments`, `lesson_progress`, …) are
  **not** gated on trashed status — see `state.md`.
- **Helpers** (`SECURITY DEFINER`, `STABLE`, executable by `anon` and
  `authenticated` because RLS policies evaluate them as the caller):
  `fn_user_is_trashed(uuid)`, `fn_course_is_live(uuid)`,
  `fn_lesson_is_live(uuid)`. They are definer functions because a student
  cannot `SELECT` a trashed parent — a plain subquery in a policy would see
  nothing and wrongly report "live".
- **Admin RPCs** (`SECURITY INVOKER`, so they run under the caller's RLS; each
  begins with an explicit `fn_is_admin()` check and raises `42501` otherwise):
  - `fn_delete_module_permanently(module_id) → int` — the module must already
    be trashed (`55000` otherwise). It first sets `deleted_at` on the module's
    still-live lessons (`deleted_by` stamped from the caller), then deletes the
    module; the unchanged `lessons.module_id ON DELETE SET NULL` leaves those
    lessons Ungrouped **in Trash**, restorable. Lessons already trashed on
    their own are untouched. Returns how many lessons it moved.
  - `fn_course_delete_blockers(course_id)` — one row of counts: enrollments,
    payments, lesson progress, quiz attempts and lesson-sourced
    `xp_transactions` referencing the course. The first four are `NO ACTION`
    FKs the database would refuse anyway; the XP count has no FK and is an
    app-level rule.
  - `fn_restore_blockers(type, id)` — rows of `(blocking_type, blocking_id,
    blocking_title)` naming the trashed ancestors of a trashed `'module'`
    (its course) or `'lesson'` (its course first, then its module). Empty for
    everything else.
- **`fn_revoke_user_sessions(user_id)`** — `SECURITY DEFINER`, `search_path =
  ''`, `EXECUTE` granted to `service_role` only. Deletes the user's
  `auth.refresh_tokens` and `auth.sessions` (the `postgres` role has `DELETE`
  on both and `BYPASSRLS` — verified). Called by the Edge Function's `trash`.
  `fn_recompute_course_lesson_count(course_id)` is an internal helper with
  `EXECUTE` revoked from `public`, `anon` and `authenticated`.

**What a permanent delete does, per entity** (FK behavior unchanged from
before this migration):

| Entity | Permanent delete |
|---|---|
| course | Allowed only when `fn_course_delete_blockers` is all zero. Then `CASCADE` removes all its modules, lessons (trashed ones included) and their quiz questions. |
| module | `lessons.module_id` → `SET NULL`; via `fn_delete_module_permanently` its live lessons are trashed first and end Ungrouped in Trash. |
| lesson | Its quiz questions `CASCADE`. Refused (`23503`) if any lesson progress or quiz attempt references it. |
| game | Refused (`23503`) if any lesson — trashed ones included — references it. |
| badge | Refused (`23503`) if any student has unlocked it. |
| user | Edge Function `delete`, only for a trashed user, and only if nothing references them. Refused with a readable message (`has_history`) otherwise; in practice any user who ever earned XP has a `user_stats` row and stays in Trash. |

---

## Views

- **`lesson_effective_xp`** — `coalesce(lessons.xp_reward,
  courses.default_lesson_xp)`, so the client never does this fallback
  itself. Live lessons only (`fn_lesson_is_live`, migration 013).
- **`profiles_public`** — `id`, `display_name`, `avatar_url` only, granted
  to `authenticated`/`anon`. Excludes trashed profiles (migration 013).
- **`quiz_questions_public`** — strips `correct_option`; row-gated (in the
  view definition itself, not a table policy) to admins, or — for live lessons
  only — `is_preview` lessons and users with an active enrollment in the
  lesson's course.

---

## Trigger functions

Live as of migration 013 (introduced across migrations 002–013).

| Trigger | Fires on | Function | Does |
|---|---|---|---|
| `trg_auth_user_created` | `AFTER INSERT auth.users` | `fn_handle_new_user` (`SECURITY DEFINER`) | Creates the matching `profiles` row; `display_name`/`phone_number` from `raw_user_meta_data` (email-local-part fallback for `display_name`); `role` hardcoded `'student'`; `ON CONFLICT (id) DO NOTHING` |
| `trg_xp_transactions_process` | `AFTER INSERT xp_transactions` | `fn_process_xp_transaction` (`SECURITY DEFINER`) | Upserts `user_stats.total_xp`, recomputes `level` via `fn_compute_level()`, updates streak, calls `fn_evaluate_badges()` |
| `trg_lesson_progress_completed` | `AFTER INSERT OR UPDATE lesson_progress` (acts on the transition into `'completed'`) | `fn_update_lessons_completed` (`SECURITY DEFINER`) | Bumps `user_stats.lessons_completed` (skipped when the lesson is not live — migration 013), re-runs badge evaluation. **Not gated on `courses.gamification_enabled`, and not deduped** — see `state.md` (this row previously said `AFTER UPDATE` only; corrected against `pg_get_triggerdef`) |
| `trg_lesson_progress_award_xp` | `AFTER INSERT OR UPDATE lesson_progress` (same transition) | `fn_award_lesson_xp` (`SECURITY DEFINER`, migration 012) | Inserts the lesson's `xp_transactions` row — see below |
| `trg_level_thresholds_validate` | `BEFORE INSERT OR UPDATE level_thresholds` | `fn_validate_level_threshold` (migration 012) | Rejects a row whose `xp_required` isn't strictly greater than the level below it and strictly less than the level above it (`check_violation`, `23514`, with a human-readable message) |
| `trg_enrollments_student_count` | `AFTER I/U/D enrollments` | `fn_update_course_student_count` (`SECURITY DEFINER`) | Maintains `courses.total_students` off transitions of "counted" = `status = 'active'` **and the user is not trashed** (migration 013) — decrements on **any** move away from active, including to `'expired'` (see `state.md` re: the stale inline comment) |
| `trg_profiles_student_count` | `AFTER UPDATE OF deleted_at profiles` | `fn_profile_trash_student_count` (`SECURITY DEFINER`, migration 013) | Trashing a user decrements `total_students` on every course they are actively enrolled in; restoring increments it |
| `trg_lessons_lesson_count` | `AFTER INSERT OR DELETE OR UPDATE OF deleted_at, module_id, course_id lessons` | `fn_update_course_lesson_count` (`SECURITY DEFINER`) | Recomputes `courses.total_lessons` (migration 013; was incremental) — live lessons, all statuses. Only writes when the value changes, so a reorder does not bump `courses.updated_at` |
| `trg_modules_lesson_count` | `AFTER UPDATE OF deleted_at modules` | `fn_module_trash_lesson_count` (`SECURITY DEFINER`, migration 013) | Trashing/restoring a module changes which lessons are live — recomputes the course's `total_lessons` |
| `trg_courses_stamp_deleted_by`, `trg_modules_…`, `trg_lessons_…`, `trg_games_…`, `trg_badges_…`, `trg_profiles_stamp_deleted_by` | `BEFORE INSERT OR UPDATE` on each table | `fn_stamp_deleted_by` (migration 013) | Stamps `deleted_by` from `auth.uid()` and clears it on restore — see section 7 |
| `trg_profiles_guard_trash_columns` | `BEFORE UPDATE profiles` | `fn_guard_profile_trash_columns` (migration 013) | Clients (`authenticated`/`anon`) cannot change `deleted_at`/`deleted_by` (`42501`); named to sort before the other profiles triggers |
| `trg_courses_updated_at` | `BEFORE UPDATE courses` | `fn_set_updated_at` (generic `updated_at` setter) | Sets `updated_at = now()` |
| `trg_profiles_prevent_role_change` | `BEFORE UPDATE profiles` | `fn_prevent_role_change` | Blocks `role` changes unless `service_role` or `fn_is_admin()` |
| `trg_payments_guard_admin_update` | `BEFORE UPDATE payments` | `fn_guard_payment_admin_update` | Blocks any column but `reconciliation_status`/`reconciliation_note`/`deleted_at` (migration 009) from changing outside `service_role` |

**`fn_compute_level(total_xp)`** (rewritten in migration 012) — `select
coalesce(max(level), 1) from level_thresholds where xp_required <=
p_total_xp`. **`STABLE`, not `IMMUTABLE`** as it was before: it now reads
mutable table data, and leaving `IMMUTABLE` on a function whose result
depends on table contents would let the planner cache a stale answer — quietly
wrong, not just a leftover marker (verified `provolatile = 's'` live). A
plain SQL function (not `SECURITY DEFINER`); it's only ever called from
`SECURITY DEFINER` triggers and the one-time backfill, so it reads
`level_thresholds` as the owner. Above the highest seeded level a student
stays at that level until an admin adds more (the old formula was unbounded).
`user_stats.level` remains denormalised: it is recomputed on each XP event,
**not** when `level_thresholds` is edited.

**`fn_award_lesson_xp()`** (migration 012) — `SECURITY DEFINER` trigger
function, independent of `fn_update_lessons_completed` (the two never call
each other). On the transition into `'completed'`: no-op if the lesson is not live (it, its
module or its course is trashed — migration 013) or the lesson's course has
`gamification_enabled = false`; amount is `lessons.xp_reward` when
NOT NULL (an explicit `0` is a real "no XP" decision — only `NULL` falls back
to `courses.default_lesson_xp`); **no transaction at all when the amount is
`<= 0`** (a 0-amount row would still run the rollup — bumping the streak and
re-evaluating badges — and burn the dedupe slot); otherwise inserts
`xp_transactions(source_type='lesson', source_id=lesson_id)` with
`ON CONFLICT (user_id, source_type, source_id) WHERE source_id IS NOT NULL DO
NOTHING`. **The `WHERE` predicate is required**: `uq_xp_transactions_dedupe` is
a partial index, and a bare column list fails with `42P10` (verified live). The
"insert with `ON CONFLICT DO NOTHING`" convention documented under
`xp_transactions` (bare, no target) also works; the targeted form just needs
the predicate.

**`fn_evaluate_badges(user_id)`** — loops every `is_active`, non-trashed
badge, checks `condition_type` against current `user_stats`, or for
`course_complete` computes whether every live published lesson is complete in
≥ `condition_value` enrolled-and-active, non-trashed courses. Inserts
newly-qualifying badges (`ON CONFLICT DO NOTHING`) — never revokes.

**`fn_is_admin()`** (`SECURITY DEFINER`, `stable`) — the single check every
admin-gated policy calls into: `profiles.role = 'admin'` **and `deleted_at is
null`** (migration 013) for `auth.uid()`.

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

RLS enabled on all 18 tables (14 since migration 001, deny-all before
migration 003 landed; `manual_order_providers` since migration 008, admin-only
from creation; `app_settings`, `currencies` and `level_thresholds` since
migrations 010, 011 and 012 respectively). Every table has at least one
policy. Service-role rows below are documentation, not enforcement —
`service_role` bypasses RLS entirely regardless — but stating intent keeps
the SQL self-explanatory.

**Platform safety net, not in any migration:** a Supabase-provisioned event
trigger `ensure_rls` (`ddl_command_end` on `CREATE TABLE` / `CREATE TABLE AS` /
`SELECT INTO`, owned by `postgres`) calls `public.rls_auto_enable()`
(`SECURITY DEFINER`), which runs `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on
any new table in `public`. It exists live only — no file in
`supabase/migrations/` creates it — so a fresh database built purely from
those files would not have it. Every migration here still enables RLS
explicitly; don't lean on this.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | self (not trashed) or admin | — (via signup trigger, not a policy) | self (own row, not trashed) or admin (any row; `role` guarded by trigger, `deleted_at`/`deleted_by` by the trash-column guard) | — |
| `courses` | `status='published'` and not trashed, or admin | admin | admin | admin, only when trashed |
| `modules` | actively-enrolled in a live course and module not trashed, or admin | admin | admin | admin, only when trashed |
| `lessons` | live lessons only (`fn_lesson_is_live`) that are `is_preview` or actively-enrolled, or admin | admin | admin | admin, only when trashed |
| `games` | any authenticated and not trashed, or admin | admin | admin | admin, only when trashed |
| `quiz_questions` | admin only (base table) | admin | admin | admin |
| `quiz_attempts` | self or admin | `service_role` only | — | — |
| `enrollments` | self or admin | `service_role` or admin | `service_role` or admin | `service_role` or admin |
| `lesson_progress` | self or admin | self | self | — |
| `payments` | self or admin | `service_role`, or admin via `fn_create_manual_order` only (never a bare insert — migration 007) | `service_role` (any column) or admin (scoped, see trigger table) | admin, only when `deleted_at IS NOT NULL` (migration 009) |
| `xp_transactions` | self or admin | `service_role`, or admin when `source_type='manual'` | — | — |
| `user_stats` | public, except trashed users' rows (admins see all) | — | — | — |
| `badges` | any authenticated and not trashed, or admin | admin | admin | admin, only when trashed |
| `user_badges` | public, except trashed users' rows (admins see all) | `service_role` only | — | — |
| `manual_order_providers` | admin only | admin only | admin only | admin only |
| `app_settings` | public (`true`), including `anon` | — | admin only | — |
| `currencies` | admin only | admin only | admin only | admin only |
| `level_thresholds` | any authenticated (not `anon`) | admin | admin | admin |

Blank cells mean no policy exists — RLS defaults to deny, so that operation
is impossible for `anon`/`authenticated`. The `user_stats_select_public` and
`user_badges_select_public` policies kept their names but are no longer plain
`true`. `user_stats` and `user_badges` have
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

Deno runtime, `jsr:@supabase/supabase-js@2`, `verify_jwt: true`. **Version
2** (deployed 2026-09-19 with migration 013: added `trash` and `restore`,
tightened `delete`). Version 1 was created 2026-09-02 07:38:49 UTC (deployed
outside any session with a direct record of it completing — the prior deploy
attempt was blocked by the MCP connector being disconnected). Confirmed via
`list_edge_functions` after the v2 deploy: ACTIVE, `verify_jwt` true.
**`trash`, `restore` and `delete` were exercised end to end against the
deployed function on 2026-09-19** (see `changelog.md`); **`create`,
`update_email` and `update_password` still have not been** — see `state.md`.

Uses `SUPABASE_SERVICE_ROLE_KEY` (Deno default secret, never hardcoded).
Every request resolves the caller from the `Authorization` bearer token, then
checks `profiles.role` via the **service-role** client (never the
caller-scoped one) before parsing any payload — non-admins get `403` first,
and so does a **trashed** admin (their access token stays valid until it
expires, so being an admin is not enough). Client-side guards are UX only;
this is the real enforcement point.

Failures of the removal actions carry a machine-readable `code` next to the
readable `error`: `not_found` (404), `self_target`, `primary_admin`,
`last_admin` (400), `already_trashed`, `not_trashed`, `has_history` (409, with a
`blockers` count map). The three guards below apply to **both** `trash` and
`delete`, in this order: the target is the calling admin → the target is
`PRIMARY_ADMIN_ID` (`91392b37-91f1-4975-afda-e4c238c4d821`) → the target is
an admin and no other non-trashed admin exists. (The last-admin guard is
defense in depth: a valid caller is itself a non-trashed admin, so it can only
fire on a race between two admins trashing each other.)

| Action | Payload | Behavior |
|---|---|---|
| `create` | `email`, `password`, `display_name`, `role` | `createUser({ email_confirm: true })`; `display_name` → `user_metadata` for the signup trigger. Trigger always writes `role='student'`; an `admin` request is a follow-up `UPDATE` — if that fails, reports the account was created as a student rather than a false success. Duplicate email → "Email already registered". |
| `update_email` | `userId`, `newEmail` | `updateUserById({ email, email_confirm: true })`, then explicitly syncs `profiles.email` (nothing else does). |
| `update_password` | `userId`, `newPassword` | Direct admin-set password, min 8 chars, no reset email/link, never echoed back. |
| `trash` | `userId` | Guards, then: sets `profiles.deleted_at` and `deleted_by` = the **verified caller id** (never client-supplied), bans the auth user for `876000h` (~100 years; `banned_until` ≈ 2126), and revokes sessions via `fn_revoke_user_sessions`. If the ban fails the profile flag is rolled back; if the revoke fails the trash stands and the response says `sessionsRevoked: false` (a banned user cannot refresh and RLS already cuts a trashed user off). Refuses an already-trashed user (`already_trashed`). |
| `restore` | `userId` | Only for a trashed user (`not_trashed` otherwise). Unbans first, then clears `deleted_at`/`deleted_by`; if clearing fails it re-bans so the user is never half-restored. No guards apply. |
| `delete` | `userId` | Guards, then requires the target to **already be trashed** (`not_trashed`), then counts blocking rows — `enrollments`, `payments`, `lesson_progress`, `quiz_attempts`, `xp_transactions`, `user_stats`, `user_badges` (by `user_id`) and `courses`/`games`/`badges` (by `created_by`); any non-zero count returns `has_history` with a readable summary and the counts, and the user stays in Trash. Otherwise `deleteUser`, cascading to `profiles`. `deleted_by` is `ON DELETE SET NULL` and does not block. |

Raw Auth/Postgres errors never reach the client — mapped to a short message,
detail logged server-side via `console.error`.

---

## Migrations log

**"Applied (UTC)" below is the live version from `list_migrations`** (the
timestamp the Supabase MCP `apply_migration` call actually stamped), which for
006–012 is **not** the timestamp in the filename — see the drift note under the
table.

| # | File | Applied (UTC) | Summary |
|---|---|---|---|
| 001 | `20260830151837_001_initial_schema.sql` | 2026-08-30 15:18:37 | 14 tables, RLS enabled (deny-all), `lesson_effective_xp` + `quiz_questions_public` views |
| 002 | `20260830153212_002_functions_and_triggers.sql` | 2026-08-30 15:32:12 | `fn_is_admin()`, `updated_at` trigger, student/lesson counters, `fn_compute_level()`, `fn_evaluate_badges()`, XP rollup trigger, `lessons_completed` trigger, `profiles.role` guard |
| 003 | `20260830153242_003_rls_policies.sql` | 2026-08-30 15:32:42 | Full access-matrix RLS policy set; `profiles_public` view; gated `quiz_questions_public` |
| 004 | `20260831135811_004_admin_scoped_writes.sql` | 2026-08-31 13:58:11 | Admin direct writes on `enrollments`; admin `manual`-only `xp_transactions`; admin `profiles.role` changes; `payments` reconciliation columns + guard trigger |
| 005 | `20260901075705_005_auth_profile_trigger.sql` | 2026-09-01 07:57:05 | `fn_handle_new_user()` auto-creates `profiles` on signup |
| 006 | `20260912092250_006_games_description_thumbnail.sql` | 2026-09-12 09:22:59 | Additive: `games.description`, `games.thumbnail_url` (both nullable) |
| 007 | `20260918184559_007_manual_order_creation.sql` | 2026-09-17 18:46:38 | `payments_admin_insert` RLS policy (admin insert, no `provider` constraint); `fn_create_manual_order(...)` — plain function, atomically creates a manual payment + its backing enrollment |
| 008 | `20260917191418_008_manual_order_providers.sql` | 2026-09-17 19:15:12 | `manual_order_providers` table (admin-only RLS on all 4 ops), seeded with `bank_transfer`/`cash`/`comp`; sources the Add Order / Import Orders provider dropdown, not a FK from `payments.provider` |
| 009 | `20260918211500_009_payments_soft_delete.sql` | 2026-09-18 07:31:44 | `payments.deleted_at` (nullable, no default) — the only soft-delete column in this schema; `fn_guard_payment_admin_update` re-verified live and updated to also permit `deleted_at`; `payments_admin_delete_from_trash` — real DELETE, only when already trashed |
| 010 | `20260919090000_010_app_settings.sql` | 2026-09-18 10:47:27 | `app_settings` — a deliberate singleton table (one seeded row, no INSERT/DELETE policy for any role), public SELECT, admin-only UPDATE. Closes the `default_currency` and `quiz_pass_threshold_percent` gaps; `site_name` replaces `AdminLayout`'s hardcoded sidebar text |
| 011 | `20260919120000_011_currencies.sql` | 2026-09-18 11:27:21 | `currencies` table, admin-only RLS, seeded with the full ISO 4217 active-codes list (178 rows); `app_settings.default_currency` becomes a FK to `currencies(code)` (`NO ACTION`) — an admin can no longer delete the platform's current default currency without changing it first |
| 012 | `20260919150000_012_gamification.sql` | 2026-09-18 18:01:09 | `level_thresholds` (seeded 1–30 from the old formula's own math, strict-monotonic validation trigger, admin-write / authenticated-read RLS); `fn_compute_level` rewritten to read it (`IMMUTABLE` → `STABLE`); one-time `user_stats.level` backfill; `fn_award_lesson_xp` + `trg_lesson_progress_award_xp` (the actual lesson-completion XP award, gated on `gamification_enabled`) |
| 013 | `20260919170620_013_trash_first.sql` | 2026-09-19 17:06:20 | Trash-first deletion (section 7): `deleted_at`/`deleted_by` on `courses`, `modules`, `lessons`, `games`, `badges`, `profiles`; live-only partial unique slug indexes on courses/games/badges; trashed rows and rows under trashed parents hidden from non-admins (policies, `profiles_public`, `quiz_questions_public`, `lesson_effective_xp`); the five `*_admin_delete` policies require a trashed row; `fn_is_admin()` requires a non-trashed profile; counters and XP/badge functions skip trashed content; `deleted_by` stamping + `profiles` trash-column guard; helpers and admin RPCs; `fn_revoke_user_sessions` |

**Filename ≠ live version for 006–012 (known drift, not fixed).** Migrations
001–005 match `list_migrations` exactly, and so does 013 (its file was named
after the live version). For 006–012 the MCP `apply_migration`
call stamped its own version at apply time, and the hand-named files never
matched it: 006 differs by 9 seconds; 007's file (`20260918184559`) is a day
*after* its live version (`20260917184638`) and so sorts **after** 008's file
(`20260917191418`); the files for 009–012 carry timestamps later than when they
were actually applied. Consequences: the file order is 006, 008, 007, 009…, so
the two files don't apply in numbered order (007 and 008 don't depend on each
other, so nothing breaks), and the Supabase CLI — which matches local to remote
history by version — would report all of 006–012 as unmatched. Nothing has hit
this yet: the CLI has not been used for migrations on this project (no
`SUPABASE_ACCESS_TOKEN`, see `env-deploy.md`). Renaming the files to the live
versions is a migrations-folder change and was out of scope for the docs-only
sync that found it.

No migration has added `admin-user-management` — it's an Edge Function, not a
schema change, deployed independently (see above).
