# Changelog

Terse, dated, append-only. Never edit or delete a past line — corrections are
new entries.

- 2026-08-29 — TypeScript Vite+Capacitor scaffold committed — repo hygiene pass (Phase 0), credential moved out of `doc/.env` into gitignored root `.env`
- 2026-08-30 — Migrations 001–004 applied (schema, functions/triggers, RLS policies, admin-scoped writes) — established the 14-table schema and its security model
- 2026-08-31 — Locked frontend stack installed (Tailwind v4, shadcn/ui, TanStack Query/Router, Framer Motion, lucide-react) — Phase 1
- 2026-09-01 — Migration 005 applied (`fn_handle_new_user` auto-creates `profiles` on signup) — `signUp()` alone couldn't satisfy `profiles`' NOT NULL columns; also built `/login` + `/signup` pages and the cream/gold/teal auth design system, since neither existed yet to match
- 2026-09-02 — Built `/admin` route guard + `/admin/users` management page, and wrote (but could not deploy — MCP disconnected, no CLI token) the `admin-user-management` Edge Function — first admin-facing feature beyond auth
- 2026-09-02 — Created `PROJECT_CONTEXT.md` as a single-file canonical reference — `doc/` (per-domain files) had drifted and needed a living source of truth
- 2026-09-02 (~07:38 UTC) — `admin-user-management` Edge Function deployed and went ACTIVE — method/session unknown, discovered via live verification on 2026-09-05, not performed by a Claude Code session with a direct record of completing it
- 2026-09-05 — Replaced `PROJECT_CONTEXT.md` and the `doc/` folder with the `docs/` + root `CLAUDE.md` system (this file's home) — single-file doc had grown unwieldy; new structure enforces one fact lives in exactly one file, with a hard definition-of-done checklist so it can't silently go stale again
- 2026-09-09 — Built the admin shell (sidebar/topbar layout, `/admin` dashboard with KPIs, needs-attention list and a TanStack Table activity feed) and made post-login routing role-aware — first admin surface beyond user management; empty states are the primary case since the database is still effectively empty
- 2026-09-09 — Mapped the brand tokens into Tailwind's `@theme` as `--color-*` utilities — they existed only as raw CSS vars, so admin components had no way to use them without hardcoding hex
- 2026-09-09 — Fixed an open redirect on `/login`: the `redirect` search param was passed straight to `history.replace` with no validation — a crafted link could bounce a freshly authenticated admin off-origin
- 2026-09-09 — Admin route guard now re-reads `profiles.role` from the database on every run instead of accepting a 30s cached value — a demoted admin kept access until the cache expired
- 2026-09-09 — Recorded "monetary integer columns store whole rupees" as an invariant — the columns document no unit, and a future payment webhook writing paise would make every displayed amount wrong by 100x
- 2026-09-09 — Built `/admin/courses` list plus dedicated create and edit routes sharing one form component — first admin CRUD domain, and the conventions it sets (dedicated routes, status-contextual row actions, inline constraint errors) are meant to be copied by the next one
- 2026-09-09 — Made archive the only removal path for courses and recorded it as an invariant — deleting would cascade-destroy modules/lessons silently while failing outright once any payment or enrollment exists
- 2026-09-09 — Recorded `published_at` as set-once-on-first-publish — no trigger maintains the column, so re-publishing an archived course must not overwrite its original date
- 2026-09-09 — Documented the TanStack Table v9 feature-registration shape for sorting/filtering/pagination in `context.md` — v8's `getSortedRowModel()` option doesn't exist in v9 and the next table shouldn't have to rediscover it
