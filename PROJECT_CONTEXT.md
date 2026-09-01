# Project Context — Gamified LMS

**This file is the canonical, living reference for this project's state.** Every
future task's definition of done includes updating the relevant section(s) here —
schema changes go in Database Schema + Migrations Log, new decisions go in Resolved
Architecture Decisions, phase completion goes in Current Phase Status, and so on. If
this file and the code disagree, treat the code as correct and fix this file in the
same session.

`doc/` (the older per-domain doc set) still exists and is still committed — it was
fully synced as of migration 005 and the auth pages, so it isn't currently stale.
This file supersedes it as the single canonical reference going forward; `doc/`
hasn't been deleted or merged in, just superseded. Reconciling the two is a future
cleanup, not done here.

Last verified against the live project: 2026-09-01.

---

## 1. Overview

**What this is:** a gamified Learning Management System. Students enroll in
courses, work through lessons (video/text/quiz/game), and earn XP, levels,
streaks, and badges. Admins author content. Paid course access comes through an
external payment gateway via webhook (not built yet). Current build phase is
**admin-facing tooling only** — no student-facing UI yet.

**Frontend stack — locked, all installed and verified working:**

| Layer | Choice | Version installed |
|---|---|---|
| Runtime | React | 19.2.8 |
| Language | TypeScript | 6.0.3 |
| Mobile wrapper | Capacitor (`@capacitor/core` + `@capacitor/cli`) | 8.5.0 (native platforms not generated yet) |
| Backend client | `@supabase/supabase-js` | 2.112.4 |
| Styling | Tailwind CSS (CSS-first config, no `tailwind.config.js`) | 4.3.3 |
| Components | shadcn/ui (Radix base, "Nova" preset) + `radix-ui` | shadcn CLI 4.19.1, radix-ui 1.6.7 |
| Server state | TanStack Query | 5.102.8 |
| Routing | TanStack Router (code-based route tree, not file-based) | 1.170.32 |
| Animation | Framer Motion | 13.1.1 |
| Icons | lucide-react | 1.38.0 |
| Build tool | Vite | 8.2.2 |
| Package manager | npm only — no pnpm/yarn/bun lockfiles | — |

**Backend:** Supabase, project `Gamified LMS`, ref **`dmmvftodhcdbubuljqme`**,
region **ap-northeast-1**, Postgres **17.6.1**. Status: `ACTIVE_HEALTHY`.

**Folder structure** (type-based, deliberately simple — revisit only once multiple
unrelated admin domains start crowding these four folders):
```
src/
  components/   shared/reusable UI (components/ui/ = shadcn-generated, components/auth/ = auth-specific)
  pages/        route-level components (HomePage, LoginPage, SignupPage)
  hooks/        custom hooks (TanStack Query hooks)
  lib/          supabase.ts (client), database.types.ts (generated), utils.ts (shadcn's cn())
  styles.css    auth design-system tokens (see §7)
  router.tsx    route tree
supabase/migrations/   001–005, source of truth for schema (see §3)
doc/                    older per-domain docs, superseded by this file
```

---

## 2. Database schema

14 tables across 5 domains, all with RLS enabled, plus 3 views.

**Identity & access:** `profiles` (extends `auth.users`; `role` is `'student'` or
`'admin'`, plain `text` with a `CHECK` constraint, not an enum).

**Course content:** `courses`, `modules`, `lessons`, `games`.

**Learner activity:** `enrollments`, `lesson_progress`, `quiz_questions`,
`quiz_attempts`.

**Commerce:** `payments`.

**Gamification:** `xp_transactions`, `user_stats`, `badges`, `user_badges`.

**Views:** `lesson_effective_xp` (coalesces `lessons.xp_reward` with
`courses.default_lesson_xp`), `profiles_public` (id/display_name/avatar_url only,
for leaderboards), `quiz_questions_public` (strips `correct_option`, gated to
admins/preview-lessons/actively-enrolled users).

