# Database Schema

Postgres 17 via Supabase. 14 tables across 5 concerns. This file is the canonical
schema reference — if the live database ever disagrees with this file, treat this
file as correct and reconcile with a migration.

**Supabase project:** `Gamified LMS` — ref `dmmvftodhcdbubuljqme` — region `ap-northeast-1`

## Conventions used throughout

- All primary keys are `uuid`.
- `timestamptz` for all timestamps; `default now()` unless noted.
- Money is stored as an `int` in **minor units** (e.g. paise for INR), never as a float.
- Every FK to `profiles.id` ultimately points at `auth.users.id` (Supabase Auth) — `profiles.id` **is** the auth user id, not a separate id.

---

## 1. Identity and access

### `profiles`
Extends `auth.users`. `role` is the anchor for every admin-gated RLS policy.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, FK → `auth.users.id` | Same id as the Supabase auth user |
| display_name | text | not null | Shown on leaderboards |
| avatar_url | text | nullable | |
| email | text | unique, not null | |
| phone_number | text | nullable | |
| role | text | default `'student'` | `'student'` or `'admin'` only |
| created_at | timestamptz | default now() | |

⚠️ **`role` must never be client-writable** except by an admin acting deliberately.
`fn_prevent_role_change()` (a `BEFORE UPDATE` trigger) raises an exception on any
`role` change unless the caller is `service_role` or `fn_is_admin()` — see `decisions.md`
("Option B") for why admins get a direct path here instead of routing role changes
through an Edge Function.

A `profiles_public` view (`id`, `display_name`, `avatar_url`) is granted to
`authenticated` and `anon` for leaderboard/display use, since RLS can't restrict
individual columns on the base table.

---

## 2. Course content

### `courses`
Top-level content container: publishing state, pricing, access model, enrollment gating.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| slug | text | unique, not null | URL identifier, used by web and app routing |
| title | text | not null | |
| subtitle | text | nullable | Short line for cards/listings |
| description | text | nullable | Long form, markdown or HTML |
| thumbnail_url | text | nullable | |
| status | text | default `'draft'` | `'draft'`, `'published'`, `'archived'` |
| is_free | boolean | default false | |
| price_amount | int | nullable | Minor units (paise). Null when `is_free` |
| currency | text | default `'INR'` | |
| external_product_id | text | nullable, indexed | Maps an incoming webhook payload to this course |
| access_type | text | default `'lifetime'` | `'lifetime'` or `'fixed'` |
| access_duration_days | int | nullable | Required when `access_type = 'fixed'` |
| enrollment_status | text | default `'open'` | `'open'`, `'paused'`, `'closed'` |
| default_lesson_xp | int | default 10 | Fallback when a lesson has no `xp_reward` |
| gamification_enabled | boolean | default true | Not yet enforced in application logic — see `decisions.md` |
| total_students | int | default 0 | Cached count, trigger-maintained |
| total_lessons | int | default 0 | Cached count, trigger-maintained |
| created_by | uuid | FK → `profiles.id` | Must be an admin |
| published_at | timestamptz | nullable | |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

**Check constraint:** when `access_type = 'fixed'`, `access_duration_days` must be
`not null` and `> 0`. Prevents a course whose access expires immediately or never.

**Note:** `enrollment_status` is deliberately separate from `status`. A published
course can have enrollment paused while remaining fully usable to everyone already enrolled.

### `modules`
Optional grouping layer between course and lesson.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| course_id | uuid | FK → `courses.id`, cascade | |
| title | text | not null | |
| position | int | not null | Ordering within the course |
| created_at | timestamptz | default now() | |

### `lessons`
Content unit. `content_type` determines which content column is meaningful.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| course_id | uuid | FK → `courses.id`, cascade | Denormalised for direct course-scoped queries |
| module_id | uuid | FK → `modules.id`, nullable | Null for ungrouped lessons |
| slug | text | unique per course | |
| title | text | not null | |
| summary | text | nullable | |
| content_type | text | not null | `'video'`, `'text'`, `'quiz'`, `'game'` |
| video_url | text | nullable | Used when `content_type = 'video'` |
| content_html | text | nullable | Used when `content_type = 'text'` |
| game_id | uuid | FK → `games.id`, nullable | Used when `content_type = 'game'` |
| duration_seconds | int | nullable | Drives estimated time labels |
| xp_reward | int | nullable | Null inherits `courses.default_lesson_xp` |
| is_preview | boolean | default false | Viewable without enrollment |
| status | text | default `'draft'` | `'draft'` or `'published'` |
| position | int | not null | Ordering within module or course |
| created_at | timestamptz | default now() | |

**Effective XP formula:** `coalesce(lessons.xp_reward, courses.default_lesson_xp)`.
Expose this as a view or computed field — the client must never do this fallback itself.

