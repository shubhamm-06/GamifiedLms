# Rules

Hard invariants only. Every line here must pass: "would violating this break
something critical?" — if the honest answer is "it'd be non-ideal," it
belongs in `context.md` or `state.md`, not here.

- **Migrations are written to `supabase/migrations/` first, applied second.**
  Never edit the live schema directly from the Supabase dashboard. The repo
  is the source of truth for schema; a live-only change is invisible to
  everyone else and to every future session.
- **`src/lib/database.types.ts` is regenerated and committed every time a
  migration is applied.** A stale types file lies about the schema silently
  — treat it as a build-breaking bug, not a nice-to-have.
- **`profiles.role` is never client-writable except through
  `fn_is_admin()`-gated paths.** Any new write path to this column must go
  through the existing RLS policy + `fn_prevent_role_change` guard, or a
  student can self-promote to admin.
- **`quiz_questions.correct_option` must never reach a non-admin client.**
  Student reads go through `quiz_questions_public` only, never the base
  table.
- **The primary admin account
  (`91392b37-91f1-4975-afda-e4c238c4d821`) is never trashable or deletable
  through the application** — UI and the `admin-user-management` Edge
  Function both refuse it. Losing it would leave nobody able to reach the
  admin section at all. (The DB layer itself doesn't enforce this yet — see
  `state.md` — but nothing in the app is allowed to attempt it regardless.)
- **An admin can never trash or delete themselves, and the last remaining
  non-trashed admin can never be trashed or deleted — enforced in the
  `admin-user-management` Edge Function, not only the UI.** The guards apply
  to both `trash` and `delete`, and the caller must themselves be a
  non-trashed admin (a trashed admin's token stays valid until it expires).
- **`admin-user-management`'s `verify_jwt` stays `true`.** The function does
  its own admin-role check on top, but that check assumes a verified JWT is
  already guaranteed by the platform — turning this off removes a layer the
  code doesn't re-implement itself.
- **`SUPABASE_SERVICE_ROLE_KEY` (and any future service-role credential) is
  never hardcoded in source** — read from the environment
  (`Deno.env.get(...)` in Edge Functions) only.
- **Manual enrollment and manual XP-award writes go straight through admin
  RLS from the client — no Edge Function, unlike account actions
  (create/update-email/update-password/trash/restore/delete), which require
  `service_role` and therefore must go through `admin-user-management`.**
  The distinction is what the write needs: creating an `auth.users` row or
  changing someone's login credentials needs privileges only `service_role`
  has; inserting an `enrollments` or `xp_transactions` row is an ordinary
  table write already permitted to an admin caller by
  `enrollments_admin_insert`/`enrollments_admin_update` and
  `xp_transactions_admin_manual_insert` (migration 004). Routing either of
  those through a function hop would be paying an unnecessary round-trip for
  a permission the caller already has. `xp_transactions_admin_manual_insert`
  specifically ties its `WITH CHECK` to `source_type = 'manual'`, so this
  path can never be used to spoof a `'lesson'/'quiz'/'game'` award — that
  constraint is what makes the direct-write shortcut safe, and any new admin
  write path onto this table must keep the same `source_type` pin rather
  than widening it.
- **`xp_transactions` manual awards are not deduped by the database.** The
  dedupe unique index (`uq_xp_transactions_dedupe`) only applies `WHERE
  source_id IS NOT NULL`, and manual awards always insert `source_id = NULL`
  — a double-submitted award is a double award, silently. The only guard is
  disabling the submit button while the mutation is in flight
  (`AwardXpForm.tsx`); this was judged sufficient for a low-frequency admin
  action rather than adding schema-level dedup, but any new manual-award
  entry point must keep that disable, not skip it.
- **There are now two independent implementations of the `expires_at`
  formula — one client-side TypeScript (`useEnrollUser` in
  `useUserDetail.ts`, for manual enroll), one server-side SQL
  (`fn_create_manual_order`, migration 007, for a manual order) — and they
  must be kept in sync BY HAND.** They cannot share code: one runs in the
  browser, the other inside Postgres, and there is no third place either
  could call into without adding a network hop neither operation needs. The
  rule both must follow: `access_type = 'fixed'` and a non-null
  `access_duration_days` computes `now() + N days`; anything else (including
  a `'fixed'` course with a null duration) is `null` — lifetime. Changing
  this rule in one place without the other means a manually-enrolled and a
  manually-ordered student on the same course silently end up with different
  access windows.
- **On an *existing* payment, an admin can only change
  `reconciliation_status`, `reconciliation_note` and `deleted_at` — no other
  column — and can only hard-delete a payment that is already in the Trash.**
  `fn_guard_payment_admin_update` raises an exception if any other column
  changes outside `service_role`, and the only admin `DELETE` policy on
  `payments` is `payments_admin_delete_from_trash` (`USING (fn_is_admin() AND
  deleted_at IS NOT NULL)`), so an active payment cannot be deleted. This is
  deliberate, not an oversight to route around: a payment is the record of
  what actually happened (a gateway's, or an admin's entry for an offline
  payment), and an admin correcting it wholesale (re-linking it to a
  different user, changing the amount after the fact) would let the app's
  ledger silently diverge from the real transaction. A future "link this
  payment to a user" action hits this trigger's exception, not a permissions
  setting that can be loosened; the fix is never in the UI layer. See the
  trash/soft-delete invariant below for `deleted_at` itself.
- **An admin creates a payment only through `fn_create_manual_order(...)`,
  never a bare `.insert()`.** `payments_admin_insert` (migration 007, `FOR
  INSERT TO authenticated WITH CHECK (fn_is_admin())`) does permit a bare
  insert at the RLS layer, so this is an application-code invariant, not
  something the database enforces. The function is the only thing allowed to
  decide `provider_payment_id` (system-generated, `'manual-' ||
  gen_random_uuid()`, never typed by an admin), `status` (always `'paid'` —
  a manual order records money already received, not a pending one), and
  `raw_payload`'s shape (`{manual_entry, entered_by, note}`, so a manually
  created row is unmistakable from a real gateway one at a glance). A UI or
  migration that adds a second, more direct way to insert a payment row
  reopens exactly the gap this function exists to close.