**Key architectural decisions baked into the schema:**

- **Append-only XP ledger.** Every XP-earning event is a row in `xp_transactions`
  (never updated/deleted; corrections are negative-amount rows). An `AFTER INSERT`
  trigger (`fn_process_xp_transaction`) rolls this up into `user_stats`
  (`total_xp`, `level` via `fn_compute_level()`, streaks). The client never writes
  `user_stats` directly — there is no client-facing write policy on it at all,
  for any role.
- **Duplicate-award protection.** Unique index `uq_xp_transactions_dedupe` on
  `(user_id, source_type, source_id) WHERE source_id IS NOT NULL` — a webhook
  retry or double-tapped button hits a constraint violation instead of a double
  award (insert should use `ON CONFLICT DO NOTHING`).
- **Enrollment-as-row.** Access to a course is an `enrollments` row, not a flag on
  `profiles`. `expires_at` is computed **at insert time** from
  `courses.access_duration_days` — never read live, so a later change to a
  course's duration doesn't retroactively affect existing learners.
- **Server-side quiz grading.** `quiz_questions` (with `correct_option`) is
  admin-only for `SELECT`; students read via `quiz_questions_public`, which
  strips the answer. `quiz_attempts` insert is `service_role`-only, meaning
  grading is designed to happen server-side — but **no Edge Function is deployed
  yet**, so this path doesn't functionally exist in the live system today.
- **`games.max_xp` ceiling.** Server-side cap on XP a single game play can award,
  meant to be enforced when an Edge Function grades game completion (also not
  deployed yet).
- **`gamification_enabled` / `badges.is_active` toggles.** `badges.is_active` IS
  enforced (`fn_evaluate_badges` filters on it). `courses.gamification_enabled`
  exists but is **not enforced anywhere** — a course with it set `false` still
  runs the full XP/badge pipeline.

---

## 3. Migrations log

Source of truth: `supabase/migrations/`. **Update this list — one line per
migration — every time a new migration is applied; write the file here first,
apply via Supabase MCP second, regenerate `src/lib/database.types.ts` third, in
that order, every time.**

| # | File | Applied (UTC) | Summary |
|---|---|---|---|
| 001 | `20260830151837_001_initial_schema.sql` | 2026-08-30 15:18:37 | 14 tables, RLS enabled (deny-all) on all of them, `lesson_effective_xp` + `quiz_questions_public` views. |
| 002 | `20260830153212_002_functions_and_triggers.sql` | 2026-08-30 15:32:12 | `fn_is_admin()`, `courses.updated_at` trigger, `total_students`/`total_lessons` counters, `fn_compute_level()`, `fn_evaluate_badges()`, the `xp_transactions` rollup trigger, `lesson_progress` → `lessons_completed`, the `profiles.role` change guard. |
| 003 | `20260830153242_003_rls_policies.sql` | 2026-08-30 15:32:42 | Full access-matrix RLS policy set for all 14 tables; adds `profiles_public` view; re-defines `quiz_questions_public` with real row gating. |
| 004 | `20260831135811_004_admin_scoped_writes.sql` | 2026-08-31 13:58:11 | Admin direct writes on `enrollments`; admin `manual`-only `xp_transactions` inserts; admin `profiles.role` changes; `payments.reconciliation_status`/`reconciliation_note` columns + a guard trigger scoping admin updates to just those two columns. |
| 005 | `20260901075705_005_auth_profile_trigger.sql` | 2026-09-01 07:57:05 | `fn_handle_new_user()` — `AFTER INSERT` on `auth.users` auto-creates the matching `profiles` row (email, display_name from metadata w/ email-prefix fallback, role hardcoded `'student'`). Verified live: this project has **email confirmation enabled** — `signUp()` returns no session until confirmed. |

---

## 4. Resolved architecture decisions

