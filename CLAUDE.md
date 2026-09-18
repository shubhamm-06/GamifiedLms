# Documentation System — Governance Rules

The canonical source of project truth is the 11-file set defined under
`docs/` (10 exist today — `analytics.md` is deliberately not created until
analytics work starts). This replaced the earlier single-file
`PROJECT_CONTEXT.md` approach on 2026-09-05 (and the `doc/` per-domain set
before that). This file lives at the repo root
so every Claude Code session loads it automatically at session start.

These rules are hard requirements, not suggestions. A task is not "done" until
the doc-update step below has been completed.

---

## 1. The file table (what owns what)

| File | Owns | Do NOT put here |
|---|---|---|
| `docs/index.md` | Navigation only — file name, one-line purpose, "read this if doing X" | Any actual content — this is a router, not a doc |
| `docs/context.md` | AI-ZONE: stack, architecture, data flow, patterns, naming, gotchas. HUMAN-ZONE: narrative orientation | WIP status, task-level detail, invariants |
| `docs/state.md` | Current WIP, blockers, next steps, known shortcuts/tech debt | Permanent architecture facts, historical log |
| `docs/ui.md` | Component conventions, design tokens, UI/UX patterns | Route access rules, backend schema |
| `docs/schema.md` | DB structure, Supabase config, RLS policies, storage rules | API integration details, route permissions |
| `docs/integrations.md` | Third-party APIs — purpose, endpoints used, rate limits, webhooks | Internal routes, DB schema |
| `docs/routes-permissions.md` | All routes/endpoints + access rules | UI component patterns |
| `docs/env-deploy.md` | Env var *names* (never values), deploy pipeline, where things run | Secrets, actual env values |
| `docs/analytics.md` | Analytics implementation — **do not create until analytics work starts** | Placeholder content, speculative plans |
| `docs/rules.md` | Hard invariants only — things that must NEVER be violated | General notes, preferences, "usually do X" — if it's not a hard invariant, it doesn't belong here |
| `docs/changelog.md` | Terse, dated, append-only log of what changed and why | Anything requiring edits to past entries |

---

## 2. Routing decision tree (use before writing anything)

1. Is this a navigation/index concern only? → `index.md`
2. Is this a permanent architectural fact (stack, pattern, data flow)? → `context.md` AI-ZONE
3. Is this orientation for a human skimming the project? → `context.md` HUMAN-ZONE
4. Is this in-progress, temporary, or "resume here" info? → `state.md`
5. Is this a DB/RLS/Supabase config fact? → `schema.md`
6. Is this about a third-party API? → `integrations.md`
7. Is this a route or permission rule? → `routes-permissions.md`
8. Is this a deploy/env concern (names, not values)? → `env-deploy.md`
9. Is this an absolute invariant that must never break? → `rules.md`
10. Is this a dated record of a change already made? → `changelog.md`
11. Is this UI/component/design-token related? → `ui.md`

If content could fit more than one file, put the full version in the single
best-fit file and, if truly needed elsewhere, leave a one-line pointer — never
duplicate the actual content.

---

## 3. Definition of Done — every task

No task is complete until:
- [ ] The single most relevant doc file (per the routing tree) has been updated
- [ ] `state.md` reflects the new current WIP/next-step reality if this task changed it
- [ ] `changelog.md` has a new terse, dated entry (append only — never rewrite history)
- [ ] `index.md` is updated if a file's purpose or "read this if" scope changed
- [ ] No content was duplicated across files — cross-references only

This checklist must be included as part of the definition of done in every
Claude Code task prompt, not assumed.

---

## 4. Format rules per file

**`context.md` AI-ZONE**: bullet-dense, no prose padding, no repetition across
sections, written for token efficiency not readability. If a bullet restates
something in HUMAN-ZONE, cut it from HUMAN-ZONE.

**`context.md` HUMAN-ZONE**: exactly 2-3 paragraphs. What this project is, why
it exists, current state, where to start looking. No bullet lists — this is
narrative.

**`state.md`**: living document, expected to be rewritten (not appended to) as
WIP changes. Should always be accurate as of the last commit, not historical.

**`rules.md`**: every line must be a hard invariant. Self-test before adding a
line: "would violating this break something critical?" If the honest answer is
"it'd be non-ideal" rather than "it'd break something," it belongs in
`context.md` or `state.md`, not here.

**`changelog.md`**: one line per entry, format `YYYY-MM-DD — what changed —
why`. Append only. Never edit or delete a past line, even to correct it — add
a new correcting entry instead.

**`analytics.md`**: does not exist until analytics work actually starts. Do
not create a stub, placeholder, or "future plans" version early.

---

## 5. Hard prohibitions

- NEVER duplicate the same fact verbatim in two files
- NEVER put actual env values anywhere in `env-deploy.md` — names only
- NEVER rewrite or delete a `changelog.md` entry — corrections are new entries
- NEVER let `rules.md` accumulate soft preferences — audit it if it starts
  reading like notes
- NEVER create `analytics.md` speculatively
- NEVER skip the Definition of Done checklist because a task "felt small"
