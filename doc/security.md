# Security

Row Level Security policy per table, as applied in
`supabase/migrations/003_rls_policies.sql` and `004_admin_scoped_writes.sql`. RLS is
enabled on all 14 tables (`001_initial_schema.sql`) — before 003 landed, every table
was deny-all by default.

`fn_is_admin()` (`security definer`, checks `profiles.role = 'admin'` for
`auth.uid()`) is the single check every admin-gated policy below calls into. Service
role policies are documentation, not enforcement — the Supabase `service_role` key
bypasses RLS entirely regardless of what's written here — but stating the intent
keeps the access model self-explanatory from the SQL alone.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | self or admin | — (created via auth signup, not a policy) | self (own row) or admin (any row, `role` changes guarded — see below) | — |
| `courses` | `status = 'published'` or admin | admin | admin | admin |
| `modules` | actively-enrolled user or admin | admin | admin | admin |
| `lessons` | `is_preview`, actively-enrolled user, or admin | admin | admin | admin |
| `games` | any authenticated user or admin | admin | admin | admin |
| `quiz_questions` | admin only (base table) | admin | admin | admin |
| `quiz_questions_public` (view) | admin, `is_preview` lessons, or actively-enrolled user | n/a | n/a | n/a |
| `quiz_attempts` | self or admin | `service_role` only | — | — |
| `enrollments` | self or admin | `service_role` or admin | `service_role` or admin | `service_role` or admin |
| `lesson_progress` | self or admin | self | self | — |
| `payments` | self or admin | `service_role` only | `service_role` (any column) or admin (scoped — see below) | — |
| `xp_transactions` | self or admin | `service_role`, or admin **when `source_type = 'manual'`** | — | — |
| `user_stats` | public (`true`) | — | — | — |
| `badges` | any authenticated user or admin | admin | admin | admin |
| `user_badges` | public (`true`) | `service_role` only | — | — |

Blank cells mean no policy exists for that operation — RLS defaults to deny, so
that operation is impossible for any client-side role (`anon` / `authenticated`).
`user_stats` and `user_badges` have **no client write policy for any role**, `anon`
included; only the `security definer` trigger functions
(`fn_process_xp_transaction`, `fn_evaluate_badges`, `fn_update_lessons_completed`)
can write them.

## Notable guards beyond the policy table

- **`profiles.role` self-promotion.** `fn_prevent_role_change()`
  (`BEFORE UPDATE` on `profiles`) raises an exception if `role` changes and the
  caller is neither `service_role` nor `fn_is_admin()`. This is a trigger guard,
  not an RLS policy — RLS can permit the row update (`profiles_update_self`) while
  the trigger still blocks the specific column change.
- **Column-scoped admin writes on `payments`.** `fn_guard_payment_admin_update()`
  (`BEFORE UPDATE`) raises an exception if any column other than
  `reconciliation_status` / `reconciliation_note` changes, unless the caller is
  `service_role`. RLS (`payments_admin_update`) says an admin *may* update the row;
  the trigger narrows *what* they can change within it.
- **`profiles_public`** and **`quiz_questions_public`** are views, not tables — RLS
  doesn't apply to them directly. `profiles_public` is a plain `select`-granted view
  (no row filtering needed, it only exposes non-sensitive columns).
  `quiz_questions_public` embeds its own row filter (`fn_is_admin()`, `is_preview`,
  or active enrollment) directly in the view definition, since it needs
  `correct_option` stripped, which a table-level policy can't do.
- **Two `SELECT` layers on `quiz_questions`.** The base table's own `SELECT` policy
  is admin-only. A student never queries `quiz_questions` directly — the app must
  always route student reads through `quiz_questions_public`.

## Known gaps / not yet enforced

- No RLS policy or trigger reads `courses.gamification_enabled` — see
  `business-logic.md`.
- Nothing currently authenticates or authorizes the payment webhook itself (that's
  an Edge Function concern, not deployed yet) — RLS only governs what happens once
  a request reaches Postgres already carrying the `service_role` key.
