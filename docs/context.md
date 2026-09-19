# Context

## AI-ZONE (machine-optimized, dense, no prose padding)

**Project:** Gamified LMS. React+Capacitor frontend, Supabase backend. Current
build phase: admin-facing tooling only, no student-facing UI.

**Stack (locked, all installed):**
- React 19.2.8, TypeScript 6.0.3 — no new `.js`/`.jsx` (see `rules.md`)
- Capacitor `@capacitor/core`+`@capacitor/cli` 8.5.0 — no native platforms
  generated yet (`npx cap add ios/android` not run)
- `@supabase/supabase-js` 2.112.4
- Tailwind CSS 4.3.3, CSS-first config (no `tailwind.config.js`)
- shadcn/ui CLI 4.19.1 (Radix base, "Nova" preset) + `radix-ui` 1.6.7
- TanStack Query 5.102.8, TanStack Router 1.170.32 (**code-based** route tree
  in `src/router.tsx`, not file-based routing)
- TanStack Table **9.2.4** — note the v9 API, not the v8 most examples show:
  `useTable({ features, columns, data })` (not `useReactTable`), features
  built statically via `tableFeatures({})`, columns wrapped in
  `columnHelper.columns([...])` (a bare array widens value types and fails
  the constraint), cells rendered with `<table.FlexRender cell={cell} />`.
  A v8-style `useReactTable` + `getCoreRowModel` call lives behind
  `@tanstack/react-table/legacy` if ever needed.

**TanStack Table v9 — sorting/filtering/pagination.** There is no
`getSortedRowModel()` option as in v8. Feature modules and their row-model
factories are stitched together statically and passed as `features`; the
`*Fns` registry keys become the legal string values for a column's
`filterFn`/`sortFn`. Copy this shape for the next table
(`CourseTable.tsx` is the reference; `DashboardPage.tsx` is the read-only
minimum, `tableFeatures({})`):

```ts
const features = tableFeatures({
  columnFilteringFeature, rowSortingFeature, rowPaginationFeature,
  globalFilteringFeature,                       // one input across many columns
  filteredRowModel: createFilteredRowModel(),   // all factories take no args
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic,
             datetime: sortFn_datetime, text: sortFn_text },
})
```

`globalFilteringFeature` also needs `globalFilterFn: 'includesString'` on the
table (it resolves from the `filterFns` registry and filters nothing when
unset) and `enableGlobalFilter: false` on columns it shouldn't scan. Whatever
is passed as `state` must be reference-stable — the filtered row model
compares those slices by identity and resets the page index when they change.
See `ui.md` for both, and `UserTable.tsx` for the worked example.