- **Service-role wall — "Option B."** Admins write `enrollments` and `manual`-only
  `xp_transactions` directly through RLS gated on `fn_is_admin()` — no Edge
  Function hop required for these two. `payments` stays `service_role`-only for
  every column *except* `reconciliation_status`/`reconciliation_note`, which
  admins can update directly; `fn_guard_payment_admin_update()` blocks any other
  column from changing outside a `service_role` write. Rationale: these are
  low-risk, already-role-audited admin actions where `fn_is_admin()` is exactly as
  trustworthy in a trigger as in an Edge Function; payments is externally-sourced
  financial data where an admin should annotate, never rewrite.
- **JS vs. TS.** TypeScript throughout since Phase 0; nothing new gets written as
  `.js`/`.jsx`.
- **Auth trigger.** Built and live — migration 005, `fn_handle_new_user()`.
  Verified end-to-end against the real Auth API (not just read from the SQL).
- **First-admin bootstrap — policy decided 2026-09-01, partially implemented.**
  Intended process: exactly one root admin is inserted directly via SQL; that
  admin can never be deleted; any admin can promote other users to admin.
  - "Any admin can promote another user to admin" — **implemented** (migration
    004's `profiles_admin_update` RLS policy + `fn_prevent_role_change` trigger
    already allow `fn_is_admin()` callers to change `role`).
  - "That admin can never be deleted" — **not yet implemented.** No migration
    currently protects any `profiles` row from deletion (there's no `DELETE`
    policy on `profiles` at all today, so no client role can delete one via
    RLS — but nothing stops a `service_role`/dashboard delete, or cascading
    deletion via `auth.users`). Needs a dedicated safeguard (e.g. a
    `BEFORE DELETE` trigger keyed to a specific id, or a `is_protected` flag)
    before "can never be deleted" is actually true. **Open — not scheduled to a
    phase yet.**
  - One admin profile exists live right now: id `91392b37-91f1-4975-afda-e4c238c4d821`,
    display_name "Shubham Admin", created 2026-09-01 08:31:51 UTC — created
    outside any Claude Code session (presumably: signed up through the app's own
    `/signup` flow, then promoted via manual SQL/dashboard).
- **Auth design system establishment.** No login page or `styles.css` existed
  before 2026-09-01 — both `/login` and `/signup` were built together as the
  first implementation of the auth design tokens (§7), since there was nothing
  yet to "match."

---

## 5. Deferred / explicitly out-of-scope items

- **Social login** (Google/Facebook) — deferred to the end of the project. No
  buttons, no OAuth flow.
- **Admin shell / `/admin/*` route guard** — route tree and the actual
  role-guard logic don't exist yet (Phase 3).
- **Edge Functions** — none deployed. Quiz grading, game XP clamping, the
  payment webhook receiver, and pre-signup payment claiming are all designed for
  server-side enforcement in the schema/RLS but have no server code yet.
- **Capacitor native platforms** — `capacitor.config.json` exists but
  `npx cap add ios`/`android` hasn't been run; no native project directories.
- **Capacitor-specific session handling** — out of scope for the auth-pages work
  done so far; currently relies on `@supabase/supabase-js`'s default browser
  storage, not audited for Capacitor's webview specifically.

---

## 6. Open schema questions

- **Level formula interpretation.** `fn_compute_level()` implements a
  *per-level threshold* (level `N` unlocks at `100 * N^1.5` total XP). Whether it
  should instead be a *cumulative sum* of thresholds (a slower curve) is
  unresolved.
- **`total_lessons` counts all lessons regardless of `status`** (draft +
  published). Whether the admin-facing count should be published-only is open.
- **`total_students` on enrollment expiry — code and its own comment disagree.**
  Verified against the live `fn_update_course_student_count()`: it decrements on
  **any** transition away from `'active'`, which **does** include `'expired'` —
  contradicting the migration's inline comment, which claims expiry doesn't
  decrement. This isn't a live bug (the behavior is consistent, just
  mis-documented in the SQL comment), but the actual open product question
  remains: *should* an expired learner still count as a "student" for display
  purposes? Worth fixing the stale comment next time this function is touched.
