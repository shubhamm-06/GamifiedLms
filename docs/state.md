# State

Living document — rewritten as reality changes, not appended to. Accurate as
of the last commit on `master`. No remote is configured; nothing has been
pushed anywhere. How each piece landed, and how it was verified, is in
`changelog.md`; this file says only what exists now and what is still open.

## Built

Everything in this section exists in code and, where it touches the database,
live.

**Admin app** (routes and access rules: `routes-permissions.md`; every sidebar
nav entry is a real route):
- Auth: `/login`, `/signup`, role-aware post-login routing, the `/admin` guard
  (role re-read from the database on every run), open-redirect protection.

**Student app** (routes and access rules: `routes-permissions.md`; visuals:
`ui.md`):
- `/` — the kid Home: the roadmap of the most recently used course (migration 022; `fn_home_course`, `fn_touch_enrollment`), with a "No courses yet" state. The roadmap is one continuous winding path with a sticky scroll-spy module bar and a procedural background; since 2026-09-26 it has no header or Continue button, and every visit scrolls to the next-up node and opens its anchored popover (`ui.md`).
- `/badges`, `/courses`, `/profile` (2026-09-26) — the other three bottom-nav screens; with
  Home they are the four destinations of the persistent bottom nav (`ui.md`). `/courses` is the
  course switcher (active enrollments with progress; tapping one makes it Home's course).
  `/badges` and `/profile` are deliberately minimal and need a real design pass.
- `/courses/$courseId` — the course roadmap: modules and lessons as a
  learning path with lock state (from `fn_course_lesson_states`), a progress
  bar, a sticky Continue bar, a tap sheet per lesson (a friendlier one for
  locked lessons), kid-friendly whole-page states (loading, not-enrolled,
  unavailable, empty, network-retry). Visually polished on 2026-09-21: Baloo 2
  on student screens, flat module banners with progress dots, a winding SVG path
  generated from the node positions, a node hierarchy (see `ui.md`). **Not
  linked from anywhere** — no home/dashboard screen exists yet, so it's
  reachable only by URL.
- `/courses/$courseId/lessons/$lessonId`: the lesson player: video, reading,
  game and quiz lessons, a server-driven active-time ring, a server-graded quiz,
  once-only XP with a completion sheet, a replay mode and screens for locked,
  not-enrolled and unavailable lessons (`ui.md`, `routes-permissions.md`). Games
  are treated as time-based (no game protocol exists). Redesigned to a
  dedicated UI/UX spec on 2026-09-23 (typography scale, motion tokens,
  measured colour contrast, a per-question quiz review, a teal completion
  medallion with confetti, tap-to-play video/game, a dev-only state gallery
  at `/dev/lesson-player-gallery`; details and the deliberate spec deviations
  are in `ui.md`). On 2026-09-24 it was simplified for ages 5 to 7:
  module-scoped, a hero, one activity card with a Play button, the module's lesson
  list and a Next button once done; completion now happens automatically after Play
  and the minimum time (`ui.md`). Verified in Chromium against the live project; not yet on
  a device or in the Capacitor webview.
- A pathless student layout route (`KidLayout`) gates both on a signed-in
  session only — no role check; RLS and the engine decide what a signed-in
  user may see.
- Admin shell and Dashboard: sidebar/topbar (title read from
  `app_settings.site_name`), KPI cards, a needs-attention list, a recent-activity
  table.
- Users: the `/admin/users` list (client-side search/filter/sort/paginate,
  create dialog, multi-select with bulk Move to trash, a CSV Export menu and an
  Import dialog) and the
  `/admin/users/$userId` detail page (account actions incl. Move to trash,
  stats, enrollments with manual enroll/revoke/restore and a per-course
  progress reset that claws back that course's XP (migration 021),
  per-course progress, badges,
  manual XP award). There is no separate Students page.
- Courses: the `/admin/courses` list (archive and Move to trash, multi-select)
  and the Course Builder (`/admin/courses/new`, `/admin/courses/$courseId/edit`;
  Basics and Curriculum tabs) with topics, lessons and quiz questions,
  drag-and-drop reordering including cross-topic lesson moves, checkboxes and
  bulk Move to trash on topics and lessons, YouTube/Vimeo embed links, and
  per-lesson *minimum time* and (quiz) *pass mark* settings with a bulk "Set
  minimum time" (enforced server-side by the lesson engine; see Backend).
- Games: the `/admin/games` list (Move to trash, multi-select) plus
  `GameDialog`, including a stored *Orientation* setting.
- Orders and payments: `/admin/orders` — KPI cards, filters, Add order (a
  manual payment plus its enrollment, via `fn_create_manual_order`), CSV export
  and import, bulk selection (the shared kit), Active/Trash views, permanent
  delete of trashed rows (payments' own older Trash, unchanged).
- Settings: `/admin/settings` — Commerce (manual-order providers, currencies,
  default-currency picker), Gamification (quiz pass threshold), Site Identity.
- Gamification: `/admin/gamification` — badge CRUD (Move to trash,
  multi-select) and the editable level curve (`level_thresholds`).
- Trash: `/admin/trash` — six tabs (courses, modules, lessons, games, badges,
  users), each a full table with Restore, Delete permanently and Empty trash, per
  item and in bulk; restore blocked under a trashed parent; permanent delete
  typed-`DELETE` with a readable reason for anything that can't be deleted. The
  sidebar shows the total count. Every "delete" elsewhere is "Move to trash"
  with an Undo toast (users get one lightweight confirm), and every list table
  uses the shared multi-select kit.

**Backend:**
- **The kid-side lesson engine** (migrations 017–019, `schema.md`):
  server-side heartbeat-counted active time, linear unlock, quiz grading,
  completion and XP-once through four RPCs; students have no write path to
  progress, attempts or XP. Typed wrappers and TanStack Query hooks
  (`lib/lessonEngine.ts`, `hooks/useLessonEngine.ts`) are now exercised through
  the course roadmap, both directly (real JWTs against the REST API) and via
  the real UI (Chromium) — see the changelog.
- Schema through migration 026 (`schema.md`; 020 is written but deliberately
  unapplied, see below), RLS on every table, the
  XP → level/streak/badge trigger machinery, the lesson-completion XP award
  (`fn_award_lesson_xp`, skipped for courses with `gamification_enabled =
  false`, which since migration 030 also skips the lesson count and badges;
  not retroactive, `rules.md`), and an admin-editable level curve.
- Trash-first deletion (migrations 013 and 014, the Edge Function's `trash` /
  `restore` / `delete`, and the UI above): soft delete on courses, modules,
  lessons, games, badges and profiles, hidden through parents, RLS-enforced
  permanent delete, counters and XP/badge functions that skip trashed content,
  and every own-row policy gated so a trashed user's old token stops working.
  Verified with role-switched queries, against the deployed function and by
  driving the real UI (`changelog.md`).
- Edge Function `admin-user-management` — deployed, version 3, ACTIVE,
  `verify_jwt: true`, with `bulk_create` (CSV import), `trash`, `restore` and a
  stricter `delete`. `trash`, `restore`, `delete` and `bulk_create` have been
  exercised end to end; `update_email` and `update_password` have not, and
  `create` has not been called directly since it moved onto the shared
  `createAuthUser` helper that `bulk_create` runs (next step 1).

## Designed but not built

The schema or docs anticipate each of these; no working code exists for any.

- **Admin authoring for content blocks.** `lesson_content_blocks` (migration 023) and the kid renderer
  exist; there is no admin UI to write blocks (a later task), so today they are edited in the database.
  The three demo doc lessons have seeded blocks; the image block uses a `placehold.co` placeholder. A
  doc lesson with no blocks still renders `content_html` (the old sandboxed frame), which is also all the
  admin form can write today.
- **The other lesson types on the shared framework.** Video is fully built (custom player, playing-only
  active time, ends-then-completes, one-button completion card). Doc, quiz and game lessons still use
  the earlier flow (time only, plus their own quiz/game handling); they can take an `active` signal into
  `useLessonClock` and the single-button completion sheet as they are reworked. Vimeo playback was not
  exercised end to end (see `ui.md`); YouTube and a file were. Fullscreen landscape lock (Android) and the
  iOS native fullscreen path have not been run on a real device.
- **Gems and hearts/energy** in Home's stat bar. Streak and lifetime XP shipped there on
  2026-09-26; the other two are still deferred and have no placeholders.
- **A real design for Badges.** Shipped 2026-09-26 as a minimal functional screen (no celebration
  or animation, no per-badge detail); Profile was rebuilt 2026-09-27 (avatar, account editing, a
  streak calendar — `ui.md`) and is no longer on this list.
- **On-device bottom nav.** The nav's safe-area padding (`var(--sa-bottom)`) was
  checked in CSS and at 360 to 430px in Chromium, where the inset is 0; a real iPhone or the
  Capacitor webview has not been exercised.
- **Android hardware Back and haptics are built, but unverified on a device**
  (2026-09-28, `ui.md` "Android Back button" and "Haptics"): `@capacitor/app` and
  `@capacitor/haptics` installed, the APK builds with both and requests `VIBRATE`.
  No device or emulator was attached (the SDK at `C:\Android` has no emulator
  package), so none of the adb Back checks in `env-deploy.md` has been run, and no
  haptic has been felt on hardware. The pure priority logic was checked with an
  ad-hoc script only (the repo has no test framework).
- **Native shell pass built, unverified on a device** (2026-09-28, `ui.md` "Native shell"):
  safe-area tokens, keyboard handling, kid WebView polish, offline banner, keep-awake,
  lesson-clock background flush, backup disabled. The APK builds with seven plugins and
  `allowBackup=false`; none of the device checks in `env-deploy.md` has been run. Open
  product calls: moving the session to secure storage (options in `env-deploy.md`), and
  whether a cached game should open offline (today it cannot).
- **Owl splash, entrance and launcher icon built, unverified on a device**
  (2026-09-29, `ui.md` "Splash and entrance owl"): a static owl on the native
  cold-start splash (a new `MainActivity.installSplashScreen()` call was needed for
  API 24-30, previously unused despite the compat library already being a
  dependency) and a one-shot bounce/glow/blink entrance overlay in the app, both
  from the finalized SVG mark. The launcher icon (all `mipmap-*/ic_launcher*.png`,
  a second, separately supplied owl artwork) was replaced the same day: adaptive
  icon (safe-zone foreground + cream background) and legacy pre-26 icons, generated
  from the source PNG with Pillow (cropped to content, centered, no distortion). The
  APK builds with the new drawable and mipmap resources; no device or emulator was
  attached, so the cold-start-to-entrance handoff, the blink timing,
  `prefers-reduced-motion`, and how the launcher icon actually looks under a real
  OEM mask have only been checked by reading the code and the generated PNGs
  on-screen here, not seen on a phone or in a launcher.
- **Manual push notifications: built, deployed and sent for real** (migration
  031, deployed 2026-09-29, `ui.md` "Push notifications", `schema.md` "Edge
  Functions", `env-deploy.md`). `device_push_tokens`/`notifications_sent`
  (RLS checked with role-switched SQL, 13/13 checks, fixtures removed,
  baseline counts confirmed unchanged); `@capacitor/push-notifications` 8.1.2
  registration, upsert, logout cleanup, notification-tap handling, all
  native-only and confirmed a no-op on web; the Google Services Gradle plugin
  activates with `android/app/google-services.json` in place (a matching file
  was found in Downloads and copied in — it was not actually at the path an
  earlier task's brief assumed); the debug APK builds with the plugin and the
  three new permissions (`POST_NOTIFICATIONS`, `WAKE_LOCK`,
  `com.google.android.c2dm.permission.RECEIVE`); `send-push-notification` and
  `register-push-token` are deployed (`ACTIVE`, version 1) with the
  `FCM_SERVICE_ACCOUNT_JSON` secret set; `/admin/notifications` was exercised
  end to end with a live admin login and a **real send to the primary
  admin's own registered device**, which returned `recipientCount: 1` with no
  error in `function_logs`. **What that confirms and what it doesn't:** the
  API call succeeded and FCM accepted the message for that token — it has
  NOT been confirmed by eye on the phone screen, since this session has no
  way to see a physical device; that confirmation still needs the device's
  owner. Unverified for the same reason: the permission prompt on first
  launch, the notification's actual appearance, arrival with the app fully
  closed, and tapping it. Deploying via the MCP `deploy_edge_function` tool
  failed for this function (it cannot resolve the `../_shared/fcm.ts`
  import); the Supabase CLI deploys the real directory tree and works
  (`env-deploy.md`). Setting the secret also needed the JSON minified to one
  line first — a pretty-printed file broke the CLI's argument parsing and
  produced a "not valid JSON" runtime error on the first attempt, caught via
  `function_logs` and fixed before the real send.
- **Notification status-bar icon fixed, same caveat as above** (2026-09-29,
  `ui.md` "Push notifications" "Status-bar icon"). Every send now sets
  `android.notification.icon`/`color` explicitly (gold, `--gold` token); the
  manifest's `default_notification_icon` is a fallback. `ic_stat_notify.png`
  at all five densities is a **derived, first-pass silhouette** — the owl
  mark's own head/eyes/beak shapes, without its white backing circle, legible
  as "a round face with two eyes" down to 24dp when rendered here, but not
  commissioned artwork. A second real send (`recipientCount: 1`, no error)
  confirmed the API accepts the new payload fields; **whether the status bar
  actually shows the gold owl silhouette instead of the default white dot has
  NOT been confirmed by eye** — same limitation as the send itself, this
  needs the device owner to look. If the auto-derived silhouette doesn't read
  well at real size, a bolder purpose-made version (bigger eye cutouts, more
  exaggerated shape) is the next step, not a code problem to fix.
- **Quiz explanations.** The correct option is now revealed after each answer
  (migration 024, `fn_check_quiz_answer`; `rules.md` amended). An explanation is still
  not sent anywhere: the quiz page has no place for one and `fn_submit_quiz` /
  `fn_check_quiz_answer` return none. Migration 020 (unapplied) would add it to a graded
  result only, which the new one-at-a-time flow no longer shows; if explanations are
  wanted they belong in the check reply instead. `app_settings.quiz_pass_threshold_percent` is stored
  and admin-editable but read by nothing — the pass mark is per lesson.
- **Other XP award paths.** Only `'lesson'` (automatic) and `'manual'` (admin)
  award XP; the `'quiz'`, `'game'` and `'streak'` `source_type`s have no
  writer.
- **Payment gateway webhook and pre-signup payment claiming.** No receiver and
  no Edge Function — see `integrations.md`.
- **Real game bundles.** Both games in the database point at placeholder
  `https://example.com/...` URLs, so a game lesson shows a blank frame; a
  cross-origin frame fires `load` even for a page that is not a game, so the
  player cannot detect it. Replace the URLs with real bundles.
- **Game hosting, partly verified.** Built 2026-09-26 (`ui.md`, migration 025): a full-bleed host,
  the `game:complete` postMessage contract, server-clamped score XP (`fn_complete_game`), a best-effort
  entry-page cache and a native orientation lock. Verified in Chromium with a local game; **not run on a
  device or in the Capacitor shell**: `@capacitor/screen-orientation` and `@capacitor/filesystem` (newly
  installed) were only seen through their browser fallbacks (the web Screen Orientation API and
  IndexedDB), and `CapacitorHttp` (enabled in `capacitor.config.json` so the entry fetch ignores CORS) has
  never run. The cache holds the entry page only, not the game's other files. Still unread: `bundle_size_bytes`
  and `checksum`. **Two consequences to know:** (1) both games in the live database have placeholder
  `example.com` URLs that never send `game:complete`, so their three lessons (Number Pop, Balloon Addition,
  Shape Match) can no longer be completed by waiting out the timer (`fn_complete_lesson` refuses a game
  lesson with a live game), which blocks the rest of the demo course for a student until real bundles
  replace them; (2) a game lesson's XP is now the reported score capped at `max_xp`, not the lesson's XP,
  so the "+N XP" the roadmap shows for a game lesson (the lesson effective XP) can differ from what is
  awarded. Both are product calls if you want them changed. A game that needs its origin's storage will not
  have it when served from the stored copy (opaque origin, `ui.md`).
- **File uploads.** No Storage bucket exists (`storage.buckets` is empty), so
  `courses.thumbnail_url` and a lesson's `video_url` are paste-a-URL fields.
- **iOS, release Android builds, CI.** The Android platform is generated and a
  debug APK builds (`npm run android:apk`, output `android/app/build/outputs/apk/debug/app-debug.apk`,
  `env-deploy.md` "Android build"); it has NOT been installed or exercised on a
  device or emulator. Not done: release signing / keystore, an AAB, FCM/push, deep
  links / Android App Links (Supabase email confirmation links open in the browser,
  not the app). The launcher icon and splash both use the real owl mark now
  (`ui.md` "Splash and entrance owl"). iOS was not added. Hosting is Vercel; no CI exists.
- **A Course Builder "Additional" tab** (prerequisites/FAQs/audience). The
  schema has no columns for it; deliberately not built.
- **Admin control over the locked design tokens** from `/admin/settings` — the
  next step toward a white-labelable platform, deliberately deferred; the token
  set in `ui.md` stays code-only until a task asks for it.
- **Rich-text editing** for a lesson's `content_html` (a raw HTML textarea
  today) — a separate dependency decision.
- **Analytics.** `analytics.md` deliberately doesn't exist until this starts.
- **Orientation locking.** `games.orientation` drives only a "turn your phone"
  hint in the player. Locking the screen needs a native plugin
  (`@capacitor/screen-orientation`), which is not installed.
- **A parental gate** for the kid-side app — deferred by decision.
- **Admin control over the locked design tokens** already covers `--surface`
  too (added this task, same status as the rest of the token set).

## In flight

The lesson player is built and committed. One piece waits on a decision:
migration 020 (`supabase/migrations/20260922000000_020_lesson_player_server.sql`,
untracked, NOT applied) needs approval before anything touches the database.
Everything else is complete: the trash-first work, the admin lesson settings, the
kid-side engine, the course roadmap and the lesson player.

## Live data reality

The database is no longer empty: it holds real content the user is actively
authoring. Row counts on 2026-09-19 — `profiles` 3 (1 admin, 2 students),
`courses` 2 (both published), `modules` 3, `lessons` 2, `enrollments` 3,
`payments` 2 (none trashed), `xp_transactions` 1, `user_stats` 1; config tables
`app_settings` 1, `manual_order_providers` 3, `currencies` 178,
`level_thresholds` 30; zero rows in `games`, `quiz_questions`, `quiz_attempts`,
`lesson_progress`, `badges` and `user_badges`; nothing is trashed and no auth
user is banned. Verification passes use
SQL-created throwaway accounts and separately-titled test rows — never the real
"Wisdom Hatch Kids" content — and remove them afterwards (account rule:
`rules.md`). On 2026-09-20 the profile, content, enrollment, payment, XP,
stats, game and badge counts were re-read after each Phase 4 fixture round and
matched the figures above; the config-table counts were not re-read. The two
real lessons (1 `text`, 1 `video`) carry the migration 015 defaults
(`min_time_seconds` 90, `pass_percentage` 60), re-read on 2026-09-20 after that
task's fixtures were removed. After the lesson-engine task's fixtures were
removed the counts above (including `lesson_progress` 0, `quiz_attempts` 0,
`quiz_questions` 0, `xp_transactions` 1, `user_stats` 1, `user_badges` 0, `badges` 0
and the course counters) were re-read and matched. The lesson player task did the
same on 2026-09-22 (profiles 3, courses 3, modules 7, lessons 17, enrollments 5,
`lesson_progress` 0, `quiz_attempts` 0, `quiz_questions` 14, `xp_transactions` 1,
`user_stats` 1, payments 2, games 2, badges 0, and the course counters
`demo-fun-with-numbers` 1 student / 15 lessons, `dsgf` 0 / 0, `wisdom-hatch-kids` 2 / 2).

## Blockers

None.

## Next steps, roughly in order

1. Smoke-test the `admin-user-management` actions not yet exercised end to end
   against the live deployment: `update_email`, `update_password` and a direct
   `create` (now on the shared helper). (`trash`, `restore` and `delete` were
   exercised on 2026-09-19, including the has-history refusal, and
   `bulk_create` on 2026-09-20.)
2. Add the DB-level guard against deleting the primary admin
   (`91392b37-91f1-4975-afda-e4c238c4d821`). The UI and the Edge Function both
   refuse it; a direct `service_role`/dashboard delete or an `auth.users`
   cascade still isn't stopped.
3. Decide migration 020 (below), then test the player on a real phone and in the
   Capacitor webview (`ui.md` lists what has not been exercised).
4. A student home/dashboard screen that links to `/courses/$courseId` — the
   roadmap currently has no entry point.
5. Decide enrollment expiry (below) before any student is expected to lose access.
6. Run the Android Back and haptics checks on a real device (`env-deploy.md`), then a Capacitor session audit.

## Open decisions & on the horizon

Each of these needs a product call or a deliberate follow-on; none is being
worked on.

- **Migration 020 needs a yes or no (file written, not applied).** Section A makes
  `fn_submit_quiz` return each question's `explanation` inside a graded result (it
  reads `quiz_questions.explanation`, nothing else changes; it needs an amended
  invariant in `rules.md`, and the choice to send explanations for every question or
  only for wrong answers). Section B (optional) carries the heartbeat's sub-second
  remainder. Nothing else in the schema changes; no policy, grant or view is touched.
  The player already handles both states: with 020 unapplied a graded result simply has no explanation.
- **Dead time after a pause.** The server cannot be told the child left, so after
  a pause the client waits until 32 s after its last beat before sending the next (so
  the beat lands past the server's 30 s window and credits 0). Cost: up to about 32 s
  of visible time is not counted after each pause. Video lessons (2026-09-26) hit this hardest,
  because a paused video is a pause: the stretch played BEFORE the pause is credited by a final
  beat, but the seconds played in the first ~32 s after each resume are not. Watching without
  pausing is unaffected. Removing it needs a small migration
  (a `p_resumed` flag on `fn_lesson_heartbeat` that credits 0 and restarts the clock).
  In dev, React StrictMode sends the opening beat twice within a fraction of a second; harmless (the second credits 0).
- **Background flush is native only.** In the app, backgrounding or leaving a lesson sends one
  final beat so the last stretch is credited; the web keeps pausing without it (web behaviour
  was deliberately not changed), so up to one beat interval (12 s) can be lost per tab switch.
- **Reading lessons are shown, not sanitised.** No HTML sanitiser is installed, so
  `content_html` is trusted only because it renders in a script-less sandboxed frame
  with a restrictive CSP (`rules.md`). An admin can still put a link or a big image
  in it. If lesson HTML ever comes from anyone but an admin, add a sanitiser.

- **The last-admin guard is unreachable in normal use.** The caller must be a
  non-trashed admin different from the target, so at least two non-trashed
  admins always exist; the guard only fires on a race between two admins
  trashing each other. It is implemented and defense-in-depth, but has not
  been exercised.
- **Security-advisor follow-up (partly done).** Last run 2026-09-20, just BEFORE
  019 (not re-run after): 13 `SECURITY DEFINER` functions executable by `anon`,
  19 by `authenticated`. Four are RLS helpers (`fn_user_is_trashed`,
  `fn_course_is_live`, `fn_lesson_is_live`, `fn_is_admin`) that must stay
  executable because policies run them as the caller. Eight are trigger or
  event-trigger functions that predate the trash work and were left alone
  (`fn_award_lesson_xp`, `fn_handle_new_user`, `fn_prevent_role_change`,
  `fn_process_xp_transaction`, `fn_update_course_lesson_count`,
  `fn_update_course_student_count`, `fn_update_lessons_completed`,
  `rls_auto_enable`); calling a trigger function through RPC is not expected to
  do anything useful, but that was not tried, so this is an advisor finding, not a
  demonstrated hole. `fn_evaluate_badges(uuid)`, which was the one
  directly callable exception, was closed by migration 019. The four engine
  functions and the two caller-only view helpers are listed as
  `authenticated`-executable by design. Also flagged: three functions with a
  mutable `search_path` (`fn_set_updated_at`, `fn_compute_level`,
  `fn_create_manual_order`) and leaked-password protection being off. The three
  `SECURITY DEFINER` views the advisor lists at ERROR level were audited on
  2026-09-20 and are **accepted, with a written rationale** in `schema.md`
  (Views): each needs owner privileges, none exposes a correct answer or
  explanation any more, and the write hole in `profiles_public` is closed
  (016). The advisor will keep listing them.
- **Enrollment expiry is not enforced anywhere.** `enrollments.status` can be
  `'expired'` but nothing sets it, and `expires_at` is read by no policy, function or
  trigger, so an enrollment past its `expires_at` still opens the course and the
  lesson engine (observed with a status-`active` enrollment three days past
  `expires_at`). Decide whether to enforce it in `fn_is_enrolled` (one place, the
  lessons policy would then need the same change) or set `'expired'` on a schedule.
- **A heartbeat under-credits by up to a second per beat.** It credits whole
  seconds and stamps `last_heartbeat_at = now()`, dropping the fraction: 10 s
  beats were credited 10 for gaps of 10.43, 10.84 and 10.76 s. Twelve back-to-back
  beats over 3.00 s of server time credited 0 (the intent: hammering never
  inflates). Carrying the remainder (advancing `last_heartbeat_at` only by the
  credited seconds) would lose nothing and still never over-credit; not done
  because the spec said `= now()`. Migration 020, section B (proposed, optional)
  implements the carry.
- **Admin preview banner on the course page is not built, and cannot be as
  specified.** The redesign task asked for a slim "Admin preview. This is what
  enrolled students see." banner for an admin who is not enrolled, without
  changing what the not-enrolled state returns and without new queries or RPCs.
  Two things block it. (1) For an unenrolled admin the engine refuses
  (`not_enrolled`), so the page shows the not-enrolled screen and never has
  roadmap data; a banner claiming "this is what enrolled students see" would sit
  on a screen that shows nothing of the kind. (2) The student pages load no role
  or profile data, so knowing the viewer is an admin needs a new read (a
  `profiles` query or `fn_is_admin` call). A meaningful banner needs the preview
  mode below (the engine and the `courses`/`modules`/`lessons` policies admitting
  an admin without writing progress) and a role read. Until that is decided, an
  unenrolled admin keeps the existing not-enrolled screen.
- **Admins cannot preview a lesson through the engine.** Not enrolled → `not_enrolled`
  for everything; an admin preview mode would be a separate, deliberate addition.
- **Follow-up: admin preview mode (view a course without enrolling).** The admin
  panel now has a "View course" action (list menu and editor header) that opens
  `/courses/$courseId` in a new tab, but an admin who isn't enrolled sees the
  "not enrolled" screen there. A real preview needs a deliberate design: the
  engine functions and the `courses`/`modules`/`lessons` policies would have to
  admit an admin without creating progress or XP rows for them, and the page
  would need a visible "previewing" state. Nothing of that exists; it was
  explicitly out of scope for the button.
- **Preview lessons are readable by any signed-in user, a trashed one included**
  (existing `lessons` policy); `quiz_questions_public` and `lesson_effective_xp`
  mirror it.
- **The course-content query can't embed `lesson_effective_xp`.** No FK path
  exists from `lessons` to that view (confirmed live, `PGRST200`), so
  `useCourseRoadmap` fetches it as a second, unfiltered request in parallel
  with the course query — RLS already limits the rows to what the caller may
  see. Giving the view a `course_id` column (denormalised from `lessons`) would
  let it be embedded and filtered instead of read whole; not done, since the
  view's current row-gating logic would need to move or duplicate.
- **Do the three real profiles' display names look right?** `profiles_public` was
  writable by `anon` from migration 003 until 016. No write was observed in the
  data, but nothing recorded one either; worth a glance at the three names.
- **Payments' Trash view still says "permanently" / "can't be undone" outside
  `/admin/trash`.** `/admin/orders` keeps its own older Active/Trash split with
  a "Delete Permanently" action (migration 009, built before trash-first). The
  rule for the six trash-first entities is that only `/admin/trash` deletes;
  payments are outside that set and were left untouched, but they contradict a
  strict reading of it. Options: leave, or add a Payments tab to `/admin/trash`.
- **Config-list rows still have a "Delete" action** — currencies, manual-order
  providers, level thresholds and quiz questions hard-delete from their own
  screens with their own confirm. They are not trash-first entities (no
  `deleted_at`), so they were not converted; say so if they should be.
- **Two password minimums.** The project enforces 8 characters; Supabase Auth's
  own configured minimum is 6 (observed 2026-09-20 — `schema.md`). An account
  created through the app is held to 8; whether a direct Auth or dashboard call
  could create a 6–7-character one is inferred, not tested. Raising Auth's
  minimum to 8 in the dashboard would make the two agree.
- **The Orders CSV export/import still uses the original helpers** — no UTF-8
  BOM, no formula-injection guard, comma-only parsing — while the Users CSV uses
  the generic ones in `lib/csv.ts`. Orders were left alone because payments were
  out of scope for the Users CSV work; moving them over is a small follow-up if
  wanted.
- **A lost `bulk_create` reply can lose a generated password.** There is no
  idempotency key: if the reply to a chunk is lost after the server created its
  accounts, the retry finds them and reports them as skipped, and their
  generated passwords are gone. The import summary lists such rows under "Needs
  attention" and the recovery is Reset password. Observed by dropping a reply in
  a test (3 accounts existed, the retry reported 3 skipped, no password was
  recoverable).
- **Should `text` lessons default to a minimum time?** The spec named video,
  game and quiz. `text` lessons pre-fill 90 s (and the column default gives every
  existing lesson 90), the same as video and game. Say if reading time should
  default to Off instead.
- **Empty courses count as finished for `course_complete`.**
  `fn_evaluate_badges` treats a gamified course with zero published lessons as
  complete (its "no incomplete lesson" check is vacuously true), so an active
  enrollment in one counts toward `course_complete` badges. Found during the
  migration-030 audit; not changed. A one-line fix is an `exists` guard on at
  least one published lesson.
- **Should a manual XP award move the streak?** `fn_process_xp_transaction`
  treats every `xp_transactions` insert alike, so an admin award always sets
  `last_activity_date` to today and advances or resets `current_streak`
  (verified live). An admin correction for XP earned on a past day silently
  inflates a streak; fixing it means deciding whether `source_type = 'manual'`
  skips the streak update.
- **Should an expired learner still count in `courses.total_students`?**
  `trg_enrollments_student_count` decrements on any move away from `'active'`,
  including to `'expired'` — which contradicts the trigger code's own inline
  comment.
- **`user_stats.lessons_completed` isn't deduped on re-completion.** It bumps
  on every transition into `'completed'` (reset and complete again, or delete
  and re-insert the `lesson_progress` row — verified live, 4→6), so it can
  over-count toward `lessons_completed` badges. XP is unaffected
  (`uq_xp_transactions_dedupe`). Fixing it needs a trigger change.
- **Editing `level_thresholds` doesn't recompute stored levels.**
  `user_stats.level` is denormalised and updates only on a student's next XP
  event; migration 012's backfill was one-time. The admin UI says so. Add
  recompute-on-save or a "recalculate levels" action if it ever matters.
- **`app_settings.default_currency` is settable but consumed by nothing.**
  `CourseForm.tsx`'s create-mode default is still the hardcoded string
  `'INR'`; wiring it up is a small, separate change.
- **`courses.currency` and `payments.currency` aren't FKs to `currencies`** —
  plain text by explicit design (`rules.md`). Constraining them touches
  `CourseForm.tsx` and `fn_create_manual_order`, and needs a decision on what
  happens to a row carrying a currency code that is later deleted or
  deactivated.
- **Migration filenames don't match the live versions for 006–012.** Renaming
  the files to the versions `list_migrations` reports is a migrations-folder
  change that hasn't been made; detail in `schema.md`.

## Known shortcuts / tech debt

- **Dashboard revenue is summed client-side.** PostgREST aggregate functions
  aren't guaranteed enabled on this project, and adding a view/RPC needs a
  migration. Fine at current volume; revisit if `payments` grows.
- **Revenue is filtered to INR.** Summing mixed currencies is meaningless. If a
  second currency ever appears this needs a per-currency breakdown, not a
  wider filter.
- **Nav uses one `to as never` cast** (`AdminLayout`'s `NavLink`) — still
  load-bearing, not a leftover; rationale in `ui.md`.
- **A lesson's `game_id` falls back to pasting a raw UUID** while the `games`
  table is empty, which it is today; the picker becomes a dropdown as soon as
  any game exists.
- **Video embeds only recognize YouTube/Vimeo share links.** Any other link is
  a validation error, not a silent save.
- **The admin shell is desktop-only** — no mobile responsiveness, deliberately.
- **No automated tests and no CI.** No test runner or test files exist;
  verification so far has been manual and live against the real project. The
  Phase 4 checks — real-browser Playwright scripts, direct calls to the deployed
  function and Node scripts over the CSV/import logic — were throwaway scripts
  kept outside the repo, so they cannot be re-run from it.
- **`courses.total_lessons` counts draft and published lessons**, not
  published-only.
- **Level-curve edge behaviors, all intentional:** above the highest level (30
  as seeded) a student stays at it until an admin adds more (the old formula was
  unbounded — it would have reached level 31 at 16,432 XP); deleting a middle
  level leaves a numbering gap (levels are not renumbered); level 1's "exists,
  stays 0" rule is UI-only, not in the database (`rules.md`).
- **CSV order import is one RPC round-trip per row, client-side, sequential.**
  `importManualOrders` (`usePayments.ts`) calls `fn_create_manual_order` once
  per row in a loop rather than any server-side bulk path — fine at this scale
  (a handful to low hundreds of rows), and it is what lets a single bad row fail
  without a special-case rollback for the rest. Importing thousands of rows at
  once would need a real server-side bulk endpoint; not built, since that scale
  problem doesn't exist yet.
- **Import size limits are unmeasured.** The preview renders every row (up to
  1000) without virtualisation, and each file read scans every profile email (in
  pages of 1000) to spot existing accounts. The largest import run through the UI
  was 60 rows; a 1000-row parse was checked in Node only.
- **Not exercised in Phase 4:** opening an exported file in desktop Excel (the
  BOM, CRLF and quoting were checked at the byte level, not in Excel);
  keyboard-only use of the export menu and the import dialog; mobile widths; a
  full 1000-row import through the UI; the 60-second request timeout against a
  real (not injected) stall; PostgREST's 1000-row cap (no table here is that
  large).
- **`games.bundle_size_bytes`/`checksum` are accepted but never verified.** The
  admin form takes them as optional plain inputs (defaulting to `0`/`''` when
  blank) because nothing downstream reads them — there is no game-loading
  surface. Once one exists and starts trusting either value, it must not assume
  every row's value is real; `0`/`''` reads as "not provided," not as a
  verified fact.
- **The app session lives in WebView `localStorage`** (audited 2026-09-28, `env-deploy.md`):
  app-private and excluded from backup, but not encrypted at rest. Not migrated.
- **LAN-testing (insecure-context) audit, 2026-09-21.** Over `http://<LAN-IP>`
  the page is not a secure context. Audit of `src/` and the built bundle: the
  only secure-context-only call was `crypto.randomUUID` in
  `QuizQuestionsEditor.tsx` (now `uuid()`, fixed). No use anywhere of
  `navigator.clipboard`, `crypto.subtle`, `mediaDevices`, `share`,
  `Notification`, `serviceWorker` or `wakeLock`. `crypto.getRandomValues`
  (the admin password generator) and `URL.createObjectURL` (CSV downloads)
  work everywhere. Dependencies: supabase-js uses `crypto.subtle` only for
  OAuth/PKCE (feature-detected, falls back) and `getClaims` signature
  checks — this app calls neither. **Known LAN-testing limitations that
  remain:** none in current code. Any *future* feature that needs a
  secure-context API (camera, clipboard-copy without a fallback, push,
  service workers/PWA install) cannot be exercised over `http://<LAN-IP>`.
  Not exercised over the LAN: a real phone, the Capacitor webview, iOS Safari.
- **The lesson-engine client layer is now exercised** (heartbeat, complete,
  states) through the course roadmap over the real REST API and the real UI;
  `fn_submit_quiz` is still only exercised directly (no screen calls it — the
  lesson player doesn't exist). The generated types mark every `RETURNS TABLE`
  column non-null, including `module_id` and `completed_at`, which can be null;
  `fetchCourseLessonStates` maps them to `string | null` by hand.
- **The roadmap's network-failure and reduced-motion checks used Playwright's
  request interception and `reducedMotion` emulation, not a real device or a
  real dropped connection.** A real device, the Capacitor webview, real
  safe-area insets and the native back button were not exercised for this
  screen either — same open item as the rest of the mobile app.
- **A real screen reader was not used.** Accessibility checks were
  programmatic: `role`/`aria-label` text, computed focus, and contrast ratios
  computed from rendered colors — not a VoiceOver/NVDA/TalkBack pass.
- **A completed course's engine state and `courses.total_lessons` mean
  different things — expected, not a bug.** The roadmap's denominator is
  `fn_course_lesson_states`' row count (live, published lessons only);
  `courses.total_lessons` counts draft + published live lessons (`known
  shortcuts`, below). Observed live: a course with 1 draft lesson mixed into 9
  published ones showed "0 of 9 lessons" while `total_lessons` read 10. Anything
  that shows course-wide lesson counts to a student must use the states
  function, never the counter.
