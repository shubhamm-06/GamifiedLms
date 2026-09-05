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