- **A sortable list's reorder mutation fires exactly once, in `onDragEnd`,
  never in `onDragOver`/`onDragMove`.** dnd-kit already gives the live,
  in-progress reordering preview for free from client-side sensor state — no
  write, network round-trip, or cache update should happen until the drop.
  A mutation firing per pointer-move was the first thing checked (and ruled
  out) when curriculum drag-and-drop shipped visibly janky; the actual
  defect turned out to be the opposite gap — no optimistic cache update *at*
  drop — but the "write only on drop" half of this was already correct and
  must stay that way. Pair this with `ui.md`'s `<DragOverlay>` +
  optimistic-`onMutate` pattern for the next sortable list — one without the
  other still janks.
- **`lessons.position` is scoped per container (`module_id`, with NULL —
  Ungrouped — as its own container), not per course, and nothing in Postgres
  enforces it.** There is no unique constraint and no trigger; two lessons in
  different topics legitimately share `position = 0`, and the live data
  already does. The convention exists only in application code, so anything
  writing `position` must renumber a whole container from 0 rather than
  nudging one row, and any future query that assumes course-wide uniqueness
  (or orders lessons course-wide without grouping by `module_id` first) is
  wrong by construction. A drag that moves a lesson between topics has to
  write both containers' renumbering *and* the new `module_id` in the same
  mutation — a partial write leaves duplicate or gapped positions that
  nothing will detect, because no constraint is watching.
- **Curriculum reorder interactions use zero animation, by deliberate product
  decision — do not reintroduce transitions to "smooth" this later.** Both
  `LessonRow` and `ModuleCard` set `useSortable({ transition: null,
  animateLayoutChanges: () => false })`, and every `<DragOverlay>` sets
  `dropAnimation={null} transition={() => undefined}` (the second prop is
  necessary too — dnd-kit defaults the overlay's own `transition` to
  `'transform 250ms ease'` for keyboard-activated drags specifically, even
  with `dropAnimation` off). An item is in the old position, then the new
  one, with no visible in-between state, on every activation path (pointer
  and keyboard) and at every stage (mid-drag, on drop, on overlay release).
  A future pass adding easing back in to make reordering "feel nicer" would
  be reverting a considered choice, not fixing an oversight.
