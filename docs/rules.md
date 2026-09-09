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
- **TypeScript only — no new `.js`/`.jsx` files.**
- **npm only — no pnpm/yarn/bun lockfile is ever committed.**
- **No actual env value is ever written into `env-deploy.md`** (or any
  committed file) — names only. Real values live in gitignored `.env` files.
