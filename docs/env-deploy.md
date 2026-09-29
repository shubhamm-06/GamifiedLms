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
in this repo's `.env` and never hardcoded in function source. `FCM_SERVICE_ACCOUNT_JSON`
is a second, custom Edge Function secret (`send-push-notification`,
`register-push-token`, migration 031, name only — see "Push notifications"
below for what it is), set 2026-09-29.

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
  function deploys go through the Management API, not Postgres). **A function
  that imports a shared sibling file outside its own directory (`../_shared/...`,
  like `send-push-notification` and `register-push-token`) must use the CLI,
  not `Supabase:deploy_edge_function`** — that MCP tool places every `files`
  entry under its own synthetic bundle root, so a relative import that walks
  up out of the function's own folder cannot resolve (`Module not found`); the
  CLI deploys the real `supabase/functions/` tree from disk, where the import
  resolves correctly. `secrets set`/`functions deploy` sometimes report
  `ProjectRefNotLinkedError` even with `--project-ref` passed — run `npx
  supabase link --project-ref dmmvftodhcdbubuljqme` first (needs only
  `SUPABASE_ACCESS_TOKEN`; leaves no file that needs gitignoring, `supabase/.temp/`
  already is).

## Where things run

- **Frontend:** Vercel (`gamified-lms-five.vercel.app`), built with
  `npm run build`, serving `dist`. `vercel.json` rewrites every path to
  `/index.html` — the app uses path-based routing, so without it a direct
  visit or refresh on any route but `/` (e.g. `/admin`) is a Vercel 404.
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set in the Vercel
  project settings (the local `.env` is gitignored) and baked in at build
  time, so changing them needs a redeploy. Local dev: `npm run dev`, port 5173.
- **Backend:** Supabase project `Gamified LMS`
  (`dmmvftodhcdbubuljqme`, `ap-northeast-1`).
- **Mobile:** Capacitor Android platform generated (`android/`, committed);
  a debug APK builds locally (see "Android build" below). iOS not added. Nothing
  has been exercised on a device or emulator yet.
- **Git:** single local repo, no remote configured, nothing pushed anywhere.

## Android build

Capacitor 8.5.0, Android only. `capacitor.config.json`: `appId` `com.wisdomhatch.kids`,
`appName` "Wisdom Hatch Kids", `webDir` `dist`, `backgroundColor` the locked cream
token, `SystemBars.style = LIGHT` (dark icons on the cream bar), `CapacitorHttp`
enabled. There is **no `server.url`**: the APK ships the bundled web assets only
(a live-reload config must never be committed). The scaffold's untouched `cap init`
defaults (`com.example.app`, `gamifieldlms`) were replaced before the platform was
generated, because the application id is baked into the native package and is
permanent once published.

**Prerequisites (Capacitor 8):** JDK 21 (verified: Temurin 21.0.12,
`JAVA_HOME` set), Android SDK with platform `android-36` (compileSdk and targetSdk
36, minSdk 24) and build-tools 35+ (verified at `C:\Android`, `ANDROID_HOME` set,
platforms 34 and 36, licenses accepted). Gradle 8.14.3 and AGP 8.13.0 come from the
generated wrapper and download on the first build (about 1 minute of downloads plus
about 1 minute to compile). `.env` must hold `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` at build time: Vite bakes them into the bundle, and
`src/lib/supabase.ts` throws at startup if they are missing.