- **Test accounts are created by direct SQL, never through `signUp` or
  `inviteUser`.** Those paths send a real transactional email every time,
  against a shared quota, for an account that exists only for a few minutes
  of verification. Insert into `auth.users` with
  `extensions.crypt(pw, extensions.gen_salt('bf'))`, a matching
  `auth.identities` row (`provider = 'email'`, `provider_id = user_id::text`),
  and `email_confirmed_at = now()`. **Also set
  `confirmation_token`, `recovery_token`, `email_change`,
  `email_change_token_new`, `email_change_token_current`, `phone_change`,
  `phone_change_token` and `reauthentication_token` to `''`** — GoTrue scans
  those columns into non-nullable strings, and a `NULL` left by a hand-written
  insert makes every login fail with "Database error querying schema". Reuse
  one account across checks rather than making a fresh one per check, and
  delete it via SQL afterwards.
- **A lesson delete that fails with Postgres `23503` is reported as student
  activity, never as a generic error.** `lesson_progress.lesson_id` and
  `quiz_attempts.lesson_id` are `NO ACTION`, so the database refuses the
  delete the moment any student has touched the lesson. Surfacing the raw FK
  violation would read as a bug rather than as the intended protection, and
  the admin would have no idea that unpublishing is the way out.
- **A course is permanently deleted only from the Trash, and only when
  `fn_course_delete_blockers` reports nothing referencing it — otherwise it
  stays in Trash (or is archived).** The FK behaviour is mixed and dangerous
  in both directions: `modules.course_id` and `lessons.course_id` are `ON
  DELETE CASCADE` (a delete silently destroys all content beneath the
  course), while `payments.course_id`, `enrollments.course_id` and
  `lesson_progress.course_id` are `NO ACTION` (the delete fails with a raw FK
  error the moment any transaction history exists). Lesson-sourced
  `xp_transactions` have no FK to the course, so that check is an application
  rule the database will not catch. `archived` is a separate status,
  independent of trash.
- **`published_at` is set once, on first publish, and never overwritten.** No
  trigger maintains it — the UI owns it, and only stamps it when it is still
  null. Re-publishing after an archive must preserve the original
  first-published date, so any new code path that publishes a course has to
  carry the same guard.
- **`lessons.video_url` never stores raw `<iframe>`/HTML embed code.** The
  Embed-link input only ever extracts a YouTube/Vimeo video id via regex
  (`src/lib/video.ts`) and writes back a plain reconstructed URL — never the
  pasted string itself. Storing raw markup here is a stored-XSS hole the
  moment any future renderer uses `dangerouslySetInnerHTML` on this column.
- **Monetary integer columns store WHOLE RUPEES, not paise.**
  `payments.amount = 1499` means ₹1,499. Neither column documents a unit, so
  this is a decision the codebase now depends on: anything writing money —
  above all a future payment-gateway webhook — must convert to whole units
  first. A writer that stores paise makes every amount on screen wrong by
  100x, silently.
- **Every monetary value in the UI renders through `formatAmount`
  (`src/lib/currency.ts`).** No inline `₹`, no ad-hoc `toLocaleString` at call
  sites. It's the single swap point if the unit or presentation ever changes;
  bypassing it means a future change silently misses that call site.
- **No new color token is added outside the locked set in `ui.md` without
  updating that file first.** An undocumented one-off color silently
  fragments the design system. Hardcoded hex values are never acceptable —
  the tokens are exposed as Tailwind utilities for exactly this reason.
