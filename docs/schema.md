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
| display_name | text | not null | Shown on leaderboards; the student's own kid-facing name field |
| avatar_url | text | nullable | Paste-a-URL image, unused by the kid app since migration 026 (see `avatar_config`) |
| avatar_config | jsonb | nullable, CHECK (migration 026) | The procedural avatar: `{base, topper, face, accent}`, each from a small fixed set (`src/lib/avatar.ts`, the one place the sets are defined; the CHECK mirrors them exactly). `NULL` = never customized; the kid app renders `DEFAULT_AVATAR` for that case, nothing here defaults it. Self-read/write under the existing whole-row policies below — no RLS change. Not on `profiles_public` (nothing shows another student's avatar yet) |
| email | text | unique, not null | **Not kept in sync by any trigger** after signup — see below. Stays a plain unique constraint even though profiles can be trashed (section 7) |
| phone_number | text | nullable | |
| role | text | not null, default `'student'` | `CHECK (role IN ('student','admin'))` — plain text, not an enum |
| created_at | timestamptz | not null, default now() | |
| deleted_at, deleted_by | timestamptz, uuid | nullable | Migration 013 trash columns — `service_role`-writable only; see section 7 |

- `role` must never be client-writable except by an admin acting
  deliberately. `fn_prevent_role_change()` (`BEFORE UPDATE`) raises an
  exception on any `role` change unless the caller is `service_role` or
  `fn_is_admin()`.
- `profiles_public` view (`id`, `display_name`, `avatar_url`) is granted
  `SELECT` to `authenticated` only (migration 016 — it used to be writable by
  `anon`, see Views) for leaderboard/display use, since RLS can't restrict
  individual columns on the base table.
- **XP and level are NOT here** — they live on `user_stats`, and that row
  only exists once a user has earned XP or completed a lesson. Anything
  showing XP per user must join `user_stats` and handle the null.
- `email` is populated once at signup by `fn_handle_new_user` and never
  touched again automatically — `admin-user-management`'s `update_email`
  action updates it explicitly alongside the Auth email change, or the two
  drift. The kid-facing profile page (2026-09-27) closes this same gap for a
  self-service email change a different way: `useKidProfile` compares the
  confirmed `session.user.email` against this column on every read and
  updates it to match when they differ (the existing `profiles_update_self`
  policy already allows this), which only happens once the student has
  clicked Supabase Auth's confirmation link — until then `session.user.email`
  is still the old address, so this column never changes early.
- **Streak calendar reads `xp_transactions.created_at` directly, not a new
  log table.** The kid profile page's 5-week activity grid (2026-09-27) is a
  plain query, self-read under the existing `xp_transactions_select_self`
  policy, grouping the caller's own rows by UTC day. Chosen over a dedicated
  day-log table because `xp_transactions` is already exactly the signal
  `fn_process_xp_transaction` uses to advance `user_stats.current_streak` and
  `last_activity_date` (section 5), so the calendar and the streak number can
  never disagree, and it needed no migration. Inherits one gap from the
  counter it mirrors: a lesson completed in a `gamification_enabled = false`
  course awards no XP and so lights up no day either, same as it does not
  advance the streak.
- **`deletion_requests`** (migration 027, 2026-09-27) — `id`, `user_id` (FK →
  `profiles.id`, `ON DELETE CASCADE`), `requested_at`. The profile page's
  "Request account deletion" writes one row here and nothing else; consistent
  with the trash-first philosophy (section 7), a student can never hard-delete
  their own account from the kid app. Self SELECT/INSERT under the same
  "own row, minus a trashed caller" shape as every policy since migration 014,
  plus admin SELECT; no UPDATE or DELETE policy for any client role, so a
  request is permanent once made. **Recorded only** — an admin acting on it
  (trashing the user, the existing Edge Function path) is unbuilt, a separate
  later task. Not on the Edge Function `delete` action's blocker-count list
  (section 7's `has_history` table), so this row would cascade away silently
  if that student were ever hard-deleted — harmless since the request is moot
  once fulfilled, but worth knowing if a generic blocker check is ever added.

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
`min_time_seconds` and `pass_percentage` (migration 015, below), `position`,
`created_at`, `deleted_at`, `deleted_by` (migration 013).
`position` is scoped per `module_id`, not per course, and no constraint
enforces that — see `rules.md` before writing it.

**Lesson time and pass-mark settings (migration 015) — enforced by the lesson engine (migration 017).**
`lessons.min_time_seconds` is `integer not null default 90` with
`lessons_min_time_seconds_check` (0–3600); 0 means no minimum time.
`lessons.pass_percentage` only means something for a quiz lesson — the quiz
**is** the lesson (`quiz_questions.lesson_id` and `quiz_attempts.lesson_id`
reference `lessons(id)`), so there is no separate quiz table to hold it.
**Reshaped by migration 028** (the admin quiz-authoring task) from `integer
not null default 60` / `lessons_pass_percentage_check (1–100)`, stored (and
ignored) for every lesson type, to: nullable, `lessons_pass_percentage_check
(0–100 or null)`, plus a second, bidirectional
`lessons_pass_percentage_quiz_only_check ((content_type = 'quiz') =
(pass_percentage is not null))` — NULL for every non-quiz lesson, required
for a quiz one. The column's own `DEFAULT 60` is gone; a new/never-set quiz
lesson's 70% pre-fill now lives only in the client
(`DEFAULT_PASS_PERCENTAGE`, `lib/lessonSettings.ts`), so it can never leak
onto a non-quiz row again. Since 017 `fn_complete_lesson` and `fn_submit_quiz`
read it on every call (*Lesson engine*, below), so an admin's edit takes
effect on the next call, including for a lesson a student already has open.
Migration 015 set
`min_time_seconds = 0` on existing quiz lessons (there were none at the time, so
it touched 0 rows); every other lesson kept the default of 90 — `text` lessons
included, since the spec named only video, game and quiz. The two real lessons
(one `text`, one `video`) are at 90 / 60. No policy was added:
`lessons_admin_update` (`fn_is_admin()`) already covers any column and no student
write policy exists. Checked live (role-switched queries, 2026-09-20): a student
reads the new columns on lessons they can see, every update they attempt affects
0 rows and an insert is refused (`42501`); an admin's update affects exactly 1
row and changes nothing else — `total_lessons` and `deleted_at`/`deleted_by`
were unchanged (`trg_lessons_lesson_count` is `UPDATE OF deleted_at, module_id,
course_id`, so a settings edit does not fire it; `fn_stamp_deleted_by` only ever
sets `deleted_by`).

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
(**server-side ceiling** on a game lesson's XP: `fn_complete_game` (migration 025) awards
`least(floor(reported score), max_xp)`),
`created_by`, `deleted_at`, `deleted_by` (migration 013). `bundle_size_bytes`
and `checksum` are `NOT NULL` at the column
level but optional in the admin form — nothing reads or verifies either yet
(the game-loading/playing side doesn't exist), so a blank input writes `0` /
`''` rather than blocking submit on metadata nobody can usefully supply
today. If a future consumer starts relying on either for integrity checking,
that reader should treat `0`/`''` as "not provided," not as a real value.
`orientation` (migration 015, `text not null default 'any'`,
`games_orientation_check` in `'portrait'|'landscape'|'any'`) records the
orientation a game is meant to be played in. The lesson player reads it and shows a
"turn your phone" hint when the screen does not match; it never locks orientation.

**`lesson_content_blocks`** (migration 023) — a doc (`text`) lesson's content as ordered typed
blocks. Columns: `id`, `lesson_id` (FK to `lessons`, **`ON DELETE CASCADE`**), `position` (int, not
unique, the same per-lesson ordering pattern as `lessons.position`), `block_type`
(`paragraph` | `callout` | `image`, a CHECK, no open type field), `text_content` (paragraph and
callout), `callout_color` (`gold` | `teal` | `coral` | `plum`, the locked tokens) and `callout_icon`
(`info` | `idea` | `star` | `heart` | `question`, a fixed set), `image_url` (paste-only, `http(s)://`
checked, like `games.bundle_url`; no upload flow) and `image_alt`, plus `created_at` / `updated_at`
(`fn_set_updated_at` trigger). `lesson_content_blocks_shape_check` ties the columns to the type: a
paragraph has non-empty text and nothing else, a callout has non-empty text, a colour and an icon and
no image, an image has a URL and no text or callout fields, so a row can never carry another type's
fields. Index `idx_lesson_content_blocks_lesson_position (lesson_id, position)`. `lessons.content_html`
stays and is the kid app's fallback for a lesson with no blocks. **RLS**: SELECT for an admin, or for a
lesson that is live (`fn_lesson_is_live`) AND `status = 'published'` AND (`is_preview`, or the caller is
not trashed and has an active enrollment in its course): the `lessons` policy's shape plus the status
check (the `lessons` policy itself has no status check, see `state.md`; blocks do not inherit that).
INSERT, UPDATE and DELETE are admin only (`fn_is_admin()`). Trashing a lesson hides its blocks through
`fn_lesson_is_live`; deleting one removes them. The migration also seeds 13 demo blocks for the three
doc lessons of "Demo: Fun with Numbers" (Fun Facts About Numbers 4, Shapes in Your Home 5, The Mystery
of the Missing Cookies 4); the image block points at a `placehold.co` placeholder to be replaced.
Verified with real JWTs (not `execute_sql`): an enrolled student reads exactly the 13 published blocks
(a draft lesson's block in the same course came back as 0), a student enrolled only in another course and
`anon` read 0 (also when filtering by a lesson id), and a student INSERT is refused (`42501`) while
UPDATE and DELETE touch no rows.

**Admin authoring** (`DocBlocksEditor.tsx`, nested in `LessonDialog` for a
`content_type = 'text'` lesson, 2026-09-28 — until now these 13 rows only
existed because they were seeded directly by migration 023's own SQL, with
no UI to add more). The form only ever produces one of the three shapes
`lesson_content_blocks_shape_check` allows — switching a block's type clears
every field that doesn't belong to the new type, rather than leaving a stale
value that a later save could turn into a constraint violation. Colour and
icon are labeled swatch/icon pickers (never a raw text input), and an image
URL is checked against `^https?://` client-side before save, so a bad paste
gets a readable message instead of a raw Postgres error. Same
drag-reorder/confirm-delete conventions as the quiz questions above,
including the same `SimpleSortableList.tsx` primitive.

### 3. Learner activity

**`enrollments`** — access is a row here, not a flag on `profiles`. `id`,
`user_id`, `course_id` (**at most one `'active'` row per pair — see below**), `status`
(`'active'|'expired'|'revoked'`), `source` (`'purchase'|'manual'|'free'`),
`payment_id` (FK, nullable), `enrolled_at`, `expires_at` (nullable — **must
be computed at insert time** from `courses.access_duration_days`, never read
live, so a later course-duration change doesn't retroactively affect existing
learners; this is a calling-convention rule, not schema-enforced).

**`last_accessed_at timestamptz` (nullable, migration 022)** is when the student last opened
the course on the kid app; NULL means never opened and is not backfilled. It is written only by
`fn_touch_enrollment` and read only through `fn_home_course` (see `routes-permissions.md`),
which ranks by `COALESCE(last_accessed_at, enrolled_at)` so a course never opened yet ranks by
when access began. Updating it changes no `status`, so `courses.total_students` does not move
(verified: unchanged after a touch).

**One ACTIVE enrollment per (user, course); history is unconstrained**
(migration 021). The original `uq_enrollments_user_course` was a plain
`UNIQUE (user_id, course_id)`, which made a (user, course) pair a single row
forever: a revoked student could not be re-enrolled OR re-ordered by any path
(— `fn_create_manual_order` catches the `unique_violation` and refuses).
It is now the partial index `uq_enrollments_user_course_active ... WHERE
status = 'active'`, so revoked and expired rows accumulate as history while a
second *active* row is still refused. Consequences worth knowing:
- Admin "Restore access" inserts a NEW active row and leaves the revoked one
  untouched (`routes-permissions.md`, `ui.md`).
- A read of "this user's enrollment for course X" can now return more than one
  row and must pick, not assume one — `useEnrollmentStatus` (kid side) orders
  and takes the first rather than `.maybeSingle()`.
- `courses.total_students` stays correct without new logic: the existing
  `fn_update_course_student_count` trigger counts INSERTs of active rows, and
  the revoked row it sits beside was already uncounted.

**`lesson_progress`** — per-user, per-lesson state. `id`, `user_id`,
`lesson_id` (unique together), `course_id` (denormalised), `status`
(`'not_started'|'in_progress'|'completed'`), `progress_percent`,
`completed_at`, `updated_at` and — migration 017 — `active_seconds` (`integer not
null default 0`, `>= 0`), `first_opened_at` and `last_heartbeat_at` (nullable
`timestamptz`). **Clients cannot write this table**: 017 dropped
`lesson_progress_insert_self` / `_update_self` and revoked
`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` from `anon` and `authenticated`; only the
lesson-engine functions write it. The unique `(user_id, lesson_id)` guarantees one
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
refuses to save a mismatch. **Admin authoring** (`QuizQuestionsEditor.tsx`,
nested in `LessonDialog`, 2026-09-28): drag-reorder via the same
`@dnd-kit`/zero-animation convention as `CurriculumTab` (generalised into
`SimpleSortableList.tsx` for this single-container case), one batched
`upsert` writing every changed `position`; delete goes through a confirm
`AlertDialog`, the same pattern `CurrenciesSection.tsx` already uses. Full
write-up in `ui.md`.

⚠️ **`lessons` has no `slug` column.** The original plan called for one and
this file claimed it until 2026-09-09 — the live table has never had it.
Lessons are addressed by `id`.

**`quiz_attempts`** — every submission kept, not just the best. `id`,
`user_id`, `lesson_id`, `score`, `max_score`, `passed`, `answers` (jsonb),
`attempted_at`. Written only by `fn_submit_quiz` (migration 017; `answers` is the
`{question id: option id}` object the student sent, `max_score` the number of
questions). The pass mark is `lessons.pass_percentage`;
`app_settings.quiz_pass_threshold_percent` (migration 010) is still stored and
read by nothing — see `state.md`. `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` are also
revoked from `anon`/`authenticated` (017); the `service_role` insert policy remains.

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
only (`uq_badges_slug_live`) — already in place since migration 013, so the
2026-09-28 badge-icon-builder task needed no new uniqueness migration, only
a friendlier client-side message (`SLUG_TAKEN`, `useBadges.ts`) on the
`23505` it already threw. `icon_url` is a `data:` URI built client-side —
either generated from a closed colour+glyph set, or (added the same day)
read from an uploaded image file capped at 100 KB and a fixed type allow-list
(`lib/badgeIcon.ts`) — never a free-form pasted link, and never a Storage
object (no bucket exists in this project). See `ui.md`. **Archiving never touches
`user_badges`**: `deleted_at`/`deleted_by` are plain column writes on
`badges` itself, no cascade or trigger reaches the other table, so a
student's earned-badge row survives an archive by construction — verified
directly (archived a badge a fixture student had already earned; its
`user_badges` row, including `unlocked_at`, was unchanged).

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
grading a value to eventually read (nothing consumes it: quiz grading exists
since migration 017 but reads `lessons.pass_percentage` — this table only makes
the value settable and storable). See
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
  Migration 014 then gated every `auth.uid()`-scoped policy the same way (below),
  so an access token issued before a trash stops working on own-row tables too.
- **Migration 014 — the trashed-token gap.** A trashed user's access token stays
  valid until it expires, and every "own rows" policy kept working for it
  (observed: reading own enrollments, updating own `lesson_progress`). 014 adds
  `not fn_user_is_trashed(auth.uid())` to: `enrollments_select_self`,
  `lesson_progress_select_self` / `_insert_self` / `_update_self` (the last two were dropped again by 017),
  `quiz_attempts_select_self`, `xp_transactions_select_self`,
  `payments_select_self` (an own-row read; no payment logic or write path
  touched), `user_stats_select_public` and `user_badges_select_public` (now also
  hidden from a trashed *caller*), the enrolled legs of
  `modules_select_enrolled_or_admin`, `lessons_select_enrolled_or_preview_or_admin`
  and `quiz_questions_public`, and `games_select_authenticated` /
  `badges_select_authenticated`. Verified with role-switched queries: a trashed
  student holding an old token reads nothing and every write fails; a live
  student is unaffected. Left alone on purpose: the profiles policies (gated in
  013), admin policies, world-readable config, `profiles_public`,
  `lesson_effective_xp` and the `*_service_role_*` policies. It also revoked
  `EXECUTE` from `public`, `anon` and `authenticated` on
  `fn_module_trash_lesson_count` and `fn_profile_trash_student_count` (trigger
  functions are only checked for `EXECUTE` when the trigger is created).
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

## Lesson engine (migrations 017–019)

All lesson completion, timing, quiz grading, unlock order and XP happen in the
database. A student's browser has **no write path** to `lesson_progress`,
`quiz_attempts`, `xp_transactions`, `user_stats` or `user_badges`; the four
functions below are the only way it changes any of them. The user is always
`auth.uid()`, never a parameter. All are `SECURITY DEFINER`, `search_path = ''`,
`EXECUTE` revoked from `public` and `anon`, granted to `authenticated` only
(callers: `lib/lessonEngine.ts`, `routes-permissions.md`).

| Function | Does |
|---|---|
| `fn_course_lesson_states(p_course_id)` | One row per live, published lesson in course order: `lesson_id`, `module_id` (null = ungrouped), `state` (`locked`/`available`/`in_progress`/`completed`), `active_seconds`, `min_time_seconds`, `completed_at`, `sort_index`. The single source of truth for what is locked. Errors: `not_enrolled`, `lesson_unavailable` (course draft or trashed) |
| `fn_lesson_heartbeat(p_lesson_id)` → `active_seconds`, `min_time_seconds`, `time_met`, `completed` | Needs enrollment and an unlocked lesson. Sets `first_opened_at` once. The first beat, or one more than 30 s after the last, only sets `last_heartbeat_at` (a resume after a gap adds nothing). Otherwise adds `least(floor(seconds since the last beat), 15)` and sets `last_heartbeat_at = now()`. A completed lesson is returned unchanged. Row-locked, so concurrent beats serialise |
| `fn_complete_game(p_lesson_id, p_score numeric)` → `completed`, `already_completed`, `completed_at`, `xp_awarded` (migration 025) | How a game lesson completes. Same guard as the others (enrolled, live, published, unlocked), then: the lesson must be a game lesson whose game exists and is not trashed (`lesson_unavailable`); `p_score` must be non-null, not NaN and not negative (`invalid_score`); already completed → success with 0 XP; the lesson's minimum time still applies (`too_early`). XP is `least(floor(p_score), games.max_xp)` (any larger number is clamped, never honoured), 0 when the course has gamification off; it is inserted as an ordinary `xp_transactions` row (`source_type 'lesson'`, `source_id` = the lesson, so the dedupe index, the admin reset's claw-back and `fn_engine_complete`'s XP sum all cover it) in the same transaction and BEFORE the lesson is completed, so the existing rollup trigger runs unchanged. To keep that the only payment, `fn_award_lesson_xp` now skips a game lesson whose game exists, and `fn_complete_lesson` refuses one (`lesson_unavailable`); a game lesson with no live game keeps the old timer completion and lesson XP |
| `fn_complete_lesson(p_lesson_id)` → `completed`, `already_completed`, `completed_at`, `xp_awarded` | Needs enrollment, unlocked, published. Already completed → success with 0 XP. Else `active_seconds >= min_time_seconds` (`too_early`), and for a quiz a passed attempt (`quiz_not_passed`, checked after the time). Completing runs the existing triggers in the same transaction (XP, `lessons_completed`, badges); nothing is reimplemented |
| `fn_check_quiz_answer(p_lesson_id, p_question_id, p_option_id text)` → `correct`, `correct_option` (migration 024) | The per-question feedback path: same `fn_engine_guard` door as the rest (enrolled, live, published, unlocked, and a quiz), then checks that the question belongs to the lesson and the option to the question (else `invalid_answers`) and replies whether the option was right and which option was. **Writes nothing** (no attempt, progress or XP); grading, the attempt row, completion and XP-once stay in `fn_submit_quiz`. The only place a student can learn `correct_option` (`rules.md`); a client calling it directly can probe options, accepted because the key is shown after each answer and a failed quiz is retaken on the same questions |
| `fn_submit_quiz(p_lesson_id, p_answers jsonb)` → `score`, `max_score`, `percentage`, `passed`, `results`, `completed`, `time_met`, `xp_awarded` | Grades server-side; records a `quiz_attempts` row per valid submission (unlimited retries). `passed` ⇔ `score*100 >= pass_percentage*questions` (integers, no rounding). `results` is `[{question_id, correct}]` in question order — **v1 assumption: it never contains the correct option or the explanation**. Passed and time met (or min time 0) → completes the lesson in the same call; passed but not time met → the student calls `fn_complete_lesson` later. `p_answers` must be an object with exactly one string entry per question, each an option id of that question; anything else is `invalid_answers` and records nothing. Options may be `{id,text}` objects or (legacy) bare strings |

**Error codes.** Every refusal is `raise exception` with SQLSTATE `P0001` and the
code as both `message` and `hint`: `not_enrolled` (no session, trashed user, or no
active enrollment), `lesson_unavailable` (no such lesson, trashed lesson/module/
course, unpublished, draft course, non-quiz sent to `fn_submit_quiz`, a quiz with
no questions), `locked`, `too_early`, `quiz_not_passed`, `invalid_answers`,
`internal_error` (anything unexpected; detail goes to the Postgres log, never the
response). Anything else in a response (`42501` permission denied, an expired JWT)
is PostgREST/Auth, not the engine. A nonexistent lesson id answers
`lesson_unavailable` while an existing lesson in an unenrolled course answers
`not_enrolled` — a lesson-id existence oracle; ids are random UUIDs, accepted.

**Enrollment rule** — mirrors the enrollment leg of
`lessons_select_enrolled_or_preview_or_admin` and lives only in `fn_is_enrolled`: an
`enrollments` row for the user and course with `status = 'active'`. It does **not**
read `expires_at` and does not look at the course status (the sequence does, below). **Finding, not changed:** nothing
in the database ever sets `status = 'expired'` (no function mentions it) and
`expires_at` is read by no policy, function or trigger, so an enrollment past its
`expires_at` still works everywhere — engine included (verified: status `active`
with `expires_at` three days ago was accepted; status `expired` was refused
`not_enrolled`). Enforcing expiry needs a product decision (see `state.md`).

**Course order and lock state** (`fn_lesson_states`). A lesson is in the sequence
only if it is not trashed, is `status = 'published'`, its course is not trashed
and is `published` (migration 029: a `draft` or `archived` course has no
sequence), and it is ungrouped or in a non-trashed topic. Order: topics by `(position, created_at,
id)`, each topic's lessons by `(position, created_at, id)`, then **ungrouped
lessons after every topic** by the same key, however low their `position`.
Trashed and unpublished lessons and lessons in trashed topics are skipped — they
neither lock nor unlock anything. State: `completed` if the student's row is
completed; else `locked` unless **every earlier lesson in the sequence is
completed** (identical to "the previous lesson is completed" for normal progress,
and it stays correct if an admin inserts or reorders lessons after students have
progressed); else `in_progress` if they have a row that is started (heartbeat,
attempt) ; else `available`. The first lesson is always unlocked; the first lesson
of a topic unlocks when the previous topic is complete. **`archived` courses do
not work for students (migration 029)**: `fn_lesson_states` and
`fn_course_lesson_states` no longer admit them, so `fn_engine_guard` (and through
it heartbeat, complete, submit quiz, check answer, complete game),
`fn_caller_lesson_unlocked` and `fn_lesson_unlocked_for` all answer
`lesson_unavailable` / `false` exactly as for any unavailable course. Enrollment,
progress and XP rows are untouched, so republishing restores everything.

**Student visibility helpers (migration 029).** `fn_course_is_reachable(course)`:
the course is `status = 'published'` and `fn_course_is_live` (not trashed).
`fn_lesson_is_reachable(lesson)`: the lesson is `status = 'published'` AND
`fn_lesson_is_live(lesson)` AND `fn_course_is_reachable(its course)`. Both are
`SECURITY DEFINER`, `STABLE`, `search_path = public`, `EXECUTE` for `PUBLIC`, `anon`,
`authenticated` and `service_role` — identical to `fn_course_is_live` /
`fn_lesson_is_live`. Used by: the `lessons`, `modules` and `lesson_content_blocks`
SELECT policies and the `lesson_effective_xp` and `quiz_questions_public` views (each
keeps its admin branch, preview rule and unlock rule; only the reachability
requirement is added). **`fn_course_is_live` and `fn_lesson_is_live` intentionally keep
meaning "not trashed"** and are unchanged: `fn_update_lessons_completed` (the
`lessons_completed` and badge-evaluation trigger) still uses `fn_lesson_is_live`, and
its behaviour must not depend on a course's publication state.

**Helpers** (all in `public`; `EXECUTE` revoked from `public`/`anon`/`authenticated` unless
stated): `fn_engine_error(code)` (raises), `fn_is_enrolled(user, course)`,
`fn_lesson_states(user, course)`, `fn_lesson_unlocked_for(user, lesson)`,
`fn_engine_guard(lesson)` (the shared precondition checks the three action
functions start with), `fn_engine_complete(user, lesson, course)` (the one place a
lesson becomes completed). **View-facing wrappers** (migration 018, granted to
`authenticated` because views call them as the caller): `fn_caller_enrolled(course)`
and `fn_caller_lesson_unlocked(lesson)` — no user-id parameter, so all they reveal
is the caller's own status. The internal helpers take a user id and must never be
granted to clients: `fn_is_enrolled(<other user>, …)` would let a student probe
other students' enrollments.

**`fn_evaluate_badges(uuid)`** was directly callable by `anon` and `authenticated`
for any user id (it only inserts badges the user already qualifies for, so it could
not grant anything unearned, but it was a client-triggerable write to
`user_badges`). Migration 019 revoked `EXECUTE` from `public`/`anon`/`authenticated`;
its callers are the two trigger functions, which run as their owner. Verified: a
completion through the engine still awarded a `lessons_completed` badge.

**Lesson player read path** (no schema change: the player added no table, column,
policy, grant or view). It reads `lessons` (`id, course_id, title, summary,
content_type, video_url, content_html, game_id, min_time_seconds, pass_percentage`,
plus `courses(gamification_enabled)`, filtered to `status = 'published'` because the
lessons policy has no such check), `lesson_effective_xp` (the only XP figure it shows),
`games` (`id, title, bundle_url, orientation`, readable by any signed-in user) and
`quiz_questions_public`. It fetches none of these for a locked lesson. Lesson `content_html`
and a game's `bundle_url` are admin-authored and are treated as untrusted by the
player (sandboxed frames, `rules.md`). A lesson's `video_url` is the normalized
YouTube/Vimeo embed URL or a plain https file; a raw `watch?v=` link is not an embed
URL and the player shows "This video isn't ready yet" for it. `fn_submit_quiz` `results`
still carry no explanation: **migration 020 (proposed, NOT applied, file
`supabase/migrations/20260922000000_020_lesson_player_server.sql`) would add each
question's `explanation` to a graded result and, optionally, carry the sub-second
remainder in the heartbeat**; the live schema is through 019 until it is approved
(`state.md`).

---

## Admin progress reset (migration 021)

Two `SECURITY DEFINER`, `search_path = ''` functions behind
`/admin/users/$userId`. Both are `EXECUTE`-granted to `authenticated` and
check `fn_is_admin()` **inside the body** — the gate is the function, not the
UI (verified by calling both with a non-admin JWT: `not_authorized`).

| Function | Does |
|---|---|
| `fn_admin_course_progress_summary(p_user_id, p_course_id)` — `lessons_completed`, `progress_rows`, `quiz_attempts`, `xp_to_claw_back` | Read-only preview of exactly what a reset would remove. The confirmation dialog reads this rather than re-deriving the numbers client-side, so what it promises and what the reset does cannot drift |
| `fn_admin_reset_course_progress(p_user_id, p_course_id)` — `lessons_removed`, `quiz_attempts_removed`, `xp_clawed_back` | One transaction: deletes this course's `lesson_progress` and `quiz_attempts`, deletes the course's `('lesson', lesson_id)` `xp_transactions` rows, then writes ONE compensating negative `'manual'` row |

**Why the original XP rows are deleted rather than offset.** The once-only
guard is `uq_xp_transactions_dedupe` — `UNIQUE (user_id, source_type,
source_id) WHERE source_id IS NOT NULL` — and `fn_award_lesson_xp` inserts
`ON CONFLICT DO NOTHING`. Keeping the positives would both block a negative row
on the same key AND silently award 0 XP when the lesson is completed again.
Deleting them is what lets a reset student re-earn, without touching the guard.
The cost, accepted deliberately: the audit trail is the aggregate negative row
(course title, amount), not a per-lesson reversal.

**What it does NOT touch.** Streaks are snapshotted before the compensating
insert and restored after it, because `fn_process_xp_transaction` advances
`current_streak` / `longest_streak` / `last_activity_date` on *every* insert,
negative ones included. Badges are never revoked (`fn_evaluate_badges` only
inserts). Manual awards and other courses' XP are untouched (the delete is
keyed on this course's lesson ids). `total_xp` and `level` are recomputed by
that same trigger via `fn_compute_level` — that math is reused, never
duplicated — and the clawback is capped at the current balance so XP can
never go negative. `user_stats.lessons_completed` IS decremented (floored at
0) by the number of completed rows removed, because its trigger only ever
increments and it feeds badge evaluation.

---

**Known cost.** `quiz_questions_public` and `fn_caller_lesson_unlocked` recompute a
course's states per question row (`STABLE`, no caching) — fine at present sizes;
revisit if a quiz has hundreds of questions.

---

## Views

All three are `SECURITY DEFINER` views (the default; the security advisor
lists all three at ERROR level) and **must stay that way**: each exposes a
subset of columns or rows of a table whose own RLS a student cannot pass, and an
invoker view would show a student nothing. Each was audited on 2026-09-20 —
what it exposes, and why definer is acceptable, is below. **A view runs its
table access as its owner, but Postgres checks `EXECUTE` on the functions it
calls against the *calling* role** (and does so when the query starts, for every
function in the view, whether or not a row reaches it), so every function a view
calls must be executable by `authenticated` — which is why the view-facing
helpers below are caller-only wrappers with no user-id parameter (migration 018;
017 got this wrong and broke both views until 018). Views also get Supabase's
default `ALL` privileges when created: a new view must `revoke all … from anon,
authenticated` and grant only `SELECT` (`rules.md`).

- **`lesson_effective_xp`** (`lesson_id`, `effective_xp`) — `coalesce(lessons.xp_reward,
  courses.default_lesson_xp)`, so the client never does this fallback itself.
  Rows follow the `lessons` SELECT policy since 017: live lessons that are
  `is_preview`, or in a course the caller is actively enrolled in
  (`fn_caller_enrolled`), or everything for an admin. Since migration 029 a
  non-admin row also requires `fn_lesson_is_reachable` (a published lesson in a
  published course), so draft lessons and archived courses expose no XP row; the
  admin branch is unchanged (live lessons, any status). It used to list every
  live lesson's id and XP to every caller. Kept as definer; conversion to
  invoker was not attempted. It joins `courses`, whose SELECT policy shows a
  student only *published* courses, so an invoker view would (inferred from the
  policy text, not tested) drop the lessons of an archived course the student is
  enrolled in. It exposes only a lesson id and a number. `SELECT` granted to
  `authenticated` only (016).
- **`profiles_public`** (`id`, `display_name`, `avatar_url`) — needed as definer
  because `profiles` RLS is self-or-admin and leaderboards must read other
  students' names. It exposes those three columns of every non-trashed profile
  to any signed-in user (accepted: that is its purpose; no email, phone or role).
  **Migration 016 fixed a live vulnerability:** as an auto-updatable
  single-table view it was writable — `anon` and any student could `PATCH` or
  `DELETE` other users' profiles through it, bypassing `profiles` RLS (it had
  `ALL` privileges granted to `anon`/`authenticated` since migration 003).
  016 revoked everything and granted `SELECT` to `authenticated` only; verified
  afterwards with the same `PATCH`/`DELETE` probes (refused) and a student read
  (still works).
- **`quiz_questions_public`** (`id`, `lesson_id`, `prompt`, `options`, `position`) —
  definer because `quiz_questions` is admin-only and RLS cannot hide single
  columns. **Recreated in 017 without `explanation`** (it used to be exposed, and
  can give the answer away); `correct_option` was never in it. Rows: everything
  for an admin; otherwise a reachable (migration 029: `fn_lesson_is_reachable`,
  i.e. a `published` lesson in a `published`, non-trashed course), `published`
  lesson that is `is_preview` or that the caller has unlocked
  (`fn_caller_lesson_unlocked` — enrolled and not locked in the engine's
  sequence). Previously any enrolled student saw every
  quiz of the course from the start. `SELECT` to `authenticated` only.

  A preview lesson's questions (and its `lessons` row) are readable by any
  signed-in user, a trashed one included — that is what the existing `lessons`
  policy does for previews, and the views mirror it.

---

## Trigger functions

Live as of migration 014 (introduced across migrations 002–014).

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

RLS enabled on all 19 tables (14 since migration 001, deny-all before
migration 003 landed; `manual_order_providers` since migration 008, admin-only
from creation; `app_settings`, `currencies` and `level_thresholds` since
migrations 010, 011 and 012 respectively; `deletion_requests` since migration
027). Every table has at least one policy. Service-role rows below are documentation, not enforcement —
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
| `modules` | actively-enrolled in a **published**, non-trashed course (`fn_course_is_reachable`) and module not trashed, or admin | admin | admin | admin, only when trashed |
| `lessons` | **published** lessons in a **published** course, not trashed (`fn_lesson_is_reachable`), that are `is_preview` or actively-enrolled, or admin (any status) | admin | admin | admin, only when trashed |
| `lesson_content_blocks` | admin, or blocks of a reachable (`fn_lesson_is_reachable`), `published` lesson that is `is_preview` or actively-enrolled (not trashed) | admin | admin | admin |
| `games` | any authenticated and not trashed, or admin | admin | admin | admin, only when trashed |
| `quiz_questions` | admin only (base table) | admin | admin | admin |
| `quiz_attempts` | self (not trashed) or admin | `service_role` policy only; students write it only through `fn_submit_quiz` | — | — |
| `enrollments` | self (not trashed) or admin | `service_role` or admin | `service_role` or admin | `service_role` or admin |
| `lesson_progress` | self (not trashed) or admin | — (migration 017 dropped the self policy; only the engine functions write) | — (same) | — |
| `payments` | self (not trashed) or admin | `service_role`, or admin via `fn_create_manual_order` only (never a bare insert — migration 007) | `service_role` (any column) or admin (scoped, see trigger table) | admin, only when `deleted_at IS NOT NULL` (migration 009) |
| `xp_transactions` | self (not trashed) or admin | `service_role`, or admin when `source_type='manual'` | — | — |
| `user_stats` | public, except trashed users' rows and for a trashed caller (admins see all) | — | — | — |
| `badges` | any authenticated and not trashed, or admin | admin | admin | admin, only when trashed |
| `user_badges` | public, except trashed users' rows and for a trashed caller (admins see all) | `service_role` only | — | — |
| `manual_order_providers` | admin only | admin only | admin only | admin only |
| `app_settings` | public (`true`), including `anon` | — | admin only | — |
| `currencies` | admin only | admin only | admin only | admin only |
| `level_thresholds` | any authenticated (not `anon`) | admin | admin | admin |
| `deletion_requests` | self (not trashed) or admin | self (own `user_id`, not trashed) | — | — |

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
instead, which strips `correct_option` **and `explanation`** (migration 017) and only
shows the questions of a lesson the student has unlocked (or a preview lesson).

---

## Edge Functions

### `admin-user-management` — **deployed, ACTIVE**

Deno runtime, `jsr:@supabase/supabase-js@2`, `verify_jwt: true`. **Version
3** (deployed 2026-09-20: added `bulk_create`; `create` now goes through the
shared `createAuthUser` helper). Version 2 (2026-09-19, migration 013) added
`trash` and `restore` and tightened `delete`. Version 1 was created
2026-09-02 07:38:49 UTC (deployed outside any session with a direct record of
it completing — the prior deploy attempt was blocked by the MCP connector being
disconnected). Confirmed via `list_edge_functions` on 2026-09-20: `status`
ACTIVE, `verify_jwt` true, `version` 3. The v3 source was pasted into the
deploy call from the committed file and was not diffed byte-for-byte afterwards;
its behaviour was tested against the deployment. **`trash`, `restore` and
`delete` were exercised end to end on 2026-09-19, and `bulk_create` on
2026-09-20** (see `changelog.md`); **`update_email` and `update_password`
still have not been, and `create` has not been called directly since the
refactor** (`bulk_create` runs the same `createAuthUser` helper) — see
`state.md`.

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
| `create` | `email`, `password`, `display_name`, `role` | `createAuthUser` — `createUser({ email_confirm: true })`, shared with `bulk_create`; `display_name` → `user_metadata` for the signup trigger. Trigger always writes `role='student'`; an `admin` request is a follow-up `UPDATE` — if that fails, reports the account was created as a student rather than a false success. Duplicate email → "Email already registered". |
| `bulk_create` | `rows[]` (1–25) of `{ display_name, email, phone_number, password }` | Re-validates every row server-side: name required (≤ 100 chars); email valid (≤ 254, trimmed, lower-cased); phone optional (digits with an optional leading `+`, 7–15 digits once spaces, dots, dashes and brackets are removed); password optional but ≥ 8 chars when given — a blank one gets a 20-character crypto-random password (upper, lower and digit guaranteed, no ambiguous glyphs, no `= + - @`). An email already in `profiles` — active or trashed — is `skipped_exists` / `skipped_trashed` and never touched; an email repeated inside the request fails `duplicate_in_request`; the Auth "already registered" race maps to a skip as well. Accounts are created one at a time through `createAuthUser` and are always `role='student'`. The phone is written afterwards by a service-role `UPDATE`; if that fails the account is kept and the row is reported `created` with `warning: 'phone_not_saved'`. Returns `results[]`, one per input row (`index`, `email`, `status`, `code`/`reason` for a failure, `generated_password` only when the server generated it); one bad row never aborts the rest. The response is `Cache-Control: no-store`. Nothing is logged but row indexes and Auth error codes. |
| `update_email` | `userId`, `newEmail` | `updateUserById({ email, email_confirm: true })`, then explicitly syncs `profiles.email` (nothing else does). |
| `update_password` | `userId`, `newPassword` | Direct admin-set password, min 8 chars, no reset email/link, never echoed back. |
| `trash` | `userId` | Guards, then: sets `profiles.deleted_at` and `deleted_by` = the **verified caller id** (never client-supplied), bans the auth user for `876000h` (~100 years; `banned_until` ≈ 2126), and revokes sessions via `fn_revoke_user_sessions`. If the ban fails the profile flag is rolled back; if the revoke fails the trash stands and the response says `sessionsRevoked: false` (a banned user cannot refresh and RLS already cuts a trashed user off). Refuses an already-trashed user (`already_trashed`). |
| `restore` | `userId` | Only for a trashed user (`not_trashed` otherwise). Unbans first, then clears `deleted_at`/`deleted_by`; if clearing fails it re-bans so the user is never half-restored. No guards apply. |
| `delete` | `userId` | Guards, then requires the target to **already be trashed** (`not_trashed`), then counts blocking rows — `enrollments`, `payments`, `lesson_progress`, `quiz_attempts`, `xp_transactions`, `user_stats`, `user_badges` (by `user_id`) and `courses`/`games`/`badges` (by `created_by`); any non-zero count returns `has_history` with a readable summary and the counts, and the user stays in Trash. Otherwise `deleteUser`, cascading to `profiles`. `deleted_by` is `ON DELETE SET NULL` and does not block. |

**Password length.** This function and the admin UI enforce 8 characters
(`MIN_PASSWORD_LENGTH`). Supabase Auth's own configured minimum is 6 — observed
2026-09-20 from its `weak_password` response to a 1-character signup attempt
(`Password should be at least 6 characters.`, reason `length`; that request
created no account). The stricter 8 applies to accounts created here; whether
a direct Auth API or dashboard call would accept a 6–7-character password is
inferred from that setting and was not tested.

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
| 014 | `20260919175812_014_trashed_token_gap.sql` | 2026-09-19 17:58:12 | Gates every `auth.uid()`-scoped policy on `not fn_user_is_trashed(auth.uid())` (own-row tables, leaderboards, enrollment-derived content, games/badges reads, `quiz_questions_public`) so a trashed user's already-issued token stops working; `EXECUTE` revoked from `public`/`anon`/`authenticated` on `fn_module_trash_lesson_count` and `fn_profile_trash_student_count`. No type-level change |
| 015 | `20260920130513_015_lesson_timer_settings.sql` | 2026-09-20 13:05:13 | `lessons.min_time_seconds` (default 90, check 0–3600), `lessons.pass_percentage` (default 60, check 1–100) and `games.orientation` (default `'any'`, check portrait/landscape/any); existing quiz lessons backfilled to `min_time_seconds = 0` (none existed). Stored settings only — nothing enforces them yet; no policy change |
| 016 | `20260920182632_016_lock_public_views.sql` | 2026-09-20 18:26:32 | Security fix: `profiles_public`, `quiz_questions_public` and `lesson_effective_xp` had `ALL` privileges for `anon` and `authenticated` (Supabase default on new views); `profiles_public` was therefore writable/deletable by anon and any student. `REVOKE ALL`, then `GRANT SELECT` to `authenticated` only |
| 017 | `20260920183703_017_lesson_engine.sql` | 2026-09-20 18:37:03 | The lesson engine: `lesson_progress.active_seconds`/`first_opened_at`/`last_heartbeat_at`; student write policies on `lesson_progress` dropped and write privileges revoked on `lesson_progress` and `quiz_attempts`; `fn_lesson_heartbeat`, `fn_complete_lesson`, `fn_submit_quiz`, `fn_course_lesson_states` plus internal helpers; `quiz_questions_public` recreated without `explanation`; `lesson_effective_xp` gated. **Its two view definitions were broken for every signed-in user** (permission denied for the helper functions) — fixed by 018 |
| 018 | `20260920184704_018_engine_view_helpers.sql` | 2026-09-20 18:47:04 | `fn_caller_enrolled` / `fn_caller_lesson_unlocked` (caller-only, executable by `authenticated`) and re-created `quiz_questions_public` / `lesson_effective_xp` on top of them |
| 019 | `20260920185147_019_lock_evaluate_badges.sql` | 2026-09-20 18:51:47 | `EXECUTE` on `fn_evaluate_badges(uuid)` revoked from `public`/`anon`/`authenticated` |
| 022 | `20260926000000_022_home_course_last_accessed.sql` | 2026-09-26 | `enrollments.last_accessed_at` (nullable); `fn_touch_enrollment(uuid)` and `fn_home_course()` (both `SECURITY DEFINER`, `search_path = ''`, `authenticated` only) |
| 021 | `20260924000000_021_admin_enrollment_restore_and_reset.sql` | 2026-09-24 | `uq_enrollments_user_course` replaced by the partial `uq_enrollments_user_course_active` (`WHERE status = 'active'`); `fn_admin_course_progress_summary` and `fn_admin_reset_course_progress` added (both admin-gated inside the body). 020 is still unapplied and unrelated — see `state.md` |
| 023 | `20260926100000_023_lesson_content_blocks.sql` | 2026-09-26 17:21:12 (live version `20260926172112`) | `lesson_content_blocks` (typed block rows with shape CHECKs, fixed colour and icon sets, cascade on lesson delete), its RLS (published-lesson enrolled read, admin writes) and 13 demo blocks for the three doc lessons of the demo course |
| 024 | `20260926200000_024_check_quiz_answer.sql` | 2026-09-26 (live version in `list_migrations`) | `fn_check_quiz_answer(uuid, uuid, text)`: the per-question quiz feedback path (`SECURITY DEFINER`, `search_path = ''`, shared `fn_engine_guard`, `EXECUTE` for `authenticated` only, writes nothing). No table, column, policy or view changed: the per-quiz pass mark is `lessons.pass_percentage` (015) and students already read questions through `quiz_questions_public` (017/018, no `correct_option`) |
| 025 | `20260926210000_025_game_completion.sql` | 2026-09-26 (live version in `list_migrations`) | `fn_complete_game(uuid, numeric)`: server-clamped score XP for game lessons (`SECURITY DEFINER`, `search_path = ''`, shared guard, `authenticated` only, new error code `invalid_score`); `fn_award_lesson_xp` skips game lessons that have a live game; `fn_complete_lesson` refuses them. No table, column, policy or view changed |
| 026 | `20260927000000_026_avatar_config.sql` | 2026-09-27 (live version in `list_migrations`; applied via the CLI `--db-url` fallback, `env-deploy.md`, the MCP connector was unavailable this session) | `profiles.avatar_config jsonb`, nullable, with a shape CHECK requiring exactly the four keys `base`/`topper`/`face`/`accent` (both directions — missing AND extra keys refused, caught in testing: `->>` on a missing key is SQL NULL and `NULL = ANY(...)` is NULL, not FALSE, so a CHECK checking only "no extra keys" would have silently accepted a partial config) and each value from its fixed set (`src/lib/avatar.ts`). No RLS change: covered by the existing whole-row `profiles_select_self_or_admin`/`profiles_update_self` policies |
| 027 | `20260927010000_027_deletion_requests.sql` | 2026-09-27 (applied via the CLI `--db-url` fallback, one statement per call — the pooler's transaction mode refused the whole file as one prepared statement) | New `deletion_requests` table (`id`, `user_id` → `profiles(id)` `ON DELETE CASCADE`, `requested_at`): a student's self-service "please delete my account" request, recorded only — no automatic action. RLS: self SELECT/INSERT (the migration-014 "own row, minus a trashed caller's stale token" shape) or admin SELECT; no UPDATE or DELETE policy for any client role, so a request is a permanent record. Not on the Edge Function's `delete` blocker list (schema.md section 7) — a request row cascades away silently if that student is later hard-deleted, acceptable since the request is moot once fulfilled |
| 028 | `20260928000000_028_quiz_pass_percentage_quiz_only.sql` | 2026-09-28 (applied via the CLI `--db-url` fallback, one statement per call) | Reshapes `lessons.pass_percentage` rather than adding a second, functionally-identical column (the admin quiz-authoring task asked for a new nullable `quiz_pass_threshold`, which is exactly what this column already was): dropped `NOT NULL`/`DEFAULT 60`, backfilled every non-quiz lesson's value to `NULL` (13 rows — all still at the old blanket default, never meaningful), replaced `lessons_pass_percentage_check` with a `0–100 or null` range check plus a new bidirectional `lessons_pass_percentage_quiz_only_check ((content_type = 'quiz') = (pass_percentage is not null))`. `fn_submit_quiz` untouched — every quiz lesson keeps a concrete value under the new CHECK, so its existing grading arithmetic never sees a NULL; `app_settings.quiz_pass_threshold_percent` (010, still read by nothing) untouched too, wiring it in as a site-wide fallback is a separate later change |
| 029 | `20260928100000_029_student_visibility_published_only.sql` | 2026-09-28 (applied via the CLI `--db-url` fallback, one statement per call; stamped by hand) | Students reach only published, non-trashed courses and lessons. New `fn_course_is_reachable` / `fn_lesson_is_reachable` (same attributes and grants as the `*_is_live` helpers); `lessons`, `modules` and `lesson_content_blocks` SELECT policies and the `lesson_effective_xp` / `quiz_questions_public` views repointed to them (admin branches, preview and unlock rules kept); `archived` removed from `fn_lesson_states` and `fn_course_lesson_states`, so the whole engine refuses an archived course with the existing `lesson_unavailable`. `fn_course_is_live`, `fn_lesson_is_live` and `fn_update_lessons_completed` untouched. Closes the two `state.md` findings (archived-course inconsistency, enrolled students reading draft lessons) |

**Filename ≠ live version for 006–012 (known drift, not fixed).** Migrations
001–005 match `list_migrations` exactly, and so do 013–019 (their files were named
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
