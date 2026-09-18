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
  (`91392b37-91f1-4975-afda-e4c238c4d821`) is never deletable through the
  application** — UI and the `admin-user-management` Edge Function both
  refuse it. Deleting it would leave nobody able to reach the admin section
  at all. (The DB layer itself doesn't enforce this yet — see `state.md` —
  but nothing in the app is allowed to attempt it regardless.)
- **`admin-user-management`'s `verify_jwt` stays `true`.** The function does
  its own admin-role check on top, but that check assumes a verified JWT is
  already guaranteed by the platform — turning this off removes a layer the
  code doesn't re-implement itself.
- **`SUPABASE_SERVICE_ROLE_KEY` (and any future service-role credential) is
  never hardcoded in source** — read from the environment
  (`Deno.env.get(...)` in Edge Functions) only.
- **Manual enrollment and manual XP-award writes go straight through admin
  RLS from the client — no Edge Function, unlike account actions
  (create/update-email/update-password/delete), which require
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
- **On an *existing* payment, an admin can only ever change
  `reconciliation_status` and `reconciliation_note` — nothing else — and
  there is still no delete action for this table at all.**
  `fn_guard_payment_admin_update` (migration 004) raises an exception if any
  other column changes outside `service_role`, and no RLS policy grants
  admin delete on `payments`. This is deliberate, not an oversight to route
  around: a payment is the gateway's record of what actually happened, and
  an admin correcting it wholesale (re-linking it to a different user,
  changing the amount after the fact) would let the app's ledger silently
  diverge from the real transaction. A future "link this payment to a user"
  or delete action hits this trigger's exception or a missing RLS policy,
  not a permissions setting that can be loosened; the fix is never in the
  UI layer.
  **Superseded by migration 007:** an admin CAN now create a payment
  (`payments_admin_insert`, `FOR INSERT TO authenticated WITH CHECK
  (fn_is_admin())`) — but only ever through `fn_create_manual_order(...)`,
  never a bare `.insert()`. That function is the only thing allowed to
  decide `provider_payment_id` (system-generated, `'manual-' ||
  gen_random_uuid()`, never typed by an admin), `status` (always `'paid'` —
  a manual order records money already received, not a pending one), and
  `raw_payload`'s shape (`{manual_entry, entered_by, note}`, so a manually
  created row is unmistakable from a real gateway one at a glance). A UI or
  migration that adds a second, more direct way to insert a payment row
  reopens exactly the gap this function exists to close.
  **Superseded again by migration 009:** an admin CAN now also change
  `deleted_at` (`fn_guard_payment_admin_update`'s blocklist never named it,
  so this needed no loosening — just an updated error message), and a real
  `DELETE` is now possible, but ONLY when `deleted_at IS NOT NULL`
  (`payments_admin_delete_from_trash`) — an admin still cannot delete or
  otherwise remove an active payment. See the dedicated trash/soft-delete
  invariant below for the full shape of this.
- **A sortable list's reorder mutation fires exactly once, in `onDragEnd`,
  never in `onDragOver`/`onDragMove`.** dnd-kit already gives the live,
  in-progress reordering preview for free from client-side sensor state — no
  write, network round-trip, or cache update should happen until the drop.
  A mutation firing per pointer-move was the first thing checked (and ruled
  out) when curriculum drag-and-drop shipped visibly janky; the actual
  defect turned out to be the opposite gap — no optimistic cache update *at*
  drop — but the "write only on drop" half of this was already correct and
  must stay that way. Pair this with `ui.md`'s `<DragOverlay>` +
  optimistic-`onMutate` pattern for the next sortable list (Games, once that
  page exists) — one without the other still janks.
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
- **Courses are never hard-deleted from the admin UI — archive only.** The FK
  behaviour is mixed and dangerous in both directions: `modules.course_id` and
  `lessons.course_id` are `ON DELETE CASCADE` (a delete silently destroys all
  content beneath the course), while `payments.course_id`,
  `enrollments.course_id` and `lesson_progress.course_id` are `NO ACTION` (the
  delete fails with a raw FK error the moment any transaction history exists).
  RLS permits the delete; that is not a reason to expose one.
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
- **`payments.deleted_at` (migration 009) is the ONLY soft-delete column in
  this schema — deliberately scoped to `payments` alone, not a precedent to
  generalize to courses/games/lessons/anything else.** It exists because
  payments are real financial records where an admin wanting them out of the
  active list and KPI totals still shouldn't risk an irreversible mistake —
  courses and games already have their own, different removal stories
  (archive-only for courses; real hard delete with an FK-count check for
  games) that solve the same underlying "don't lose data by accident"
  problem without a second pattern. A future table reaching for a
  `deleted_at` column "because payments has one" needs its own version of
  this exact reasoning, not a copy-paste of the column. The actual
  enforcement that a payment can't be hard-deleted while still active lives
  in RLS (`payments_admin_delete_from_trash`, `USING (fn_is_admin() AND
  deleted_at IS NOT NULL)`), at the database level — not in the UI only
  offering "Delete Permanently" from the Trash view. A UI-only version of
  this restriction would be bypassable by any client calling the REST API
  directly; the RLS policy is what actually makes that impossible, verified
  live via a direct authenticated REST call against an active row.
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
- **TypeScript only — no new `.js`/`.jsx` files.**
- **npm only — no pnpm/yarn/bun lockfile is ever committed.**
- **No actual env value is ever written into `env-deploy.md`** (or any
  committed file) — names only. Real values live in gitignored `.env` files.