- **`payments.provider` is plain free text — it is never made a foreign key
  to `manual_order_providers` (migration 008).** That table only sources the
  Add Order / Import CSV provider dropdown's options; nothing at the DB level
  enforces that a payment's `provider` value matches an active (or even
  existing) row there. This is the same "let the admin type freely" call
  made when `payments_admin_insert` was added (migration 007) — the dropdown
  standardizes labels for new entries, it doesn't reverse that decision. A
  future pass adding a `REFERENCES manual_order_providers(label)` constraint
  would break the moment a provider row is deactivated (existing payments
  keep the old label as a text snapshot, by design) or renamed, and would
  reintroduce exactly the rigidity the free-text column was chosen to avoid.
- **`payments.deleted_at` (migration 009) is its own mechanism, separate
  from the migration-013 trash-first columns (no `deleted_by`, no parent
  hiding), and a table outside those two sets does not get a `deleted_at`
  without its own reasoning.** It exists because payments are real financial
  records where an admin wanting them out of the active list and KPI totals
  still shouldn't risk an irreversible mistake. A future table reaching for a
  `deleted_at` column "because those have one" needs its own version of this
  reasoning, not a copy-paste of the column. The actual
  enforcement that a payment can't be hard-deleted while still active lives
  in RLS (`payments_admin_delete_from_trash`, `USING (fn_is_admin() AND
  deleted_at IS NOT NULL)`), at the database level — not in the UI only
  offering "Delete Permanently" from the Trash view. A UI-only version of
  this restriction would be bypassable by any client calling the REST API
  directly; the RLS policy is what actually makes that impossible, verified
  live via a direct authenticated REST call against an active row.
- **Trash-first: no admin action removes a course, module, lesson, game,
  badge or user row directly — every "delete" is "move to trash", and a
  permanent delete only applies to a row that is already trashed.** For the
  five content tables that is enforced by RLS (`*_admin_delete` is `USING
  (fn_is_admin() AND deleted_at IS NOT NULL)`), so a bare REST `DELETE` on a
  live row affects zero rows; for users it is the Edge Function's `delete`
  action refusing anything not trashed. (Payments keep their own older trash;
  `xp_transactions`, `enrollments` and `quiz_questions` are out of scope and
  keep their current behaviour.) Permanent delete never changes FK behaviour —
  it is refused wherever a `NO ACTION` FK says so.
- **Trashing a parent hides its children through the parent; it never marks
  the child rows.** Every non-admin read path (policies, views, and the
  gamification/counter functions) must treat a lesson as live only when the
  lesson, its module and its course are all not trashed. A new read path over
  `modules`/`lessons` that checks only `deleted_at` on the row itself leaks
  content the admin trashed. The one exception is
  `fn_delete_module_permanently`, which trashes a module's still-live lessons
  before deleting the module so the unchanged `lessons.module_id ON DELETE SET
  NULL` cannot resurrect them — never delete a trashed module by any other
  route.
- **Restoring anything whose parent is trashed is blocked, not cascaded** —
  restore the parent first (`fn_restore_blockers` names the trashed ancestor).
  Silently restoring a course would un-hide its entire subtree, including rows
  that were trashed on their own.
- **`profiles.deleted_at`/`deleted_by` are written only by the
  `admin-user-management` Edge Function (service_role); a client can never
  change them, and `deleted_by` on every trash-first table is stamped from the
  verified caller, never taken from a client-supplied value.** Trashing a user
  is three things together — flag the profile, ban the auth user, revoke
  sessions — and a client-side write to the flag alone would skip the ban and
  every guard. The enforcement is the `fn_guard_profile_trash_columns` and
  `fn_stamp_deleted_by` triggers.
- **Trashed content must not earn XP or badges, and a trashed user must not
  count toward `courses.total_students`.** `fn_award_lesson_xp`,
  `fn_update_lessons_completed` and `fn_evaluate_badges` skip trashed
  lessons/modules/courses/badges, and the counters use the same "live"
  definition. A new function that awards XP or counts learners must use
  `fn_lesson_is_live` / `fn_user_is_trashed` (or the same predicates), not a
  narrower one of its own.
