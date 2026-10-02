# Docs Index

Routing layer only — no content lives here. See `/CLAUDE.md` at the repo root
for the governance rules that keep this set from rotting (routing decision
tree, definition-of-done checklist, format rules per file).

| File | Purpose | Read this if you're... |
|---|---|---|
| [`context.md`](./context.md) | Stack, architecture, data flow, patterns, gotchas (AI-ZONE) + narrative orientation (HUMAN-ZONE) | ...new to the codebase, or need the "how does this fit together" picture |
| [`state.md`](./state.md) | What's built vs. designed-but-not-built, current WIP, live data reality, blockers, next steps, open decisions, known shortcuts/tech debt | ...picking up work and need to know what exists, what's actually in-flight right now, or what's still undecided |
| [`schema.md`](./schema.md) | DB structure, RLS policy matrix, trigger functions, migrations log, Edge Functions | ...touching anything in Postgres, writing a migration, or checking what a table/policy/trigger actually does |
| [`ui.md`](./ui.md) | Design tokens, component conventions, the two visual languages (kid-facing vs. admin) | ...building or styling a UI component |
| [`routes-permissions.md`](./routes-permissions.md) | Every frontend route + who can reach it; Edge Function endpoints and the student-callable database functions (lesson engine) + their access rules | ...adding a route, checking who can see a page, or calling an Edge Function or lesson-engine RPC |
| [`env-deploy.md`](./env-deploy.md) | Env var names (never values), where things run, how to deploy | ...setting up a new environment, deploying a migration/function, building the Android APK, or debugging a missing env var |
| [`integrations.md`](./integrations.md) | Third-party APIs — purpose, endpoints, rate limits, webhooks | ...adding or debugging a third-party integration (payment gateway, etc.) |
| [`rules.md`](./rules.md) | Hard invariants that must never be violated | ...before touching auth, `profiles.role`, quiz answers, lesson progress / XP writes, lesson-content frames or the lesson clock, views, the parent-facing course page's fonts / plain-text rule / `fn_course_outline` / testimonials / `page_layout`, or the primary admin |
| [`changelog.md`](./changelog.md) | Terse, dated, append-only log of what changed and why | ...want the history without re-reading git log |
| `analytics.md` | Does not exist yet — created only once analytics work starts | — |

Not listed above: `/PROJECT_CONTEXT.md` and `/doc/` are retired (superseded
2026-09-05 by this set — see `changelog.md`). `/doc/.env` still exists on disk
as a personal credential backup; it isn't part of the documentation system.
