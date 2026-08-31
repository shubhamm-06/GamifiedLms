# Overview

## What this is

A gamified Learning Management System (LMS). Students enroll in courses, work through
lessons (video / text / quiz / mini-game), and earn XP, levels, streaks, and badges as
they go. Admins author courses and content. Access to paid courses is sold through an
external payment gateway that talks to the backend via webhook.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React JS |
| Mobile wrapper | Capacitor (same React codebase, wrapped for iOS/Android) |
| Backend | Supabase (Postgres 17, Auth, Row Level Security, Edge Functions) |
| Payments | External gateway, delivered via webhook → `payments` table |
| Games | Self-contained HTML/CSS/JS bundles hosted on a CDN, loaded in an iframe/webview, registered in the `games` table |

## Core product ideas

- **Two roles only**: `student` and `admin`. No intermediate roles. `profiles.role` gates every admin-only action.
- **XP is a ledger, not a counter.** Every XP-earning event writes a row to `xp_transactions` (append-only). A trigger rolls that up into `user_stats`, which is the fast-read cache for leaderboards and profile displays. The client never writes XP directly.
- **Duplicate-safety by construction.** Webhooks retry, buttons get double-tapped, games can post their "I'm done" message twice. A unique constraint on `(user_id, source_type, source_id)` in `xp_transactions` makes replays a no-op instead of a double-award.
- **Access is a row, not a flag.** A student has access to a course because an `enrollments` row exists for them, not because of a boolean on their profile. This keeps "how did this person get access" auditable (`source`: purchase / manual / free).
- **Grading never trusts the client.** Quiz correct answers and game XP ceilings are enforced server-side (Edge Functions / views that strip the answer key), because anything sent to the browser is visible to a motivated student.

## Content model at a glance

```
courses
 └─ modules (optional grouping layer)
     └─ lessons (video | text | quiz | game)
         ├─ quiz_questions        (if content_type = 'quiz')
         └─ games (FK, if content_type = 'game')
```

## Gamification model at a glance

```
xp_transactions (append-only ledger, source of truth)
   → trigger →  user_stats (cached rollup: total_xp, level, streaks)
   → trigger →  user_badges (auto-unlocked when a badges.condition_type/value is met)
```

## Out of scope / not yet decided

See `decisions.md` for the list of things intentionally left open (leaderboard reset
cadence, streak freeze, quiz retry policy, completion bonus XP, certificates).
