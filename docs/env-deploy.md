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
only for `supabase link` and other Management-API CLI commands. It is **not**
needed for the `--db-url` fallback below (a direct Postgres connection, no
Management API involved), which is the one actually used when the MCP
connector is unavailable. Add the token to `.env` (generate at
supabase.com/dashboard/account/tokens) only if `link`/branch-management CLI
commands become routine.

Edge Functions read `SUPABASE_SERVICE_ROLE_KEY` at runtime — this is a
Supabase-managed default secret in the Edge Function environment, never set
in this repo's `.env` and never hardcoded in function source.

## Deploy pipeline

**No CI exists.** Everything below is done manually, from this repo, via the
Supabase MCP connector when it's attached to the session, or the Supabase CLI
when it isn't (the MCP connector has come and gone across sessions; the CLI
fallback below needs no `SUPABASE_ACCESS_TOKEN`, only `SUPABASE_DB_PASSWORD`,
already in `.env`):

- **Migrations:** write to `supabase/migrations/`, apply via
  `Supabase:apply_migration` (MCP) or, without it,
  `npx supabase db query --db-url "$DBURL" --file <path>` (CLI, direct
  Postgres — see the connection string below; a multi-statement file needs
  splitting into one `db query` call per statement, since the pooler's
  transaction mode refuses multiple commands in one prepared statement), then
  hand-insert a row into `supabase_migrations.schema_migrations` (`version` a
  fresh UTC timestamp, `name` the migration's descriptive name) so
  `list_migrations`/`db push` stay consistent — the same thing
  `apply_migration` does automatically. Either way, regenerate
  `src/lib/database.types.ts` (`Supabase:generate_typescript_types`, or
  `npx supabase gen types typescript --db-url "$DBURL" --schema public`,
  hand-merged into the existing file's style rather than overwritten
  wholesale) and commit migration + types together. Never a direct dashboard
  schema edit. Either path stamps its own UTC version at apply time, so the
  timestamp in the filename can differ from the live version reported by
  `list_migrations` — it does today for 006–012 and every migration applied
  through the CLI fallback (see the migrations log in `schema.md`).
- **The CLI fallback's connection string**, for `db query`, `db push`,
  `gen types` and `db advisors`'s `--db-url` flag: a direct Postgres URL
  through Supavisor's transaction pooler, `postgresql://postgres.<project-ref>
  :<percent-encoded SUPABASE_DB_PASSWORD>@aws-0-<pooler-region>.pooler.supabase.com:6543/postgres`.
  **The pooler region is project-specific and not guessable from the project
  ref or its dashboard URL** — for this project it is `ap-northeast-1`;
  finding it cost a brute-force sweep of candidate regions (a wrong region
  fails fast with `tenant/user ... not found`, not a timeout, so the sweep is
  cheap). The project's direct-connection host (`db.<ref>.supabase.co`) is
  IPv6-only and does not resolve from this machine, so it isn't a usable
  fallback. `supabase link` itself still needs `SUPABASE_ACCESS_TOKEN` (it
  calls the Management API, not Postgres directly) and was not used this way.
- **Edge Functions:** write to `supabase/functions/<name>/`, deploy via
  `Supabase:deploy_edge_function`, or
  `npx supabase functions deploy <name> --project-ref dmmvftodhcdbubuljqme`
  with `SUPABASE_ACCESS_TOKEN` set (this one path does need the token, since
  function deploys go through the Management API, not Postgres).

## Where things run

- **Frontend:** not deployed anywhere yet — local Vite dev server only
  (`npm run dev`, port 5173). No hosting target configured.
- **Backend:** Supabase project `Gamified LMS`
  (`dmmvftodhcdbubuljqme`, `ap-northeast-1`).
- **Mobile:** Capacitor is installed but no native platform has been added
  (`npx cap add ios`/`android` not run) — nothing runs on-device yet.
- **Git:** single local repo, no remote configured, nothing pushed anywhere.