### `games`
Registry for HTML/CSS/JS game bundles hosted on CDN.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| slug | text | unique, not null | |
| title | text | not null | |
| bundle_url | text | not null | CDN path to the zipped bundle |
| bundle_version | text | not null | Bumped on every asset change |
| bundle_size_bytes | bigint | not null | Shown as a download prompt on mobile data |
| checksum | text | not null | Integrity check after download |
| max_xp | int | default 0 | Ceiling on XP a single play can award |
| created_by | uuid | FK → `profiles.id` | |

⚠️ **`max_xp` is a server-side ceiling.** Games run in an iframe and post their own
score — an untrusted client could otherwise claim any XP total. Clamp the awarded
amount to this value inside the Edge Function that grades game completion.

---

## 3. Learner activity

### `enrollments`
Grants a user access to a course.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK → `profiles.id` | Unique with `course_id` |
| course_id | uuid | FK → `courses.id` | Unique with `user_id` |
| status | text | default `'active'` | `'active'`, `'expired'`, `'revoked'` |
| source | text | not null | `'purchase'`, `'manual'`, `'free'` |
| payment_id | uuid | FK → `payments.id`, nullable | Set when `source = 'purchase'` |
| enrolled_at | timestamptz | default now() | |
| expires_at | timestamptz | nullable | Null means lifetime access |

**Important:** compute `expires_at` **at insert time** from `courses.access_duration_days`
— do not read it live. If an admin later changes the course's duration, existing
learners keep the terms they enrolled under.

### `lesson_progress`
Per-user, per-lesson state.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK → `profiles.id` | Unique with `lesson_id` |
| lesson_id | uuid | FK → `lessons.id` | Unique with `user_id` |
| course_id | uuid | FK → `courses.id` | Denormalised for progress rollups |
| status | text | default `'not_started'` | `'not_started'`, `'in_progress'`, `'completed'` |
| progress_percent | int | default 0 | Video scrub position or game progress |
| completed_at | timestamptz | nullable | Set when status becomes `'completed'` |
| updated_at | timestamptz | default now() | |

The unique `(user_id, lesson_id)` constraint makes upsert safe **and** doubles as a
guard against awarding completion XP twice.

### `quiz_questions`
Questions belonging to a lesson whose `content_type = 'quiz'`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| lesson_id | uuid | FK → `lessons.id`, cascade | |
| prompt | text | not null | |
| options | jsonb | not null | Array of `{ id, text }` |
| correct_option | text | not null | Matches an option id |
| explanation | text | nullable | Shown after answering |
| position | int | not null | |

⚠️ **`correct_option` must never reach the client unstripped.** Either serve a view
that omits it for student reads, or grade exclusively server-side in an Edge
Function. Sending it to the browser makes every quiz trivially cheatable.

### `quiz_attempts`
One row per submission — every attempt is kept, not just the best score.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK → `profiles.id` | |
| lesson_id | uuid | FK → `lessons.id` | |
| score | int | not null | |
| max_score | int | not null | |
| passed | boolean | not null | |
| answers | jsonb | nullable | Submitted answers, for review |
| attempted_at | timestamptz | default now() | |

---

## 4. Commerce

### `payments`
Record of an external gateway purchase, received by webhook. **This table is the
idempotency boundary for the whole payment flow.**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK → `profiles.id`, nullable | Null if payment precedes signup |
| course_id | uuid | FK → `courses.id` | Resolved via `external_product_id` |
| provider | text | not null | Gateway name |
| provider_payment_id | text | unique, not null | Idempotency key for webhook retries |
| email | text | not null | Used to match a later signup |
| amount | int | not null | Minor units |
| currency | text | default `'INR'` | |
| status | text | not null | `'paid'`, `'refunded'`, `'failed'` |
| raw_payload | jsonb | not null | Full webhook body, for reconciliation |
| received_at | timestamptz | default now() | |
| reconciliation_status | text | default `'unresolved'` | `'unresolved'` or `'resolved'`. Admin-writable |
| reconciliation_note | text | nullable | Admin-writable |

**Admin writes are scoped, not open.** An admin can update only
`reconciliation_status` / `reconciliation_note` — `fn_guard_payment_admin_update()`
(a `BEFORE UPDATE` trigger) raises an exception if any other column changes outside
a `service_role` write. This is the "scoped reconciliation" approach in `decisions.md`:
admins can annotate a payment record, never rewrite what the gateway reported.

The unique constraint on `provider_payment_id` is the important one — gateways retry
webhooks on any non-2xx response, and sometimes deliver the same event twice anyway.
Without it, a single purchase can create duplicate enrollments.

