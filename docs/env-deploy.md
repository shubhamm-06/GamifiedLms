# Env & Deploy

Names only, per governance rule — never a value in this file.

## Environment variables

Root `.env` (gitignored; `.env.example` is the committed template with
placeholder keys):

| Name | Exposed to client? | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (`VITE_` prefix) | Supabase project API URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (`VITE_` prefix) | Supabase publishable/anon key |
| `SUPABASE_DB_PASSWORD` | No | CLI/tooling only (e.g. direct Postgres connections for verification); never bundled to the client since it has no `VITE_` prefix |

`doc/.env` (note: singular `doc/`, not `docs/`) holds a personal-reference
copy of the same values — gitignored, not part of the documentation system,
predates it.

**Not currently set anywhere in this repo:** `SUPABASE_ACCESS_TOKEN` — needed
only for the Supabase CLI fallback (`npx supabase ...`) when the MCP
connector is unavailable. Add it to `.env` (generate at
supabase.com/dashboard/account/tokens) if CLI-based deploys become routine.

Edge Functions read `SUPABASE_SERVICE_ROLE_KEY` at runtime — this is a
Supabase-managed default secret in the Edge Function environment, never set
in this repo's `.env` and never hardcoded in function source.

## Deploy pipeline

**No CI exists.** Everything below is done manually, from this repo, via the
Supabase MCP connector (preferred) or the Supabase CLI (fallback, needs
`SUPABASE_ACCESS_TOKEN`):

- **Migrations:** write to `supabase/migrations/`, apply via
  `Supabase:apply_migration`, regenerate `src/lib/database.types.ts` via
  `Supabase:generate_typescript_types`, commit all three together. Never a
  direct dashboard schema edit. `apply_migration` stamps its own UTC version
  at apply time, so the timestamp in the filename can differ from the live
  version reported by `list_migrations` — it does today for 006–012 (see the
  migrations log in `schema.md`).
- **Edge Functions:** write to `supabase/functions/<name>/`, deploy via
  `Supabase:deploy_edge_function`, or
  `npx supabase functions deploy <name> --project-ref dmmvftodhcdbubuljqme`
  with `SUPABASE_ACCESS_TOKEN` set.

## Where things run

- **Frontend:** not deployed anywhere yet — local Vite dev server only
  (`npm run dev`, port 5173). No hosting target configured.
- **Backend:** Supabase project `Gamified LMS`
  (`dmmvftodhcdbubuljqme`, `ap-northeast-1`).
- **Mobile:** Capacitor is installed but no native platform has been added
  (`npx cap add ios`/`android` not run) — nothing runs on-device yet.
- **Git:** single local repo, no remote configured, nothing pushed anywhere.
