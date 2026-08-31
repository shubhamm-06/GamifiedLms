# Gamified LMS — Project Docs

This folder is the source of truth for the project. An AI agent or new developer
should be able to read these files and understand the entire system — data model,
business rules, security model, and open questions — without reading any code.

**Read in this order:**

1. [`overview.md`](./overview.md) — what this product is, stack, current status
2. [`schema.md`](./schema.md) — full database schema, every table and column
3. [`business-logic.md`](./business-logic.md) — how XP, payments, enrollment, and grading actually work
4. [`security.md`](./security.md) — Row Level Security policy per table, and why
5. [`decisions.md`](./decisions.md) — open product decisions not yet resolved, and a log of resolved ones

**Rule for maintaining these docs:** any schema change, RLS policy change, or business-rule
change must update the relevant file in this folder in the same PR/session as the code change.
If a doc and the code disagree, the code is probably wrong — these docs are the spec.

## Current status (as of 2026-08-31)

- Supabase project provisioned: `Gamified LMS` (ref `dmmvftodhcdbubuljqme`, ap-northeast-1, Postgres 17)
- Schema: **applied**. Four migrations are live and tracked in `supabase/migrations/`:
  1. `001_initial_schema` — 14 tables, RLS enabled (deny-all) on every one, plus the
     `lesson_effective_xp` and `quiz_questions_public` views.
  2. `002_functions_and_triggers` — `fn_is_admin()`, XP/level/streak rollup, badge
     evaluation, course counters, the `profiles.role` write guard.
  3. `003_rls_policies` — the full access-matrix policy set, plus the `profiles_public`
     view and the gated `quiz_questions_public` view.
  4. `004_admin_scoped_writes` — lets admins write `enrollments`, insert `manual`
     `xp_transactions`, and change `profiles.role` directly (previously service-role
     only); adds scoped `payments` reconciliation fields (`reconciliation_status`,
     `reconciliation_note`) with a guard trigger so an admin update can't touch the
     gateway-owned columns.

  See `schema.md` for the full table reference and `decisions.md` for why 004 exists.
- No Edge Functions deployed yet.
- Frontend: React + TypeScript + Capacitor scaffold in place (Vite). Locked stack
  (Tailwind v4, shadcn/ui, TanStack Query/Router, Framer Motion, lucide-react)
  installed as of Phase 1. No admin features built yet — a single placeholder route
  confirms the stack renders end-to-end.