**Pre-signup flow:** leave `user_id` null and match on `email`. When a new user
completes signup, look for unclaimed `paid` payments with that email and create
their enrollments at that point.

---

## 5. Gamification

### `xp_transactions`
Append-only ledger. **Never** updated, never deleted. Corrections are inserted as a
negative amount, keeping the audit trail intact.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK → `profiles.id` | |
| amount | int | not null | Negative permitted, for corrections |
| reason | text | not null | Human-readable label |
| source_type | text | not null | `'lesson'`, `'quiz'`, `'game'`, `'streak'`, `'manual'` |
| source_id | uuid | nullable | Id of the originating record |
| created_at | timestamptz | default now() | |

⚠️ **Add a unique index on `(user_id, source_type, source_id) WHERE source_id IS NOT NULL`.**
This is what makes the whole XP system safe against duplicate events from webhook
retries, double-tapped buttons, and games that post their completion message twice.

### `user_stats`
One row per user, maintained entirely by trigger on `xp_transactions` insert.
Publicly readable (for leaderboards), never client-writable.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| user_id | uuid | PK, FK → `profiles.id` | |
| total_xp | int | default 0 | Sum of `xp_transactions.amount` |
| level | int | default 1 | Derived from `total_xp` by formula |
| current_streak | int | default 0 | Consecutive active days |
| longest_streak | int | default 0 | Personal best, for badges |
| last_activity_date | date | nullable | Used to detect a broken streak |
| lessons_completed | int | default 0 | Cached count, for badge conditions |

### `badges`
Rule-based achievement definitions. Conditions are evaluated after each XP event,
not assigned by hand.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| slug | text | unique, not null | Stable identifier for code references |
| name | text | not null | |
| description | text | nullable | |
| icon_url | text | nullable | |
| condition_type | text | not null | `'lessons_completed'`, `'streak_days'`, `'total_xp'`, `'course_complete'` |
| condition_value | int | not null | Threshold that unlocks it |
| is_active | boolean | default true | Retire a badge without deleting history |
| created_by | uuid | FK → `profiles.id` | Admin only |

### `user_badges`
Which badges a user has unlocked, and when. Unique on `(user_id, badge_id)`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK → `profiles.id` | Unique with `badge_id` |
| badge_id | uuid | FK → `badges.id` | Unique with `user_id` |
| unlocked_at | timestamptz | default now() | |

---

## Trigger logic summary (implemented — see `business-logic.md` for full detail)

All of the below is live as of migrations 002–005, not planned.

0. `trg_auth_user_created` (`AFTER INSERT` on `auth.users`, calling
   `fn_handle_new_user()`) creates the matching `profiles` row for every signup,
   populating `display_name`/`phone_number` from `raw_user_meta_data` and hardcoding
   `role = 'student'`. Added in `005_auth_profile_trigger.sql`.
1. Any XP-earning event inserts one row into `xp_transactions`. The client never
   writes to `user_stats` directly — there is no client-facing write policy on
   `user_stats` at all.
2. `trg_xp_transactions_process` (`AFTER INSERT` on `xp_transactions`, calling
   `fn_process_xp_transaction()`) upserts `user_stats`: increments `total_xp`,
   recomputes `level` via `fn_compute_level()`, updates `current_streak`/
   `longest_streak` from `last_activity_date` compared to today.
3. `level` is derived from `total_xp` by `fn_compute_level()` — implemented as a
   **per-level threshold** (`level N` unlocks at `100 * N^1.5` total XP), recomputed
   on every rollup rather than stored independently. **Open question:** whether this
   should instead be a cumulative sum of thresholds — see `decisions.md`.
4. `fn_evaluate_badges()` runs after every XP rollup and after every
   `lesson_progress` row reaching `'completed'` (`trg_lesson_progress_completed`);
   any newly-qualifying badge is inserted into `user_badges`. The unique constraint
   there makes re-evaluation harmless.
5. `courses.total_students` and `courses.total_lessons` are trigger-maintained
   (`trg_enrollments_student_count`, `trg_lessons_lesson_count`) — see the
   ASSUMPTION notes in `002_functions_and_triggers.sql` on expiry/draft-lesson
   handling, both still open per `decisions.md`.
6. Game and quiz XP is intended to be awarded by an Edge Function, never directly
   from the client, and clamped to `games.max_xp` or the quiz maximum — **no Edge
   Function is deployed yet**, so this path doesn't exist in the live system.
7. `fn_is_admin()` is the single source of truth every admin-gated RLS policy calls
   into. Since migration 004, most admin writes (enrollments, manual XP awards,
   `profiles.role`, scoped payment reconciliation) go directly through RLS policies
   rather than requiring a `service_role` Edge Function — see `decisions.md` for why.