- **Quiz pass threshold isn't stored anywhere.** `quiz_attempts.passed` is a
  plain boolean set by whatever grades the attempt — there's no
  `pass_threshold`-style column on `lessons` or `quiz_questions` for a future
  grading function to read. Needs a schema decision before quiz authoring/grading
  is built (Phase 8).
- **`courses.gamification_enabled` / `badges.is_active` enforcement gap.**
  `is_active` is checked in `fn_evaluate_badges`. `gamification_enabled` is
  checked nowhere — needs a decision on where that check belongs (trigger vs.
  Edge Function vs. UI-only).
- **First-admin "can never be deleted" guarantee is unenforced** — see §4.

---

## 7. Design system

**Visual reference:** [Wisdom Hatch](https://wisdomhatch.com) — the user's
existing connected brand site (WPVibe/WordPress), referenced as tone/visual
inspiration for this kids-oriented gamified LMS. No formal design audit of that
site has been done as part of this work — it's a named reference point, not a
component-by-component source.

**Token set** (`src/styles.css`, `:root` — locked, don't add new colors outside
this set without updating this section):

| Token | Hex | Notes |
|---|---|---|
| `--cream` | `#FFF7EA` | Background/accent warm base |
| `--gold` | `#F2B233` | Primary CTA fill |
| `--gold-d` | `#C98A0D` | *Derived* — gold's candy-button shadow layer |
| `--teal` | `#2FA3A0` | Links |
| `--teal-d` | `#1E6765` | *Derived* |
| `--coral` | `#F0705A` | Error/destructive accents |
| `--coral-d` | `#D73014` | *Derived* — used for field/form error text |
| `--plum` | `#7A5FA8` | Accent (not yet used on auth pages) |
| `--plum-d` | `#57427A` | *Derived* |
| `--ink` | `#3A2A1A` | Text |

The four `-d` (dark/shadow) values were not specified explicitly and were
derived at ~15pt-lower HSL lightness, same hue/saturation as their base color —
treat them as provisional, easy to hand-tune later.

**Typography:** Baloo 2 (`@fontsource-variable/baloo-2`, self-hosted), scoped to
the `.auth-page` wrapper class only — does **not** override the app's global
sans (Geist, from shadcn's Nova preset) elsewhere.

**Card:** 26px border-radius, off-white surface (`#FFFEFB`, not pure white —
distinguishes it from the page background), warm soft drop shadow
(`rgba(58,42,26,…)`-based, not a generic gray shadow).

**Primary button:** full-width pill (`border-radius: 999px`), `--gold` fill,
"candy 3D" press effect via `box-shadow: 0 6px 0 var(--gold-d)` at rest,
collapsing to `0 0 0 var(--gold-d)` with a `translateY(6px)` on `:active`.

**Page background:** pure white (`#FFFFFF`) specifically for `/login` and
`/signup` — a deliberate deviation from using `--cream` as the page backdrop
elsewhere (cream/gold/teal are still used for accents and the button, just not
this backdrop).

**Links:** `--teal`, no underline by default, underline on `:hover`.

**Implemented on:** `/login` (`LoginPage.tsx`), `/signup` (`SignupPage.tsx`),
via shared `AuthCard`/`AuthField` components in `src/components/auth/`. Not yet
applied anywhere else (the admin shell doesn't exist yet, and probably
shouldn't use this exact palette wholesale — TBD when Phase 3 starts).

---

## 8. Current phase status

Reference plan as given 2026-09-01 — **a rough map, not a locked spec.** Phase
boundaries, ordering, and scope-per-phase are expected to shift as real
requirements surface; decisions get made when a phase is actually reached, not
all pre-planned. Update the status column as work lands.

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Repo hygiene | ✅ Done | Credential moved out of `doc/.env` into root `.env` (gitignored); `.gitignore` fixed. Correction: `doc/` itself is **committed**, not gitignored — only `doc/.env` is. "Local-only" means nothing has been pushed to a remote (none is configured), not that the folder is untracked. |
| 1 | Stack install | ✅ Done | TS 6.0.3, Tailwind v4 + shadcn/ui (Radix base, Nova/Lucide preset), TanStack Query/Router, Framer Motion, lucide-react — all via npm, type-based folder structure. |
| 2 | Auth | 🔶 In progress | Done: signup trigger (migration 005, live), `/login` + `/signup` pages (built, committed, verified against the live project), one bootstrap admin exists live. Not done: `/admin/*` route tree + the actual role-guard logic, first-admin "never deleted" enforcement (§4), Capacitor-specific session handling, social login (deferred to end by design). |
| 3 | Admin shell | Not started | Layout, nav, role-based guard implementation. |
| 4 | Storage | Not started | Bucket structure/policies for course media not yet decided. |
| 5 | Courses | Not started | CRUD + the `gamification_enabled` toggle (schema exists, unused). |
| 6 | Modules | Not started | |
| 7 | Lessons | Not started | Note: `total_lessons` counts draft+published — open question, §6. |
| 8 | Quiz authoring | Not started | Blocked-ish on the quiz pass-threshold schema gap (§6); grading path assumes server-side/Edge Function, not detailed. |
| 9 | Games registry | Not started | `games.max_xp` ceiling exists in schema; iframe trust model not detailed yet. |
| 10 | Badges | Not started | `badges.is_active` toggle exists and is enforced by `fn_evaluate_badges`. |
| 11 | Enrollments | Not started | Service-role wall already resolved (§4) — admin gets full CRUD via RLS + `fn_is_admin()`. |
| 12 | Users/roles | Not started | `profiles.role` admin-changeable via RLS + `fn_prevent_role_change` — already resolved (§4). |
| 13 | XP ledger | Not started | Admin manual awards already resolved — `xp_transactions` insert restricted to `source_type = 'manual'` for admins. |
| 14 | Payments oversight | Not started | Already resolved to reconciliation-scoped columns only (§4), not blanket admin access. |
| 15 | Dashboard | Not started | No detail decided yet. |

---

## 9. Repo state notes

- **`doc/` folder:** tracked and committed in git like everything else — it is
  **not** gitignored. The only thing gitignored under `doc/` is `doc/.env`
  specifically (a personal-reference copy of the DB password). "Local-only" in
  earlier conversations meant *nothing has been pushed to a remote* — there is no
  `git remote` configured at all — not that the folder is uncommitted.
- **Git:** single local repo, no remote, 5 commits on `master` as of this file
  (Phase 0 hygiene → Phase 1 stack → migration 005 → auth pages → doc sync).
  Nothing has been pushed anywhere.
- **`.env` handling:** real credentials live in root `.env` (gitignored):
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client-exposed, `VITE_`-prefixed
  on purpose), `SUPABASE_DB_PASSWORD` (no `VITE_` prefix — never bundled to the
  client, for future CLI/tooling use only). `.env.example` is committed with
  placeholder keys. `doc/.env` keeps a personal-reference copy of the same
  values, also gitignored.
- **Installed package versions:** see the table in §1 — current as of
  2026-09-01. `shadcn` (the CLI) lives in `devDependencies`, not
  `dependencies` — it's a dev tool, not a runtime import.
- **Known tooling quirk:** `npx shadcn@latest init` has a Windows path bug — it
  can write generated files into a literal `./@/...` directory instead of
  resolving the `@/*` alias to `src/`. Check where files actually land after
  running `npx shadcn add <component>`.
- **No Edge Functions, no native Capacitor platforms, no CI** exist yet.
