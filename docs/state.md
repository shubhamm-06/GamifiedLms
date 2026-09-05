# State

Living document — rewritten as reality changes, not appended to. Accurate as
of the last commit on `master` (`4a8c2e2`) plus one live-verified fact below.
No remote is configured; nothing has been pushed anywhere.

## Current WIP

Migrated the documentation system from a single `PROJECT_CONTEXT.md` file to
the `docs/` + root `CLAUDE.md` structure this file lives in (2026-09-05).
`PROJECT_CONTEXT.md` and the old `doc/` folder are retired — see
`changelog.md`. No application code changed as part of this.

## Verified but not yet reflected anywhere else

`admin-user-management` **is deployed and ACTIVE** on the live project
(version 1, `verify_jwt: true`, created 2026-09-02 07:38:49 UTC — confirmed
live via `Supabase:list_edge_functions` on 2026-09-05). The prior session's
attempt to deploy it failed (MCP disconnected, no CLI token), so this
happened through some other path — dashboard, a different session, or the
user directly. **The four privileged actions it backs (create / change-email
/ reset-password / delete) have never been tested end-to-end against the
deployed function** — everything tested so far was either the read path, a
plain profile edit, or a call that failed before deployment. That's the
immediate next step, not a "some day" item.

## Blockers

None currently. (The Edge Function deployment blocker from 2026-09-02/03 is
resolved — see above.)

## Next steps, roughly in order

1. Smoke-test all four `admin-user-management` actions against the live,
   now-deployed function (create, change email, reset password, delete) with
   a throwaway account — this has never actually happened.
2. Add the DB-level guard against deleting the primary admin
   (`91392b37-91f1-4975-afda-e4c238c4d821`) — UI and Edge Function both
   refuse it already, but a direct `service_role`/dashboard delete or an
   `auth.users` cascade still isn't stopped at the database layer.
3. Build a real `AdminLayout` (nav/sidebar/chrome) — each admin page
   currently renders standalone; `/admin` just redirects to `/admin/users`.
4. Move on to courses/modules/lessons CRUD (next unbuilt admin domain).

## Known shortcuts / tech debt

- **First-admin "can never be deleted"** — enforced at the UI and Edge
  Function layers only; no DB-level trigger/constraint yet (next step #2).
- **`total_students`** decrements on any transition away from `'active'`
  (including `'expired'`) — this is what the trigger code actually does, but
  its own inline SQL comment claims otherwise. Not a bug, just a
  stale/wrong comment, and an open product question (should expiry still
  count as a "student"?).
- **`total_lessons`** counts draft + published lessons, not published-only —
  undecided whether that's correct for the admin-facing count.
- **Quiz pass threshold isn't stored anywhere** — `quiz_attempts.passed` is
  set by whatever grades the attempt, but no `lessons`/`quiz_questions`
  column holds a threshold for a future grading function to read. Needs a
  schema decision before quiz authoring/grading is built.
- **`courses.gamification_enabled`** is unenforced everywhere (unlike
  `badges.is_active`, which `fn_evaluate_badges` does check).
- **Level formula** (`fn_compute_level`) implements a per-level XP threshold
  (`100 * N^1.5`); whether it should instead be a cumulative sum of
  thresholds is still open.
- **Capacitor session handling** hasn't been audited — auth currently relies
  on supabase-js's default browser storage, untested in a Capacitor webview.
- **No Edge Function exists yet** for quiz grading, game XP clamping, the
  payment webhook receiver, or pre-signup payment claiming — all designed
  for server-side enforcement in the schema/RLS, none written.
- **No native Capacitor platforms and no CI** exist yet.