**Commands** (repo root):
- `npm run android:sync` — `npm run build` (tsc + Vite) then `cap sync android`
  (copies `dist` into `android/app/src/main/assets/public`, regenerates the
  plugin list, eight today: `@capacitor-community/keep-awake`, `@capacitor/app`,
  `@capacitor/filesystem`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/network`,
  `@capacitor/push-notifications`, `@capacitor/screen-orientation`, all 8.x with peer `@capacitor/core` >=8).
- `npm run android:apk` — sync, then `node scripts/gradlew.mjs assembleDebug`.
  Output: `android/app/build/outputs/apk/debug/app-debug.apk` (about 9.1 MB —
  jumped from 5.4 MB with `@capacitor/push-notifications` and the Firebase
  Messaging SDK it pulls in).
- Install on a USB-debugging device or a running emulator:
  `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
  (`adb` is in `%ANDROID_HOME%\platform-tools`). Anything under `android/` other
  than the ignored build output is committed; `android/app/src/main/assets/public`,
  `capacitor.config.json` there, `.gradle`, `build`, `local.properties` and
  `*.apk` are ignored by `android/.gitignore`.

**Windows caveats:** the repo path contains a space, and `cmd.exe` does not resolve a
bare `gradlew.bat` from the working directory, so `scripts/gradlew.mjs` calls the
wrapper by its absolute, quoted path (macOS/Linux use `./gradlew`). Android resource
XML comments must not contain `--`. Gradle needs `ANDROID_HOME` or
`android/local.properties` (`sdk.dir=...`, ignored by git) to find the SDK.
`npm run lint` ignores `android/` (generated bundle and Gradle output).

**What was customised in `android/`:** launcher label and package from the config;
a solid cream splash (`values/colors.xml` `splash_background`, the Capacitor
`splash.png` files deleted, `windowSplashScreenBackground` set) plus a static owl
icon on top of it (`values/styles.xml` `windowSplashScreenAnimatedIcon`, `ui.md`
"Splash and entrance owl"); the window background is cream so nothing flashes white
before the page paints. The launcher icon itself (all `mipmap-*/ic_launcher*.png`,
generated from the supplied owl artwork, not the SVG splash mark) is the same owl:
the adaptive foreground is kept within the ~62%-of-canvas safe zone so no OEM mask
clips it, legacy pre-Android-8 icons have the cream baked in directly, and the
adaptive background color (`values/ic_launcher_background.xml`) is the same cream.
The literal hex lives in `colors.xml`, `ic_launcher_background.xml` and
`capacitor.config.json` because native resources cannot read CSS custom properties;
if the cream token changes they must all follow.

`android/app/src/main/res/drawable-{m,h,xh,xxh,xxx}hdpi/ic_stat_notify.png`
(2026-09-29, migration 031) — the push-notification status-bar icon, a
monochrome white-on-transparent silhouette derived from the owl mark's own
shape geometry (`ui.md` "Push notifications" "Status-bar icon" has the full
rationale — a full-color icon is invalid here, which is why Android was
showing its default white dot before this). `AndroidManifest.xml`'s
`com.google.firebase.messaging.default_notification_icon` meta-data points
at it as a fallback; `send-push-notification` sets it explicitly on every
message regardless (`_shared/fcm.ts`), along with `android.notification.color`
(the locked `--gold` token, `#F2B233`, hardcoded here for the same
native/Deno-can't-read-CSS-vars reason as the splash and launcher icon).

`android/app/google-services.json` (2026-09-29, migration 031) — the Firebase
client config for `com.wisdomhatch.kids`, project `wisdom-hatch-kids`. This is
a client-side config file (an API key scoped to this Android package, not a
secret), safe to commit — `android/.gitignore`'s own template comment
(`# google-services.json`) is deliberately left disabled here. `android/build.gradle`
already carried the Google Services Gradle plugin classpath and
`android/app/build.gradle` already had the conditional `apply plugin:
'com.google.gms.google-services'` (only if the file exists) from the
Capacitor Android template, unused until now — confirmed active by
`processDebugGoogleServices` running in the build log once the file was in
place.

**Device behaviour to know (not exercised on a device yet):** the webview origin is
`https://localhost`; supabase-js keeps its session in `localStorage`, which Android
WebView persists across launches (cleared by "Clear data"). Cleartext HTTP is blocked
(targetSdk 36 default, no network security config), which matches the app already
refusing non-https media and game URLs outside dev. Permissions (checked with `aapt2 dump permissions`): `INTERNET`,
`VIBRATE` (added by hand for `@capacitor/haptics`), `ACCESS_NETWORK_STATE` (merged from
`@capacitor/network`), `POST_NOTIFICATIONS`, `WAKE_LOCK` and
`com.google.android.c2dm.permission.RECEIVE` (all three merged from
`@capacitor/push-notifications` and the Firebase Messaging SDK it brings in),
and androidx's own signature-level
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`; nothing else. Keyboard and keep-awake need none.
**Backup:** `android:allowBackup="false"`, with `dataExtractionRules` (`res/xml/data_extraction_rules.xml`,
Android 12+, cloud backup and device transfer) and `fullBackupContent` (`res/xml/backup_rules.xml`,
Android 11 and below) both excluding every domain, so the stored session never rides a backup or a
phone-to-phone transfer. The activity has `windowSoftInputMode="adjustResize"`.
**Session storage:** supabase-js persists its session (access and refresh token) in WebView
`localStorage`, which lives in app-private storage: not readable by other apps, but not encrypted
at rest and readable on a rooted device or through a debuggable build. Kept as is. Capacitor-8
options if that is ever moved (a custom `auth.storage` adapter in `lib/supabase.ts`, async):
`@aparajita/capacitor-secure-storage` 8.0.1 (Android Keystore; maintained; depends on
`@capacitor/keyboard` ^8), `capacitor-secure-storage-plugin` 0.13.0 (Keystore, peer core >=8, smaller
project), or `@capacitor/preferences` 8.0.1 (official, but plain SharedPreferences, so no security
gain). Tradeoffs: an async storage adapter, a one-time migration of the existing session (or one
forced sign-in), and a web fallback that stays on `localStorage`.
The router uses browser history; Capacitor serves `index.html` for extensionless
paths, so nested routes and refresh should work, but that is unverified on-device.

**Not done yet:** release signing / keystore, an AAB for Play, deep
links / App Links, and iOS. (The launcher icon is real, done 2026-09-29 — see above —
not a placeholder any more. Push notifications are fully deployed — see below.)

**Push notifications (2026-09-29, migration 031) — DEPLOYED and working.**
`@capacitor/push-notifications` 8.1.2, `device_push_tokens`/`notifications_sent`
(`schema.md` section 8), the `/admin/notifications` screen, and both Edge
Functions (`send-push-notification` v1, `register-push-token` v1, both
`ACTIVE`, `verify_jwt: true`, deployed via `npx supabase functions deploy
<name> --project-ref dmmvftodhcdbubuljqme` with `SUPABASE_ACCESS_TOKEN` —
**not** the MCP's `deploy_edge_function` tool, which flattens `files` under
its own synthetic root and cannot resolve a relative import that walks up
out of the function's own directory; the real CLI deploys the actual
`supabase/functions/` tree, so `../_shared/fcm.ts` resolves correctly). The
secret they read, **`FCM_SERVICE_ACCOUNT_JSON`** (name only, per this file's
own rule — never its value here): the full JSON key of a Firebase service
account for the `wisdom-hatch-kids` project with the Firebase Cloud
Messaging API enabled, set via `supabase secrets set`.

**Gotcha that cost one redeploy-of-the-secret cycle:** `supabase secrets set
NAME="$(cat file.json)"` breaks if the JSON file is pretty-printed (real
newlines between keys) — the CLI's `NAME=VALUE` argument parsing does not
survive an embedded newline in the value, and the function then fails at
runtime with `FCM_SERVICE_ACCOUNT_JSON is not valid JSON` (confirmed via
`function_logs`). **Minify the JSON to one line first:**

```
npx supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync('/path/to/service-account.json','utf8'))))")" --project-ref dmmvftodhcdbubuljqme
```

`supabase secrets set` and `supabase functions deploy` both also need the
project **linked** first if the CLI reports `ProjectRefNotLinkedError` even
with `--project-ref` passed — `npx supabase link --project-ref
dmmvftodhcdbubuljqme` (needs only `SUPABASE_ACCESS_TOKEN`, already set).

**Verified end to end 2026-09-29** with a real send from the live admin UI
(a temporary `zz-*@example.test` admin fixture, removed after) targeting the
real primary admin's own registered device: `recipientCount: 1`, no error in
`function_logs`, and the admin UI showed "Notification sent to 1 device."
instead of the earlier "Could not reach the server." The local
`firebase-service-account.json` key file was deleted after the secret was
confirmed set, per the standing "read once, never left on disk" rule
(`rules.md`) — it was never committed (already in `.gitignore`, confirmed
untracked before deleting).

**Testing the Back button with adb** (not yet run: no device was attached). Install
(`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`), sign in as a
student, then send Back with `adb shell input keyevent KEYCODE_BACK` and check:
Home with its lesson card open (first Back closes the card only); a lesson reached from
the roadmap (Back returns to the roadmap); a quiz after one answer and a game in play
("Leave this lesson?" appears; Back again closes it); Badges, Courses or Profile (lands
on Home); Home with nothing open (first Back shows "Press back again to exit", a second
within 2 s closes the app, a second after 3 s only shows the toast again). Haptics need
a real phone; an emulator reports success without vibrating.

**Native shell checks** (not yet run: no device was attached): Home arriving with its
auto-opened lesson card (first Back shows the exit toast; a card opened by tapping a node
closes on Back instead); Profile with Account & Security open (Back goes Home); the status
and navigation bars (cream shows behind both, dark icons, nothing under them); tapping a
Profile or login field (keyboard never covers it, bottom nav hidden while it is up); dragging
past the top or bottom of Home (no glow, no refresh); pinch (no zoom); playing a video then
pressing Home (`adb shell input keyevent KEYCODE_HOME`: video pauses, screen may sleep, the
clock resumes after return); airplane mode (`adb shell cmd connectivity airplane-mode enable`,
banner appears, completing a lesson shows an error with Try again).

**Testing push notifications with adb.** The server side is deployed and two
real sends to the primary admin's already-registered device (`device_push_tokens`
had a row from an earlier real install) came back `recipientCount: 1` with no
error in `function_logs` — the second, 2026-09-29, after adding the status-bar
icon (`ui.md` "Status-bar icon") and its `android.notification.icon`/`color`
FCM payload fields. Both confirmed the API accepted the send, **not**
confirmed by eye on the phone (this session has no way to see a physical
screen) — in particular, whether the status bar actually shows the gold owl
silhouette instead of Android's default white dot is unconfirmed. Still
unverified this way, no device attached to this session: granting the
notification permission on first launch (Android 13+), the notification's
actual appearance (icon, banner, sound/vibration per system settings),
arriving with the app fully closed (`adb shell am force-stop
com.wisdomhatch.kids` first), and tapping it opening the app without a
crash.