Instance/column APIs are v8-familiar: `column.getToggleSortingHandler()`,
`getIsSorted()`, `getCanSort()`, `setFilterValue()`, `table.nextPage()`,
`getCanNextPage()`, `getPageCount()`. Current state reads off `table.state`
(e.g. `table.state.pagination.pageIndex`), not `getState()`. Toolbar-driven
filters can be passed straight in as controlled `state.columnFilters`.
Everything is imported from `@tanstack/table-core` except `useTable`.
- Framer Motion 13.1.1, lucide-react 1.38.0
- dnd-kit (`@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0,
  `@dnd-kit/utilities` 3.2.2) — curriculum drag-and-drop; `cmdk` 1.1.1 —
  searchable combobox; `sonner` 2.0.8 — toasts; fonts via
  `@fontsource-variable/baloo-2` (kid-facing) and
  `@fontsource-variable/geist` (admin)
- Vite 8.2.2, npm only — no pnpm/yarn/bun lockfiles

**Backend:** Supabase project `Gamified LMS`, ref `dmmvftodhcdbubuljqme`,
region `ap-northeast-1`, Postgres 17.6.

**Folder structure** (type-based, deliberately simple — revisit only once
multiple unrelated admin domains crowd these folders):
```
src/
  components/
    ui/       shadcn-generated primitives
    auth/      AuthCard, AuthField (login/signup shared UI)
    admin/     AdminGuard, AdminLayout (shell); one subfolder per domain, each
               holding that domain's table/dialogs/sections: users/, courses/,
               games/, orders/, settings/, gamification/; plus selection/
               (the shared multi-select kit) and trash/ (Trash page table + dialogs)
  pages/       route-level components: HomePage, LoginPage, SignupPage;
               admin/ (Dashboard, Users, UserDetail, Courses, CourseCreate,
               CourseEdit, Games, Orders, Settings, Gamification, Trash)
  hooks/       TanStack Query hooks: useAppSettings, useCourseCount; admin/ has
               one file per domain (useUsers, useUserMutations, useUserDetail,
               useCourses, useCurriculum, useGames, usePayments,
               useManualOrderProviders, useCurrencies, useBadges,
               useLevelThresholds, useDashboard, useTrash, useTrashActions);
               useStableCallbacks.ts (stable handler identities for memoised columns)
  lib/         supabase.ts (client), database.types.ts (generated), queryClient.ts,
               adminSession.ts (route guard logic), adminUserApi.ts,
               adminConstants.ts, currency.ts, csv.ts, slug.ts, video.ts, utils.ts,
               trash.ts (soft delete/restore), permanentDelete.ts (Trash page only)
  index.css    Tailwind entry: `@theme inline` exposes the tokens as utilities,
               shadcn tokens, Geist font
  styles.css   brand tokens + Baloo 2 (auth/kid-facing; see ui.md)
  main.tsx, router.tsx   entry, route tree
supabase/
  migrations/  001-014, source of truth for schema — write here first, apply via
               Supabase MCP second, regenerate database.types.ts third, every time
               (006-012 filenames drifted from live versions — see schema.md)
  functions/   admin-user-management (Deno) — the only Edge Function so far
```

**Architecture decisions:**
- Append-only `xp_transactions` ledger → `AFTER INSERT` trigger rolls up into
  `user_stats`. No client write policy on `user_stats` for any role, ever —
  only `SECURITY DEFINER` trigger functions write it.
- Duplicate-award protection: unique index on
  `(user_id, source_type, source_id) WHERE source_id IS NOT NULL` — callers
  should insert with `ON CONFLICT DO NOTHING`.
- Enrollment-as-row, not a profile flag. `expires_at` computed at insert time
  from `courses.access_duration_days` — never read live (a calling-convention
  rule, not schema-enforced).
- Server-side quiz grading intended (`quiz_questions_public` view strips
  `correct_option`; `quiz_attempts` insert is `service_role`-only) but **no
  grading Edge Function exists yet** — this path doesn't functionally work.
- Service-role wall, "Option B": admins write `enrollments` and `manual`-only
  `xp_transactions` directly via RLS gated on `fn_is_admin()` — no Edge
  Function hop for these two, since the trigger check is exactly as
  trustworthy as a server-side one. `payments` is `service_role`-writable in
  full; an admin can only insert via `fn_create_manual_order` (migration 007),
  update `reconciliation_status`/`reconciliation_note`/`deleted_at` (everything
  else guarded by `fn_guard_payment_admin_update`), and hard-delete a row
  already in Trash (migration 009). Full rule: `rules.md`.
- Privileged user-account admin (create auth user, change someone else's
  email/password, trash/restore/delete account) goes through the
  `admin-user-management` Edge Function, since those need the `service_role`
  key (trashing also bans the auth user and revokes sessions). Ordinary column
  writes (`display_name`, `role`) go straight through supabase-js on the
  existing `profiles_admin_update` RLS policy — no function hop needed.
- Admin section (`/admin/*`) has its own visual language: neutral shadcn
  default (Geist, neutral greys), brand tokens as accents only. Kid-facing
  auth pages (`/login`, `/signup`) use the full Baloo 2 / cream-candy system.
  Two different audiences, deliberately different feel.

**Data flow — signup:** `auth.signUp()` → `auth.users` insert → trigger
`fn_handle_new_user` → `profiles` row (`display_name` from
`raw_user_meta_data`, falls back to email local-part; `role` hardcoded
`'student'`). Client must put `display_name` into `signUp()`'s `options.data`
or the fallback fires. Email confirmation is enabled on this project —
`signUp()` returns no session until confirmed; branch on `data.session`.

**Data flow — XP/leveling:** insert into `xp_transactions` → trigger
`fn_process_xp_transaction` → upserts `user_stats.total_xp`, recomputes
`level` via `fn_compute_level()` (reads the admin-editable `level_thresholds`
table since migration 012 — no hardcoded curve; `STABLE`, not `IMMUTABLE`),
updates streak → calls `fn_evaluate_badges()`. `lesson_progress` reaching
`'completed'` fires TWO independent triggers: `fn_award_lesson_xp` (inserts
the `xp_transactions` row above — skipped when the course has
`gamification_enabled = false`) and `fn_update_lessons_completed` (bumps
`lessons_completed`, re-runs badge evaluation — NOT gated on
`gamification_enabled`; known gap, see `state.md`). `user_stats.level` is
denormalised: editing `level_thresholds` does not recompute it until a
student's next XP event.

**Data flow — admin user actions:** table reads join `profiles` +
`user_stats` directly via supabase-js (RLS permits admin reads). Profile
edits (`display_name`, `role`) go straight through supabase-js. Create /
change-email / reset-password / delete all call the `admin-user-management`
Edge Function, which re-checks the caller's `profiles.role` server-side
(via the service-role client, never the caller-scoped one) before touching
any payload — the client-side guard and disabled buttons are UX only, this
is the real gate.

**Money:** one formatter, `src/lib/currency.ts`, `Intl.NumberFormat` under
`en-IN` (Indian grouping — 1,49,900 — is not hand-rolled). Currency code is
read off the row (`payments.currency`, `courses.currency`, both default
`'INR'`) rather than assumed. The admin-managed currency list is `currencies`
(migration 011, `/admin/settings` Commerce tab), and the app-wide default is
`app_settings.default_currency` (migration 010; an FK to `currencies(code)`
since 011) — but nothing consumes that default yet. `CourseForm.tsx`'s
create-mode default is still the hardcoded string `'INR'`, and
`courses.currency`/`payments.currency` are plain text, not FK'd to
`currencies`; both are flagged follow-ons (see `state.md`, `rules.md`). Unit
(whole rupees) and call-site rules are invariants — see `rules.md`.

**Naming conventions:** Postgres functions `fn_*`, triggers `trg_*`,
migrations `<timestamp>_<NNN>_<description>.sql` in `supabase/migrations/`.

**Known gotchas:**
- `npx shadcn@latest init`/`add` has a Windows path bug — writes generated
  files into a literal `./@/...` directory instead of resolving `@/*` to
  `src/`. Move files out and delete the stray dir after every run. It also
  silently regenerates `button.tsx` and drops any local `eslint-disable`
  comment — check before overwriting. Same bug also emits a broken
  `import { cn } from "cn"` (instead of `@/lib/utils`) in EVERY misplaced
  file, not just one — which drags in and installs an unrelated npm package
  literally named `cn` as a real `package.json` dependency to satisfy that
  import. Caught and reverted (`npm uninstall cn`) twice now: once adding
  `checkbox.tsx`, again adding `popover.tsx`/`command.tsx`/`input-group.tsx`
  for the currency combobox (migration 011) — that second time, `cmdk`
  (a real, wanted dependency `command.tsx` needs) got added in the same
  `npm install` pass, so the fix is `npm uninstall cn` specifically, never a
  blanket "undo whatever `add` just installed." Check
  `package.json`/`package-lock.json` for the stray `cn` entry after every
  `add`, not just the misplaced-directory symptom — and manually rewrite the
  `cn` import in every generated file that has one, not just the first file
  you happen to open.
- `sonner` pulled in `next-themes` as a transitive dep; unused (no
  ThemeProvider), harmless, not worth fighting the generated file to remove.
- **Role-switched SQL tests** (`set_config('role', 'authenticated', true)` plus
  `request.jwt.claims`; `execute_sql` alone runs as `postgres` and bypasses RLS)
  must also clear `request.jwt.claims` after `reset role`. `auth.role()` reads
  the claims, so leftover `authenticated` claims make the `postgres` session
  look like a client to the trash-column guard and `deleted_by` stamping.
- **`npx tsc --noEmit` checks nothing here** — the root `tsconfig.json` only
  holds project references, so a bare `--noEmit` compiles zero files and
  passes vacuously. The real typecheck is `npx tsc -b` (what `npm run build`
  runs first: `tsc -b && vite build`).
- `react-hooks/set-state-in-effect` is strict: reset-form-on-dialog-open must
  be done by remounting an inner component (Radix unmounts dialog content on
  close), not a `useEffect` that calls `setState`.
- `supabase/functions` is in `eslint.config.js`'s `globalIgnores` — Deno
  runtime with `jsr:` specifiers, the browser/Vite lint config doesn't apply.
- **Deletion is trash-first for six tables** (`courses`, `modules`, `lessons`,
  `games`, `badges`, `profiles`; migration 013): `deleted_at`/`deleted_by`, a
  parent hides its children through the parent, and a real `DELETE` is only
  possible on an already-trashed row. `payments.deleted_at` (migration 009) is
  a separate, older mechanism. Every other delete is still a hard delete. Any
  new read path over these tables must treat a lesson as live only when it,
  its module and its course are not trashed — mechanism in `schema.md`
  section 7, invariants in `rules.md`.
- `profiles.email` is not kept in sync by any trigger after signup — the
  `admin-user-management` `update_email` action updates it explicitly
  alongside the Auth email change, or the two drift.

## HUMAN-ZONE (narrative, for a person skimming to get oriented)

This is a gamified Learning Management System — students work through video,
text, quiz, and game lessons, earning XP, levels, streaks, and badges as they
go, while admins author content and manage the platform. It's a React web
app wrapped in Capacitor for mobile, backed by Supabase for auth, Postgres,
and serverless functions. The work so far has deliberately gone into the
admin side first, with the schema, security model, and gamification logic
built out ahead of any student experience.

That admin side is now broadly built. The database has 18 RLS-protected
tables, with the XP, level, streak, and badge machinery live and verified
against the real Supabase project rather than just read from SQL. The
frontend covers signup and login (a trigger auto-provisions each profile),
user management with a per-user detail page, a course builder with
drag-and-drop curriculum and quiz questions, games, orders and payments
(manual orders, CSV import and export, a trash), platform settings, and badge
and level-threshold management. One deployed Edge Function handles the
privileged account actions — creating accounts, changing someone else's email
or password, and deleting users. What does not exist yet is everything a
student would touch: no student screens, no quiz grading, no payment-gateway
webhook, and no deployed frontend.

If you want to understand this fast: start with `state.md` for what's
actually in flight right now, then `schema.md` if you're touching the
database, or `routes-permissions.md` if you're adding a page. This file's
AI-ZONE above has everything else — stack versions, architecture decisions,
data flow, and the gotchas that will otherwise cost you an hour.