- **Every admin list table uses the shared multi-select kit
  (`components/admin/selection/`) — no table ships without it.** That is the
  leading checkbox column, a header checkbox scoped to the current page (with
  an indeterminate state), "Select all N matching" for the whole filtered set,
  selection that persists across pagination and clears when the search or a
  filter changes, and a sticky `BulkActionBar` ("N selected", Clear, the
  page's context actions). Selection is keyed by the real row id (`getRowId`),
  never the index. Payments/orders get selection with their existing actions
  and no new delete. Bulk actions run per item and report partial failures
  ("8 moved, 2 failed" with reasons); one failure must never abort the rest.
  In the course editor the drag handle stays a separate element from the
  checkbox, and reorder stays zero-animation. The one exception is a read-only
  report table whose rows are not records anyone can act on (the Dashboard's
  recent-activity feed; the import dialog's preview and results tables).
- **A soft-delete, restore or other RLS-filterable write must confirm its
  affected row count — request `.select('id')` and treat a count other than the
  number requested as a failure, never as success.** RLS filters a write the
  caller may not make (or a row already in the target state) to zero rows and
  returns NO error, so a hook that only checks `error` reports success for
  something that never happened — which is exactly how the old Delete buttons
  behaved once migration 013 made deletes trash-only. `lib/trash.ts` and
  `lib/permanentDelete.ts` do this per item.
- **Only `lib/permanentDelete.ts`, imported only by the Trash page, may call
  `.delete()` on a trash-first table or invoke the Edge Function's `delete`
  action.** Every other delete path in the admin UI is `lib/trash.ts`
  (a soft delete). A new "Delete" button on a course, module, lesson, game,
  badge or user is a bug — it must be "Move to trash".
- **CSV import only ever creates students, and only ever creates.** The
  `bulk_create` action produces `role = 'student'` (`fn_handle_new_user`
  hardcodes it); there is no role input, and a `role` column in an uploaded
  file is ignored with a warning. Admin accounts come only from Add user. An
  email that already belongs to any account — active or trashed — is skipped:
  import never updates, overwrites, restores or promotes an existing account.
  The server re-validates every row and re-checks existing and trashed emails;
  the client's preview is advisory, never trusted.
- **A password — supplied or generated — is never logged, toasted, put in an
  error message, cached or stored.** `bulk_create` and the import hook write
  no row, password or Auth error object to any console (only row indexes and
  error codes). A generated password exists only in the `bulk_create` response
  to the calling admin (`Cache-Control: no-store`) and in the import dialog's
  memory until it closes; the results CSV is built on demand from that memory
  and never persisted.
- **Every account is created inside the `admin-user-management` Edge Function,
  through its one `createAuthUser` helper** (`create` and `bulk_create` both
  use it, so they cannot drift — email confirmed, `display_name` in user
  metadata for the signup trigger). Nothing in the client creates an `auth`
  user.
- **KNOWN LIMITATION — the database still accepts an admin-created order for
  a trashed course.** `fn_create_manual_order` (payment logic, deliberately
  untouched by migration 013) does not check `courses.deleted_at`; only the
  client filters trashed courses out of the Add Order picker and the CSV
  import's slug lookup. Anything else that inserts a payment or enrollment for
  a course must check the course is live itself until this is closed.
- **A singleton config table enforces "exactly one row" by omitting the
  INSERT policy entirely, not by a CHECK constraint or a fixed-value PK
  trick.** `app_settings` (migration 010) is the first and, so far, only
  table shaped this way: one row, seeded by the migration itself (which
  runs outside RLS), and no INSERT policy for any client role — so a
  second row can never be created through the app. No DELETE policy either,
  since nothing should be able to remove the one row config depends on.
  Verified live, not assumed: even an admin's direct `INSERT` against the
  REST API is refused with a `42501` RLS violation. Reach for this exact
  shape (public or admin-scoped SELECT, admin-only UPDATE, no INSERT/DELETE
  policy at all, migration seeds the one row) for the next genuinely
  singleton config table, rather than inventing a new mechanism — but it
  only fits a table that really is one global row; don't reach for it for
  something that's actually a list with exactly one entry today.
- **`courses.currency` and `payments.currency` stay plain text, NOT foreign
  keys to `currencies` (migration 011) — explicitly out of scope, not an
  oversight.** `app_settings.default_currency` is FK'd to `currencies(code)`
  because it's a single admin-set value; `courses.currency`/
  `payments.currency` are per-row values written by existing paths
  (`CourseForm.tsx`'s create/edit submit, `fn_create_manual_order`'s insert)
  that would all need updating to validate against this table, which is
  real additional scope beyond "manage a settings list" — see `state.md`
  for the flagged follow-on. Don't "fix" this into a constraint without
  first working through what happens to a course/payment already carrying
  a currency code that later gets deleted from `currencies` (nothing
  prevents that today, since nothing references those two columns).
- **`manual_order_providers` and `currencies` are true hard deletes, not
  deactivate-only** — verify the live RLS policy grants admin `DELETE`
  before assuming a table's delete story from a stale doc or how a sibling
  table works. `schema.md` incorrectly claimed for a while that
  `manual_order_providers` had "no delete policy," when the migration had
  granted one since it was written; the fix was to re-check `pg_policy`
  directly, not to trust the existing prose. Both tables are safe to
  hard-delete from because nothing else in the schema has a FK to
  `manual_order_providers.id` or (aside from `app_settings.default_currency`,
  which the FK itself blocks) `currencies.code` — confirm that's still true
  before adding delete to the next config table, rather than assuming it
  transfers.
- **`level_thresholds.xp_required` must stay strictly increasing by `level`
  — enforced by `trg_level_thresholds_validate` in the database, never only
  in the UI (migration 012).** A misordered table makes
  `fn_compute_level` return confusing levels for real students, so the admin
  page's client-side check is deliberately just fast feedback in front of the
  trigger. Any path that writes this table (service role, SQL, a future
  import) hits the same trigger. **Level 1 is the one deliberate exception to
  "DB enforces it":** its "must exist, must stay 0 XP" rule lives only in the
  admin UI (field disabled, no delete button) because special-casing it in the
  trigger was judged not worth fighting SQL for. Anything writing
  `level_thresholds` outside that UI must keep level 1 present at 0 itself;
  `fn_compute_level` degrades to level 1 rather than erroring if it doesn't.
- **`fn_compute_level` is `STABLE` and must never be marked `IMMUTABLE`
  again.** It reads `level_thresholds`; an `IMMUTABLE` marker on a function
  whose answer depends on table contents lets the planner cache a stale level
  — quietly wrong, not a cosmetic leftover. Same goes for any future function
  that reads config tables.
- **The lesson-completion XP award has exactly one path:
  `fn_award_lesson_xp` — and its two easy-to-get-wrong rules are hard
  invariants.** (1) `lessons.xp_reward` of `0` means "no XP" and only `NULL`
  falls back to `courses.default_lesson_xp` — never `coalesce(nullif(x, 0),
  ...)`-style shortcuts that would treat 0 as unset; a `<= 0` amount inserts
  no `xp_transactions` row at all (a 0-amount row still runs the rollup,
  bumping the streak, and burns the dedupe slot). (2) Its `ON CONFLICT` must
  carry the `WHERE source_id IS NOT NULL` predicate matching the partial
  dedupe index `uq_xp_transactions_dedupe` — a bare column list fails with
  `42P10`.
- **`courses.gamification_enabled = false` disables lesson XP ONLY — do not
  assume it turns off gamification wholesale.** `fn_update_lessons_completed`
  (the `lessons_completed` counter bump) and the badge evaluation it triggers
  are not gated on it, so a gamification-off course still increments
  `user_stats.lessons_completed` and can still unlock
  `lessons_completed`/`course_complete` badges. This was flagged, verified
  live, and deliberately left unfixed when the XP award landed (fixing it means
  deciding what "gamification off" should mean for badges, a product call) —
  see `state.md`. Nothing may rely on "gamification off ⇒ no gamification
  side effects" until that's resolved.
- **TypeScript only — no new `.js`/`.jsx` files.**
- **npm only — no pnpm/yarn/bun lockfile is ever committed.**
- **No actual env value is ever written into `env-deploy.md`** (or any
  committed file) — names only. Real values live in gitignored `.env` files.
