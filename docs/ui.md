# UI

Two visual languages in this app, deliberately different — a kid-facing side
(auth pages, and presumably the future student experience) and a neutral
admin side. Don't cross-pollinate them without a reason recorded here.

## Kid-facing design system (`/login`, `/signup`)

**Visual reference:** [Wisdom Hatch](https://wisdomhatch.com) — the user's
existing connected brand site, referenced as tone/visual inspiration for this
kids-oriented LMS. No formal component-by-component design audit of that site
has been done; it's a named reference point, not a source to copy pixel-for-pixel.

**Token set** (`src/styles.css`, `:root` — locked; don't add colors outside
this set without updating this file):

| Token | Hex | Notes |
|---|---|---|
| `--cream` | `#FFF7EA` | Background/accent warm base |
| `--gold` | `#F2B233` | Primary CTA fill |
| `--gold-d` | `#C98A0D` | *Derived* — gold's candy-button shadow layer |
| `--teal` | `#2FA3A0` | Links |
| `--teal-d` | `#1E6765` | *Derived* |
| `--coral` | `#F0705A` | Error/destructive accents |
| `--coral-d` | `#D73014` | *Derived* — field/form error text |
| `--plum` | `#7A5FA8` | Accent (not yet used on auth pages) |
| `--plum-d` | `#57427A` | *Derived* |
| `--ink` | `#3A2A1A` | Text |

The four `-d` (dark/shadow) values weren't specified explicitly — derived at
~15pt-lower HSL lightness, same hue/saturation as their base. Treat as
provisional, easy to hand-tune later.

- **Typography:** Baloo 2 (`@fontsource-variable/baloo-2`, self-hosted),
  scoped by wrapper classes: `.auth-page` here, and `.kid-app` / `.kid-font` on
  the student screens (see "Kid-facing app" below). It never overrides the
  app's global sans (Geist) on admin routes. **Amended 2026-09-30: Baloo 2 is no longer the only
  kid-app face.** Nunito (`@fontsource-variable/nunito`, latin variable file only, self-declared
  `@font-face` in `styles.css`, bundled by Vite so it works offline in Capacitor) is allowed for small
  UI text at the desktop shell (`.kid-app[data-shell='side']`, >= 1024px), never on mobile or admin
  (see "Desktop Home polish" under "Desktop shell and Home").
- **Card:** 26px border-radius, off-white surface (`#FFFEFB`, not pure
  white — distinguishes it from the page background), warm soft drop shadow
  (`rgba(58,42,26,…)`-based, not generic gray).
- **Primary button:** full-width pill (`border-radius: 999px`), `--gold`
  fill, "candy 3D" press effect — `box-shadow: 0 6px 0 var(--gold-d)` at
  rest, collapsing to `0 0 0 var(--gold-d)` with `translateY(6px)` on
  `:active`.
- **Page background:** pure white (`#FFFFFF`) specifically for `/login` and
  `/signup` — deliberate deviation from `--cream` as page backdrop (cream/
  gold/teal still used for accents and the button, just not this backdrop).
- **Links:** `--teal`, no underline by default, underline on `:hover`.

**Implemented on:** `/login` (`LoginPage.tsx`), `/signup` (`SignupPage.tsx`),
via shared `AuthCard`/`AuthField` in `src/components/auth/`, on pure white — see
"Kid-facing app" below for the cream/token-based system the actual student
routes use. The two share the Baloo 2 face and the token set, but the student
screens sit on `--cream`, not on pure white.

## Kid-facing app (student routes)

The first real student screen, `/courses/$courseId` (the course roadmap — a
learning path of modules and lessons). Mobile-first: designed and built at
390 px first, then scaled up; desktop is never the starting point. Priority
order for any kid-facing screen: phone in the Capacitor webview (390 px
baseline) → mobile/tablet web → desktop web.

**Tokens reused, one added.** Colors are the same locked `--cream`/`--gold`/
`--teal`/`--coral`/`--plum`/`--ink` set (plus their `-d` shadow variants) from
`styles.css` above — no new brand colors. One token was added there:
`--surface` (`#FFFEFB`), the off-white card color the auth card already used
as a literal hex; kid screens reference the token instead of repeating the hex.
**Font scoping rule for kid-facing surfaces.** Baloo 2 applies to every
student screen: the roadmap, module banners, lesson sheets, buttons and pills.
It is scoped by a wrapper class, the same pattern as `.auth-page`: `.kid-app` is
set on the `KidLayout` root (so everything under a student route inherits it) and
`.kid-font` is added to portaled UI that renders outside that root, currently the
lesson sheet's drawer and dialog (both defined in `kid.css`, sharing
`--font-kid`). shadcn's `DrawerTitle` and `DialogTitle` carry a `font-heading`
utility that would win over a component-layer rule, so the sheet titles add an
important `[font-family:var(--font-kid)]!`. Weights: bold (700 to 800) for
titles, buttons, pills and labels, regular (400) for body copy. **Admin routes
carry neither class and stay on Geist** (`font-sans`, set on `<html>`); this was
verified by computing the font of every element on `/admin`, `/admin/courses` and
`/admin/users` (all Geist) and by confirming no `.kid-app` or `.kid-font` element
exists there. A new portal that shows kid-facing text needs `.kid-font`.

**`src/kid.css`** (imported after `styles.css` in `index.css`, entirely inside
`@layer components` so Tailwind utilities like `lg:hidden` still win over it)
holds every kid-surface class:
- `.kid-app` / `.kid-topbar` / `.kid-main` — the `KidLayout` shell (below).
- `.kid-card` — the reusable raised surface: 26px radius, `--surface`
  background, warm soft shadow (the auth card's shadow recipe, tokenized as
  `--kid-shadow`). Reused for every state screen and the sheet/dialog.
- `.candy-btn` / `.candy-btn-quiet` — the candy 3D button: full pill,
  `box-shadow: 0 6px 0 var(--c-d)` at rest, collapsing to `0 0 0` with
  `translateY(6px)` on `:active` (identical recipe to `.auth-btn-primary`,
  generalized to take any token pair via `--c`/`--c-d`). `-quiet` is the
  secondary/outline version (Review, Go back).
- `.mod-0`..`.mod-3` — module color classes (gold, teal, coral, plum, cycling
  by the module's position on the page), each setting `--mod`/`--mod-d`/
  `--on-mod` (the text/icon color that clears contrast on that fill; plum is
  the one module color that needs cream text, not ink). They color the nodes;
  the module banner does not use them (it is always a soft gold tint).
- `.rm-*`: the roadmap, made of the flat module banner and its dots, the node layout
  (a per-row `--off` custom property weaves the nodes left and right), the
  connector SVG lines, the node states and animations, the sticky Continue bar.
- `.kid-font`: the font class for portaled kid UI (see the font scoping rule).

**`KidLayout`** (`components/kid/KidLayout.tsx`, `kidHeader.ts` for the
context/hook): a sticky top bar (Back button, page title truncated to one
line, safe-area padding) over a document-scrolling page — no inner scroll
container, so iOS momentum scrolling and the sticky roadmap banners behave.
A page calls `useKidHeader(title, fallbackPath)` to set the bar's title and
where Back goes if there's no in-app history (a deep link — checked with
`router.history.canGoBack()`, not `window.history.length`, since TanStack
Router's own index knows what `window.history` doesn't after a
`redirect`/`replace`). `--kid-bottom-inset` (kid.css, default `0px`) is where the
bottom nav reports its height: everything that pads for the bottom (the page, the lesson
player's sticky bar) reads it, and `.kid-app[data-nav]` sets it to `--kid-nav-h`. On the four
top-level screens the layout also drops the Back arrow (a spacer keeps the title in place).

**The roadmap** (`components/kid/roadmap/`, data in `lib/roadmap.ts` +
`hooks/useCourseRoadmap.ts`). Since 2026-09-26 there is no header block (no course art,
title or progress bar) and no Continue button: the screen starts at the sticky module bar,
flush under the top bar, and the path does the rest. Components: `RoadmapPath`,
`ModuleBar`, `RoadmapConnector`, `RoadmapNode`, `PathDecor` and `LessonPopover`. A lesson
with no module is just whatever `fn_course_lesson_states` sorts last (`schema.md`).

**Every visit opens the next step.** Each time the roadmap mounts (Home or the
`/courses/$courseId` deep link) it scrolls the next-up node (`roadmap.currentLessonId`) to
the middle of the screen, smoothly (instantly under reduced motion), and opens that node's
popover without a tap. The open is the popover's initial state, so no effect sets it.
Fallbacks: a finished course has no next-up node, so the page scrolls to a small "You finished
every lesson!" note after the last node and opens nothing; a locked lesson the player turned
away (`?open=`) is scrolled to and wiggled once, with no popover, and the param is cleared with
`resetScroll: false` (the router's default scroll reset otherwise jumped back to the top).

**Lesson popover** (`LessonPopover`, `.rm-pop`, replaces the bottom sheet). A small card
anchored to the tapped node by a triangular tail; no backdrop, no dimming, the path stays
visible. Gold (ink text, 7.33:1) for the next-up node only; `--teal-d` with cream text (6.2:1)
for every other unlocked node, completed or ahead; no third colour. Content: the lesson title,
"Lesson X of Y" (its place in its module) and one off-white (`--surface`) pill button with the
candy lip, labelled by the same state words the sheet used, with the XP still to earn inline:
"Start +25 XP", "Keep going +25 XP", "Review" (no XP on a completed lesson, which awards none on
replay). Sentence case like the rest of the kid app, not the brief's uppercase examples.
Placement is written straight to the element: centred on the node's real centre, clamped to the
path's width so it never clips at 360 to 430px, the tail kept on the node's centre; below the
node, flipped above (tail pointing down) when the viewport has no room under it, re-measured on
resize and after scrolling settles. One at a time: tapping another node switches, tapping the
open node or anywhere else closes it, Escape closes and returns focus to the node. It is a
non-modal `role="dialog"`; a tap or keyboard open moves focus to the button, the automatic open
does not. Locked nodes open nothing: a tap only wiggles them (decided 2026-09-26; the locked
sheet with "steps to go" is gone).

**Module bar (2026-09-26, replaces the boxed module banners).** There are no per-module
containers, headings, dots or borders on the path any more: the lessons of every module are
one continuous road. A single slim bar (`ModuleBar`, `.rm-modbar`) is sticky under the top
bar (and Home's stat bar) and names whichever module is in view. Since 2026-09-26 it floats
as a card: 18px radius on all four corners, inset from both screen edges by the page gutter
(1rem, cream showing either side), a soft shadow on every side (`0 8px 20px -6px` ink at 45%
plus a 1px ink 8% ring; no colour, gradient or icon added) and `--rm-bar-gap` (0.5rem) of cream
above it both at rest and when stuck (its sticky `top` adds the gap). Scroll-spy and the popover
measure its stuck bottom edge through `stuckModuleBarBottom` (`lib/stickyTop.ts`: its computed
sticky `top` plus its height), so the gap is included. It is scroll-spy
(`useModuleSpy`): every lesson row carries `data-module-key` and `data-unit`, and the active
row is the topmost one whose centre is below a reading line 40% of the way down the visible area
under the stuck bar; the module is that row's module, so the title changes only at a module
boundary while the unit changes lesson by lesson (one detection, not two). The line eases to the
bar's bottom edge at the very top of the page (over the first 40% of the visible height of
scrolling) and to the bottom of the screen at the very bottom (over the last 60%), so the first
lesson reads as Unit 1 before any scrolling and a short last module is reachable; a hand scroll
(wheel, touch, key, pointer) is what releases the initial pin described below.
Cream text on `--teal-d` for a module a child can work in (changed 2026-09-26 from ink on
`--teal`, 4.50:1: cream on plain `--teal` would have been 2.88:1, so the fill was darkened
rather than only the text lightened); a dimmer neutral with a lock icon when every lesson in it
is locked. It is flat, not a control, and never gold: gold stays
with the next-up node and its popover. A small caption sits above the title (`.rm-modbar-caption`, 2026-09-26):
"SECTION N, UNIT M", uppercase, letter-spaced, weight 600 at the caption size, in cream mixed 12% toward
`--teal-d` (5.22:1 measured; the title is 6.20:1; on the locked neutral it inherits the title's
colour). Our module is the Section (its 1-based place among the course's modules, in path order;
ungrouped lessons form a last "More to explore" section) and our lesson is the Unit (its 1-based place
within that module, restarting at 1 in every module); no new grouping level, nothing new in the
schema. A one-lesson module reads Unit 1 for its whole range. Until the child first scrolls by hand
the bar is pinned to the position the page is auto-scrolling to (the next-up lesson, the last lesson of
a finished course), so it is right from the first paint and matches the auto-opened popover even where
the end of the page keeps that lesson off the reading line. The title announces changes politely
(`aria-live`); the caption, which changes lesson by lesson, does not. The bar is about 62px tall now;
everything that measures it reads its live height. Where the
path crosses into a module, an inline divider marks it (next paragraphs).

**Continue bar.** Removed on 2026-09-26 (the next step now opens itself, see above); the bottom
nav took over the bottom edge on 2026-09-26.

**Bottom nav** (`KidNav`, `.kid-nav`, `kidTabs.ts`; 2026-09-26). Four tabs in order: Home
(`/`), Badges (`/badges`), Courses (`/courses`), Profile (`/profile`), lucide icons House,
Award, BookOpen, User. Shown only on those four routes (`tabForPath`); the lesson player and the
`/courses/$courseId` deep link keep their own bottom edge and get no nav. Fixed to the viewport
bottom, `--surface` with a hairline top border, `z-index` 35 (above the popover 15 and module bar
20, below the top bar 40). Content height `--kid-nav-h` (4.25rem); the safe-area inset is added in
the bar's own bottom padding via `var(--sa-bottom)`, so the home indicator never
covers a tab, and `.kid-app[data-nav]` sets `--kid-bottom-inset` to `--kid-nav-h` so `.kid-main`'s
bottom padding clears it. Active tab: ink icon and label with a soft teal pill
(`color-mix(teal 26%, surface)`, 26px radius) behind the icon, `aria-current="page"`; inactive:
`--kid-muted-fg`. Gold is not used (it stays "the next action"). Tapping the active tab is a no-op:
`preventDefault` on the link, so no navigation, no remount, no scroll change, and an open lesson
popover stays open (the roadmap's outside-tap handler ignores `.kid-nav`). The lesson popover
also treats the nav's top edge as the bottom of the viewport when deciding whether to flip
above its node. **From 1024px this bottom nav is not rendered at all**: a left sidebar replaces it
(below, "Desktop shell and Home (2026-09-30)"). Everything above is the mobile and 768-1023px nav.

**Courses, Badges, Profile** (`KidCoursesPage`, `KidBadgesPage`, `KidProfilePage`). Courses is the
course switcher: one `kid-card` button per active enrollment in a live, published course (title,
thumbnail or a book icon, a progress bar, "N of M lessons"), most recently used first; progress
comes from `fn_course_lesson_states` (published lessons only) under the roadmap's own query key;
tapping a row calls `fn_touch_enrollment`, seeds the Home query with that course, and goes Home.
Zero courses reuses `NoCoursesScreen`. Badges: a two-column grid (three from 640px) of every
active badge, earned ones with a coral medallion and "Earned", the rest muted with a lock and "Not
yet", plus "N of M earned"; no animation. **Badges is still intentionally minimal and needs a real
design pass.** Profile was rebuilt 2026-09-27 (below); "initial or avatar, name, Level, XP and Day
streak cards, and a quiet Log out button" is what it looked like before that.

### Profile (2026-09-27, redesigned same day): avatar, editable account, a real streak view

Same page (`KidProfilePage`), no longer minimal: a tappable avatar that opens the builder, the
Level/XP/streak cards, a streak calendar, an account card (name, email, password) and Log out. Two
decisions, both explained in `schema.md`: the streak calendar reads `xp_transactions.created_at`
directly rather than a new log table, and the email address changes by syncing against the
confirmed Auth session on read, rather than a client-held pending flag. **The first build's visuals
didn't match the app's language (a literal cartoon face, flat-outline stat icons, plain white
button pills, one undifferentiated form) and were corrected the same day** — the paragraphs below
describe the corrected, current state only; see `changelog.md` for both dates.

**The avatar is procedural, never an image (rebuilt 2026-09-30 as a small geometric mascot; v2).**
It used to be an abstract emblem ({base, topper, face, accent}); it is now a character with eyes, a
mouth, glasses, headwear, extras and a backdrop. Locked decisions that did not change: SVG built in
code from design tokens, no art assets, one component everywhere.

- **Config** (`src/lib/avatar.ts`, pure TypeScript, the one place option sets live):
  `{ v: 2, base, eyes, mouth, glasses, head, extra, backdrop, tints }`. `base` is gold / teal / coral /
  plum (the roadmap's module colours). `tints` holds a colour per slot the student has coloured
  (`glasses`, `head`, `extra`, `backdrop`), each from six swatches: gold, teal, coral, plum, ink, cream.
  A part with no stored tint uses its catalogue default. `DEFAULT_AVATAR` is the old default mapped
  (teal, round cap, happy eyes, smile); the first spec said "plum" but the shipped default was always
  teal, so it stays teal.
- **Options per slot (Phase 1: every one is free for every student; unlocks are a deliberately deferred
  later phase and nothing here knows about XP, badges or `gamification_enabled`).** Body colour 4.
  Eyes 6: round, happy, sleepy, wink, sparkly, wide. Mouth 5: smile, big grin, open, tongue out,
  surprised. Glasses 5: none, round, square, star, sunglasses (all tintable frames). Head 12: none, then
  the five ported toppers (spiky hair, round cap, star topper, antenna, hair bow; body `-d` shade, not
  tintable, exactly as before), then baseball cap, beanie, crown, wizard hat, graduation cap,
  headphones (tintable). Extras 9: none, the four ported accents (gold star, tape stripe, dots, heart;
  fixed colours), bow tie, scarf, cape (tintable), blush cheeks. Backdrop 6: none, solid, dots,
  stripes, sunburst, rings (tintable, drawn as a circle behind the character where the white ring is).
- **`normalizeAvatarConfig(raw)`** is the only reader of stored JSON (`useKidProfile` calls it; the
  profile, the nav tab and the sidebar get its result). It never throws and never returns something
  that renders blank: a non-object is the default; a bad VALUE falls back per field (one bad key does
  not reset the avatar); bad tints are dropped. **Legacy mapping** (a config with no `v`): base stays;
  topper becomes `head` and accent becomes `extra` with the same ids; the old cream-band `face`
  becomes eyes + mouth (+ glasses): happy = happy eyes + smile, wink = winking eyes + grin, silly = wide
  eyes + tongue, cool = round eyes + smile + sunglasses, sleepy = sleepy eyes + smile. New slots default to
  none. Nothing is rewritten in the database on read; the first Save writes v2.
  `scripts/check-avatar.mjs` (run with `node --experimental-strip-types scripts/check-avatar.mjs`; no
  test runner exists in the repo) checks all of this, including every legacy combination.
- **Registry and z-order** (`components/kid/avatar/`): `registry.tsx` maps every catalogue id to
  `{ layer, Render }` (typed `Record<Id, ...>`, so a missing or extra entry is a compile error); `parts.tsx`
  holds one small component per part; `geometry.ts` holds the anchors and the layer order. Adding a part
  = a catalogue row in `lib/avatar.ts`, a registry entry, one SVG component, plus the id in the database
  function's list (below). Layer order, back to front, defined once (`AVATAR_LAYERS`): backdrop,
  extras-behind, body, eyes, mouth, cheeks, glasses, headwear, extras-front. (The first brief listed
  extras-behind after body; a cape has to be BEHIND the body, so it draws before it.)
- **Shared anchors** (one 100x100 viewBox; body circle centre (50, 61) radius 34; pale face plate; eye line
  y 59 at x 38 / 62; cheek y 68; mouth y 72; chest y 84; headwear never lower than y 50). Every part is
  drawn against these only, so any hat fits any head and any glasses fit any eyes on all four body
  colours. Checked: every part x all four bodies, and 11 headwear x 4 glasses combinations (crown +
  headphones is not possible: one headwear slot); nothing clipped or misaligned, no combo needed
  restricting. Tint check: every tintable headwear in all six colours, glasses, scarf, bow tie, cape and
  backdrops in six colours (a cream backdrop is near-invisible on the cream page, by design).
- **Depth**: radial-gradient body (highlight to `-d`), soft highlight ellipse, ground-shadow ellipse,
  part shading via `color-mix` against ink, glints on lenses. **No SVG filters** (blur, drop-shadow):
  costly and inconsistent in Android WebView; the old CSS `drop-shadow` on the svg is gone too. Every
  gradient and clipPath id carries a per-instance `useId` prefix; a shared id makes every avatar on the
  page take the first one's gradient (verified: no duplicate ids with the preview, 12 tiles, nav and page
  on screen, colours right in all). Readable at 24, 40 and 180px (strokes >= 2.5 units, chunky shapes).
- **Where it renders** (all through `Avatar`, sizes unchanged): builder preview 152px (200px desktop,
  the only animated one), builder tiles (static, ~68px), profile hero 96px, bottom-nav Profile tab 28px,
  desktop sidebar Profile item 28px.
- **Animation, preview only** (`animated`, Framer Motion): idle bob 2.5px over 3.2s, a blink every ~4s
  (eyes scaleY), a 1.06 pop whenever an option, colour or Shuffle changes. Tiles, nav and sidebar are
  plain `<svg>` with no motion code. All of it is off under `prefers-reduced-motion` (measured: one
  distinct transform in six seconds, no blink, no pop).
- **The builder** (`AvatarBuilder`, css `.avb-*`; replaces `.av-*`): the entry point, edit mode, Cancel
  and Save semantics are unchanged (the page still owns `onSave`). *Mobile*: a fixed-height column so
  the page does not scroll on a phone: preview (152px in the white ring) with Shuffle beside it, the
  tab bar, the options region (the only scroller), then Cancel / Save. *From 1024px*: two columns,
  preview + Shuffle + Cancel/Save on the left (sticky), tabs + options on the right, 6 tiles per row,
  Nunito for the small text per the desktop type roles. **Seven tabs** (Colour, Eyes, Mouth, Glasses,
  Head, Extras, Backdrop; Lucide icons), an accessible tablist (roving tabindex, arrows / Home / End),
  never a scrollbar: below 30rem only the active tab shows its label (six 44px targets + the active
  one fill 328px, a 360px phone less gutters); wider, all labels. **Tiles** are a radiogroup
  (`role="radio"`, `aria-checked`, name from the part label, arrow keys): each is the FULL avatar with
  that option applied (Eyes / Mouth / Glasses zoom the viewBox into the face), optional slots have a
  "None" tile (ban icon), the chosen tile has the teal ring AND a check badge (never gold, not colour
  alone). The colour row (six 44px swatches, check on the chosen one, names like "Teal") appears under
  the grid only when the chosen part is tintable; the Colour tab is the four big body tiles (no separate
  swatch row, it would only repeat them). **Shuffle** randomises every slot and every tintable
  colour. Save avatar stays the only gold on the screen. The preview has an `aria-live="polite"`
  description ("Your avatar: teal body, happy eyes, smile, round glasses, baseball cap") that changes only
  when the config does. Save writes `profiles.avatar_config` and updates the `useKidProfile` cache at
  once, so the nav and sidebar change with no reload. A failed save leaves the builder open with the
  buttons re-enabled and no message (unchanged from the first builder; noted as a follow-up).
- **Verified** (Chromium, live project, throwaway students removed after): 360x780, 390x844, 768x1024,
  1280x800, 1920x1080: no horizontal scrollbar, all seven tabs inside the viewport at 360, the page does
  not scroll on phones, the desktop layout correct; every tab screenshotted at 360 and 1280; keyboard
  (tabs, tiles, swatches, Tab order Shuffle > tab > tile > swatch > Cancel > Save, 3px ink focus ring);
  save, reload (persists, reappears in the nav, stored row is v2 with tints), Cancel discards, a failed
  PATCH keeps the builder; tab switches settle in about 25-70ms including two frames. **Not
  exercised:** Android WebView (`adb` is installed but no device or emulator is attached), a screen
  reader, Firefox / Safari.
- **Stat cards** (Level/XP/Streak): each icon is now a solid colour-circle badge with a cream
  icon and a `-d` shadow beneath — exactly `.lp-callout-icon`'s pattern (`.kp-stat-icon[data-color]`,
  reusing its `--callout`/`--callout-d` custom-property trick), one distinct token per stat (teal,
  plum, coral) so the three read as different things, not one repeated icon in three colours.
- **Name/Email/Password buttons**: `.candy-btn` (the gold candy-3D fill-and-shadow button, the same
  class the lesson completion CTA uses), not the plain outline pill. Log out stays `.candy-btn-quiet`
  (already the app's own standard secondary-button treatment, used elsewhere for Cancel/lesson-bar
  actions — deliberately quieter, not unstyled).
- **Name**: a plain field bound to `profiles.display_name`, saved directly, no confirmation —
  reuses `AuthField`/`.auth-field-error` (`styles.css`, the login/signup pages' own error style) so
  a validation message never needed a second look.
- **Email**: `supabase.auth.updateUser({ email })`, which only asks Supabase Auth to send a
  confirmation link; the form then shows "Check `<new>` to confirm the change. Your email stays
  `<old>` until you do." and nothing in `profiles` changes yet (`schema.md`'s sync note). A failed
  send (this shared test project's built-in mailer is rate-limited; verified by mocking the auth
  call's response rather than exhausting the real quota further) shows the same `.auth-field-error`
  text as the other two forms.
- **Password**: current password first, checked by calling `signInWithPassword` with it (a
  lightweight safeguard against a shared or left-open device, not full reauthentication) before
  `updateUser({ password })`; the minimum length (8) reuses `SignupPage`'s own rule rather than a
  second one. A wrong current password shows "That isn't your current password." and changes
  nothing.
- **Account card structure**: the three actions are visually bounded sub-sections
  (`.kp-subsection`: a faint ink-tinted panel plus top spacing), each with its own small-caps label
  (`.kp-subsection-title`, muted, uppercase) distinct from the `AuthField` labels beneath it — the
  card no longer reads as one long form.
- **Account & Security is collapsed by default** (2026-09-27). The card's `<h2>` wraps a button
  (`.kp-collapse-trigger`, the WAI-ARIA disclosure pattern — a heading around the interactive
  control, so it still reads as a heading either way) with a chevron that rotates 90° open; the
  body (`.kp-collapse`) expands/collapses with a CSS-only `grid-template-rows: 0fr → 1fr`
  transition (no JS height measurement), skipped under `prefers-reduced-motion`. Plain `useState`,
  no route change — the three forms are the same ones described above, just hidden until opened.
- **Preferences & Support** (2026-09-27, new card between the streak calendar and Account &
  Security): three sub-sections in the same `.kp-subsection` pattern as Account, so it reads as
  one more instance of a pattern already established, not a second visual language.
  - **Sound effects**: a custom on/off switch (`.kp-toggle`, not the shadcn `Switch` — that
    component is themed for admin's neutral palette via `bg-primary`/`bg-input`, which would have
    looked out of place next to candy buttons). Persisted to `localStorage`
    (`kid.soundEffectsEnabled`, `useSoundEffects`), not a `profiles` column: a pure per-device
    convenience with no cross-device sync need, so it needed no migration. Defaults on. **No sound
    effects are wired up anywhere in the app yet** — this ships the preference switch only, ready
    for when they are.
  - **Help & Support**: one row (`.kp-row`, a colour-circle icon badge + label + chevron, the same
    icon-badge trick as `.lp-callout-icon`/`.kp-stat-icon`) that opens the device's mail client via
    `mailto:`. **The address is a placeholder** (`support@wisdomhatch.example`, the `.example` TLD
    reserved for exactly this) — needs the real support address before ship.
  - **About**: the installed app version (`__APP_VERSION__`, a Vite `define` reading
    `package.json`'s own `version` at build time — no second hardcoded copy to drift from it) plus
    two more `.kp-row`s for Privacy Policy and Terms of Service. **Both URLs are placeholders**
    (`https://wisdomhatch.example/privacy` and `/terms`) — need real legal pages before ship.
- **Request account deletion** (2026-09-27, nested inside the expanded Account & Security, below
  Password): a low-emphasis coral text action (`.kp-danger-link`, no button fill — deliberately
  quieter than every gold action above it), not a self-serve hard delete. Tapping it opens a
  confirm dialog (`Dialog`/`DialogContent`, `kid-card kid-font` styling — the same portaled-dialog
  pattern `LessonCompleteSheet` already uses, since Radix portals it outside `.kid-app` where
  `.kid-font` is what keeps it on Baloo 2 instead of falling back to admin's Geist) with a coral
  confirm button (`.candy-btn[data-tone='coral']`, the same data-attribute token-swap trick as
  `.lp-callout-icon[data-color]`) before anything happens. Confirming only inserts one row into
  `deletion_requests` (`schema.md`, migration 027) — consistent with the app's archive-only
  philosophy (section 7), never an immediate delete. Once a request exists, the row is replaced by
  a plain "Deletion requested" note (`useDeletionRequest` reads the student's own existing row, so
  this survives a reload and can't be double-submitted from the same UI). No admin-side action on
  `deletion_requests` is built — a deliberate later task.
- **Streak calendar** (`StreakCalendar`): 5 weeks, 7 columns aligned Sun-Sat (leading cells padded
  to the first day's real weekday), oldest day top-left. A filled cell is now solid `--teal` with
  its own `-d` shadow (`.kp-cal-cell[data-active='true']`) rather than a flat `--teal-d` fill, so
  active reads as a distinct colour-plus-weight, not a darker shade of the same muted tan; today
  still gets an ink ring whether or not it is filled, so the child can find "today" before earning
  anything. No streak-broken language anywhere — a quiet pattern of good days, not a report card.
  The card sits in normal document flow below `.kp-stats` and above the Account card, and
  `.kid-main`'s bottom padding already reserves `--kid-bottom-inset` for the nav — checked
  empirically at 360–430px width (640–932px tall, including a short 375×667 case) with nothing
  clipped behind the nav in the settled render.
- **Unlocks are a later phase, deliberately not built**: every avatar option is free (Phase 1). A later task could gate a part behind a badge or a level; the catalogue has no ownership concept yet.

**Module divider** (`ModuleDivider`, `.rm-divider`, 2026-09-26). Before the first node of every
module after the first: a short rule, the module's name (`section.title`, the same text as the
sticky module bar, up to two lines), a second short rule, on the cream page background in muted ink
(`--kid-muted-fg`, 5.46:1; the rules are decorative). Fixed height `--rm-div-h` (6.5rem), which
`PathDecor` counts (`breaks`, `--d`) so the background shapes stay aligned with the rows; it
covers the connector for its height, which reads as a break in the road. Not interactive:
`pointer-events: none`, no tab stop, `role="separator"` with an `aria-label`. It appears at every
boundary, including before a module that is still fully locked.

**Stat bar** (`StatBar`, `.kid-statbar`; Home only, 2026-09-26). A slim 3rem row, sticky at the very top of the screen
(below the safe-area inset only) and above the module bar, full-bleed on the cream page with a hairline bottom
border. Left: two `--surface` pills with the inset ring the XP chips use, a flame (`--coral-d`) with
the current streak and a spark (`--plum-d`) with lifetime XP (`user_stats.total_xp`, never
level-relative), ink numbers at weight 500; gold is not used. Right: the course name as a link to
`/courses`, deliberately not a pill: `--teal-d` text (6.2:1), bold, underlined, with a chevron,
truncated with an ellipsis, a 44px tall hit target. Numbers come from `useKidProfile` (the Profile
screen's query; no second fetch of `user_stats`); a student with no stats row shows 0 and 0, and a
dash stands in only while loading or on error. The course name is read from the roadmap's own cached
content query (`useQuery` with `enabled: false`, never fetches) for the `fn_home_course` id; the
link is absent while there is no course. On Home the kid top bar collapses
(`.kid-app[data-home]`, set by `KidLayout`): its row (Back spacer, title, right slot) is
`display: none`, its bottom border is dropped and `--kid-topbar-h` becomes `0px`, so only the
safe-area padding is left and the stat bar sits flush at the top; `CourseRoadmapView`'s `showTitle`
is false there. The `/courses/$courseId` deep link and every other route keep the full top bar
(verified pixel-identical before and after at 360, 390 and 430px). **Sticky stack:** `.kid-home` sets `--kid-top-inset` to
`--kid-statbar-h`, the module bar's `top` adds it (default `0px` off Home, same pattern as
`--kid-bottom-inset`), and scroll-spy and the popover measure the stack through
`lib/stickyTop.ts` (`stickyTopEdge`: the lower of the top bar's and stat bar's bottom edges) instead
of hardcoding anything. Nothing needed a new constant when the top bar collapsed: the stat bar's and
module bar's `top` are built from `--kid-topbar-h`, and the measuring code reads the live rects. Gems and hearts/energy are still deferred, with no placeholders.

**Path spec.** (One connector for the whole course since 2026-09-26; the sway below is continuous across modules.) The connector is an SVG behind the nodes, generated from the
measured centres of the real node elements (`useNodeCenters` reads
`[data-rm-anchor]` boxes with a `ResizeObserver`, `lib/roadmapPath.ts` builds the
path), never from hardcoded coordinates: a smooth solid S-curve (cubic segments
that leave and arrive vertically), 7 px wide, round caps, `aria-hidden`. Muted tan
(`--kid-line-base`, a `color-mix` of `--ink` into `--cream`) for the way ahead;
`--gold` for the way travelled, drawn from the first node through every completed
one to the next (the active) node. One path per module, none between modules,
none for a module with a single lesson. It re-measures on resize, so it follows
the nodes at 360, 390 and 430 px and at any lesson count (verified: every
segment endpoint lands within 1.5 px of its node centre, including after
resizing the viewport). It does not animate, so there is nothing for
`prefers-reduced-motion` to turn off there.

**Node hierarchy.** The active node (available or in progress) is the strongest
thing on the path: 76 px (84 px at `md`), with a gentle idle bounce. Completed
nodes are 64 px with a check and a star. Locked nodes are 56 px (still above the
44 px tap minimum), a real grey fill (`--ink` 20% into `--cream`, so it reads as grey and not as another colour) with the lock icon kept on top, and a softer title. The
bounce and the tap wiggle animate a wrapper inside a static fixed-size box, so the
measured anchor never moves. The lesson-type badge (video, game, quiz, reading) is
30 px, cream icon on ink (12.9:1), and shows on locked and completed nodes; the
active node shows the type icon large in the middle instead. XP and minimum-time
chips show on active and completed nodes only; a locked node shows its title only.
States are never color alone (`rules.md`): `locked` is a lock icon on a small pale
node; `available` is the module color with a pulsing ring (static ring under
reduced motion); `in_progress` adds a `conic-gradient` ring for
`active_seconds` over `min_time_seconds` (a plain full ring when the minimum is
0); `completed` swaps the icon for a check with a star badge. Every node is a real
`<button>` with `aria-label="Lesson N, <title>, <type>, <state words>"` (locked
nodes say "locked"). Tapping a locked node wiggles it for 0.6 s. Idle bounce, wiggle
and the pulse are all disabled under `prefers-reduced-motion`. This kid-facing
motion allowance is separate from the admin `@dnd-kit` no-animation rule, which is
unchanged.

**Home and the winding path (2026-09-26).** `/` is the roadmap of the most recently used
course (`KidHomePage` > `CourseRoadmapView`, shared with the `/courses/$courseId` deep link;
the top bar has no Back arrow on Home). The path is one road: nodes sway left and right on a
sine-like rhythm (`lib/roadmapWeave.ts`, eight nodes per period, never restarting per module,
amplitude `clamp(1rem, 16vw, 4.5rem)`, chosen so a title still fits inside a 320px screen)
and one SVG connector runs through all node centres (teal for the way travelled).
`PathDecor` is the background: procedural shapes only, no artwork (soft teal blobs, plum dot
clusters and rings, a teal squiggle, a coral sparkle), each a low-opacity `color-mix` of a
token, one per row on the side opposite that row's node, absolutely placed from the row index
(rows are a fixed height) inside an `overflow: hidden` layer, `aria-hidden`, no motion, so it
cannot cause horizontal scroll. Titles stay under every node.

Verified in Chromium against the live project: no horizontal scroll at 360/390/430, one
connector path and no per-module sections, ten decor shapes for ten lessons, the locked node's
computed fill grey with its icon, the bar switching across three modules with the locked
variant, and signed-out, zero-enrollment, single-enrollment and multi-enrollment Home.
**Follow-up flagged**: the zigzag geometry was checked at three phone widths and on one
ten-lesson course only; a course with dozens of lessons, tablet and desktop widths (where the
sway amplitude is fixed at 5.5rem) and the reference screenshot's exact rhythm still want a
visual pass. The Home course header was removed on 2026-09-26.

**Locked lesson sheet.** Removed on 2026-09-26 with `LessonSheet`; a locked node only wiggles.

**Responsive tiers**, mobile-first (base is the 390 px design, `md`/`lg` only
add): base (< 768 px) is the single-column layout above with the sticky Continue
bar in the thumb zone; `md` (≥ 768 px) widens the zigzag and
switches the sheet to a centered dialog, content column capped at a
comfortable width; `lg` (≥ 1024 px) becomes two columns — a sticky summary
card on the left (art, title, progress, Continue, lessons-done/XP stats) and
the roadmap on the right, and the Continue bar and the mobile course header both
disappear (the summary card replaces both).

**Mobile app rules — standing rules for every kid-facing route, not just this
page** (also `rules.md`): touch targets ≥ 44 px, nothing depends on `:hover`
(hover styles only inside `@media (hover: hover)`); `100dvh` never `100vh` for
full-height layouts; `viewport-fit=cover` is set in `index.html` and every edge
that can meet a notch or home indicator pads with the `--sa-*` tokens ("Native shell" below);
no text a child must read below 14 px; `-webkit-tap-highlight-color`/
`user-select`/`touch-action` are turned off on interactive elements only
(`.kid-tap`, kid.css) — never on text; images reserve their aspect ratio
(`CourseArt`'s `aspect-[16/9]`) and skeletons match the real layout, so nothing
shifts as data loads; no heavy new dependencies for a kid screen (this task
added only `vaul`/shadcn `drawer`, already a peer of the installed `dialog`).

**shadcn `drawer` was added this task** (`npx shadcn add drawer`, wraps
`vaul`). It lands under `@/components/ui/` like every other shadcn primitive —
the CLI's Windows path bug (an `@/` folder appearing at the repo root instead
of resolving the alias) recurred and was moved into `src/components/ui/` by
hand, same as past additions; the generated file's `import { cn } from "cn"`
(a nonexistent package the CLI adds) was corrected to `@/lib/utils`, and its
`max-h-[80vh]` became `max-h-[85dvh]` per the `vh`-never rule above.

**Verified in the review (Chromium, real JWTs against the live project,
2026-09-20):** contrast — ink on cream 12.94:1, chip text 13.64:1, every
module's banner text ≥ 4.5:1 and node icon ≥ 3:1 including the dimmed/locked
state; every node ≥ 56 px, Back/Continue ≥ 44 px, no visible text under 14 px;
keyboard — Tab reaches nodes in DOM order with a visible focus ring, Enter
opens the sheet with focus moved to its primary action, focus stays trapped
inside while open, Escape closes it and returns focus to the node (verified
both as a drawer at 390 px and a dialog at 768 px); reduced motion — no
auto-scroll, the pulsing ring stops animating but stays visible as a static
ring; no horizontal overflow or element outside the viewport at 320/360/390/
430/768/1024/1280 px (a 2px `scrollWidth`-over-`clientWidth` reading on
`-webkit-line-clamp`ed labels is a known measurement quirk of that property,
confirmed against `document.documentElement.scrollWidth`, which stayed exactly
equal to the viewport at every width — not a real overflow). Screenshots were
saved to `review-shots/` (gitignored, not in the repo) and are not part of this
commit. NOT exercised: a real device or the Capacitor webview, real safe-area
insets, the native back button (built since, `ui.md` "Android Back button"), and a physical screen reader (only programmatic
`role`/`aria-label`/focus checks).

**The lesson player** (`pages/LessonPlayerPage.tsx`; components in
`components/kid/player/`; helpers in `lib/lessonPlayer.ts`; copy in
`lib/playerCopy.ts`; data in `hooks/useLessonContent.ts`; the timer in
`hooks/useLessonClock.ts`; styles are the `.lp-*` block in `kid.css`, in
`@layer components`). The page picks the screen from server answers
(`routes-permissions.md`); the lesson itself is `PlayerLesson`, keyed by lesson
id so "Next lesson" starts clean. It holds no rules: time, pass, completion and
XP all come from the engine's replies. Redesigned to a dedicated UI/UX spec on
2026-09-23 (below); the server contracts and sandbox rules from the original
build did not change.

Component tree: `LessonPlayerPage` > `PlayerFrame` (screens: `NotEnrolledScreen`,
`EnrollmentExpiredScreen`, `LessonUnavailableScreen`, `LessonRetryScreen`,
`PlayerSkeleton`) or `PlayerLesson` > `LessonPlayerShell` > (`ActiveTimeRing`,
portalled into the top bar's right slot; `PausedNotice`; type/XP/minimum-time
chips; a Completed chip in replay; summary; the lesson body: `VideoLesson` |
`DocLesson` | `GameLesson` | `QuizLesson` > `QuizStepDots` / `QuizQuestion` /
`QuizFeedbackPanel` / `QuizResultView`; then `PlayerBar` > `PrimaryButton` /
`PrimaryLink`) and `LessonCompleteSheet` (with `Confetti` and `useCountUp`).
Errors and empty content share one pattern, `PlayerError`.

**Gamification-off courses hide every reward (2026-09-28, migration 030).** For a
course with `gamification_enabled = false` a student sees no XP anywhere: no "+N XP"
chip on roadmap nodes or in the lesson popover (`roadmap.ts` sets `xp = null`), no XP
pill on the video, doc or quiz lesson pages (`LessonPlayerPage` passes `xp` only when
`lesson.gamificationEnabled`), no XP line in the completion sheet, quiz result or
game result (they render only when the engine's `xpAwarded > 0`, and it is 0 for
these courses). There is no level-up UI. Completion is still celebrated: the
completion sheet's medallion and confetti show on every first completion, not only
when XP was earned. **Home's stat bar** (`StatBar`) hides the streak and XP pills
when the Home course has the flag off, and also while the flag is still unknown (the
roadmap query is loading, or there is no course), reading the flag from the
roadmap's already-cached content query, so no new request; the bar keeps its fixed
height and the course-name link stays pinned right (`margin-left: auto`). Badges,
Courses and Profile are global and unchanged. Checked in Chromium at 360, 390 and
430px against a gamification-off and a gamified fixture. (The game lesson's own
in-frame result was verified through the engine reply, `xp_awarded = 0`, not by
playing a real game bundle.)

**Android Back button (2026-09-28).** Native only (`Capacitor.isNativePlatform()`):
on the web nothing registers and browser Back is untouched. One listener,
`AndroidBackButton` (`components/native/`), mounted once beside the router in
`main.tsx`; the decision is the pure `decideBackAction` (`lib/backButton.ts`). Priority,
first match wins, one action per press:
1. **An open overlay closes**, the most recently opened first, and nothing else happens.
   Registered through `useBackClosable(open, close)`: the roadmap lesson card **only when
   the child opened it by tapping a node** (the card Home opens by itself on arrival is not
   registered, so Back on Home goes straight to the exit toast), the completion sheet (dialog
   or drawer), the active-time ring's popover, fullscreen video (exits fullscreen), the
   Profile avatar builder (cancels it), the delete-account confirm, and the "Leave this
   lesson?" dialog itself (Back = Keep going). The Profile "Account & Security" section is
   inline, not an overlay: Back on Profile goes Home whether it is open or not. Anything never wired
   (admin dialogs, dropdowns, selects) is caught by a safety net: an open Radix layer is
   closed with the same Escape it already handles. This applies on admin routes too, so
   the app never exits or navigates under an open overlay.
2. **A guarded lesson asks first**: a quiz with at least one answer locked in and not yet
   graded, or a game lesson in play (`useLeaveGuard`). A themed dialog (kid card, Baloo 2,
   coral icon badge): "Leave this lesson?" / "If you leave now, you will start this one
   again next time." with **Keep going** (gold, primary) and **Leave** (quiet). Leave goes
   back, or up to the course. Video and doc lessons never ask; they just go back. Never on
   admin.
3. **Badges, Courses or Profile** go to Home with `replace`, so Back never bounces between tabs.
4. **Home, login, signup (and `/admin`)**: press again to exit. The first press shows a
   small toast, "Press back again to exit", for 2 seconds; a second press inside that
   window calls `App.exitApp()`. The window then resets.
5. **Otherwise** history back if the router says there is any (`router.history.canGoBack()`,
   TanStack's own per-entry index, reliable after replaces), else one level up with
   `replace`: a lesson to its course, a course to Home, an admin page to `/admin`. Never
   a loop: every fallback is a parent that itself has a defined Back.
Admin routes use rules 1, 4 and 5 only. The listener is removed on unmount.

**Native shell (2026-09-28).** Everything here is native only (`Capacitor.isNativePlatform()`,
or CSS under `html[data-native]`, set by `initNativeShell()` in `lib/nativeShell.ts`); the web
renders exactly as before.
- **Safe areas.** Android 15+ draws edge to edge. Insets come from the `--sa-top/right/bottom/left`
  tokens (`styles.css`), each `var(--safe-area-inset-X, env(safe-area-inset-X, 0px))`: Capacitor 8's
  SystemBars sets the inner var natively, the web falls through to `env()`. They are applied ONLY by the
  shared shells: the kid top bar, bottom nav, Home stat bar, lesson player bars and completion sheet
  (kid.css), `.auth-page` and `.admin-shell` (styles.css, native only). Pages never pad for insets
  themselves; the cream background stays full-bleed under the system bars. `SystemBars.style = LIGHT`
  (dark icons) is right for cream.
- **Keyboard** (`@capacitor/keyboard`, activity `adjustResize`). While it is open
  `html[data-keyboard='open']` hides the bottom nav (so it never rides above the keyboard) and zeroes
  `--kid-bottom-inset`; on show, the focused field scrolls to the centre of what is left.
- **WebView polish, kid screens only (`.kid-app`), never admin or auth:** no overscroll glow
  (`overscroll-behavior: none`; Android WebView has no pull-to-refresh), transparent tap highlight,
  `touch-action: manipulation`, `user-select: none` on the shell with `text` restored on inputs and
  lesson reading text (`.lp-blocks`, `.lp-block-p`, `.lp-callout-text`). Pinch zoom is already off in
  Capacitor's WebView (built-in zoom disabled natively); the viewport meta is untouched, so the OS
  font-size setting still scales text.
- **Offline banner.** `OfflineBanner` in `KidLayout`, driven by `useOnline()` (`@capacitor/network`
  natively, `navigator.onLine` on web; one hook for both): a fixed pill under the top inset, surface with
  a coral ring and WifiOff icon, "You're offline. Check your Wi-Fi.", `role="status"`, never blocks
  taps. Native only; on the web the lesson player's own offline strip is unchanged. There is no offline
  queue: completing a lesson, submitting a quiz or earning XP offline shows the existing error with Try
  again (the engine maps a failed fetch to "Couldn't reach the server..."), never a false success. A
  game whose entry page is cached still cannot open offline: the lesson route loads lesson states and
  the lesson row from the server first and shows its retry screen.
- **Keep awake** (`useKeepAwake(active)`): while a video is playing and while a game lesson is on
  screen; released on pause, leave, unmount and in the background.
- **Lifecycle.** The lesson clock also listens to `appStateChange`: going to the background (or
  leaving the lesson) sends one final beat so the stretch since the last beat is credited, then pauses;
  returning resumes through the usual quiet period. A video still pauses itself when hidden.

**Haptics (2026-09-28).** `lib/haptics.ts` (`tap`, `select`, `success`, `warning`,
`error`) wraps `@capacitor/haptics`; each is a silent no-op on the web, when the child
turned it off, or if the plugin throws. **Kid-facing only, never admin, one haptic per
event**: a second haptic within 400 ms is dropped, and coinciding moments are designed to
produce one. Placements, and only these: quiz answer locked in (`success` right,
`error` wrong); quiz graded (`warning` fail; `success` pass, unless that pass opens the
completion celebration, whose own `success` is the moment's haptic); the shared gold
completion celebration (`success` once, on open, not for an already-completed replay); a
bottom-nav tab to another tab and an unlocked roadmap node tap (`tap`); the Profile sound
and haptics toggles (`select`; turning haptics off is silent because the setting is saved
first). The spec's separate "XP award" `tap` never fires on its own today: every XP award
in the kid app is shown on the completion celebration, so it is folded into that one
`success`. Nothing on scroll, drag, or ordinary buttons. **Profile toggle**: "Haptic
feedback" sits directly under "Sound effects" in the renamed "Sound & haptics" subsection,
same switch style, default on, stored like sound (`localStorage` `kid.hapticsEnabled`,
`useHapticsSetting`). Both rows also show on the web, where neither does anything yet.

**Splash, entrance and launcher owl (2026-09-29).** The Wisdom Hatch Kids owl is the
brand mark, on native only, in three places, from two separate pieces of artwork.
The splash and entrance below use one finalized, pre-cropped SVG. **Its four colors —
teal `#18B6C9`, light teal `#6FE0EC`, ink `#231F20`, gold `#FFC83D` — are hardcoded at
both use sites below and deliberately NOT locked design tokens** ("Colour roles" below):
they are the mark's own brand colors, not reused anywhere else in the UI, and must not be
added to the token set or used to recolor anything else. This is the one place in the
app hex is hardcoded on purpose (the launcher icon below is a separate raster asset,
not CSS, so it has no token question). **Third use site (2026-09-30):** the desktop sidebar logo
(`KidSidebar`) renders the same `OwlMark` component from `AppEntranceSplash.tsx`, so the mark's hex still lives
in that one component; it is the brand mark itself, not a reuse of its colours, and it applies on the web too.
- **Native cold-start splash** (`android/app/src/main/res/drawable/owl_splash_icon.xml`,
  `values/styles.xml` `AppTheme.NoActionBarLaunch`): a static vector redraw of the mark
  (eyes open, no blink — nothing here can move) as `windowSplashScreenAnimatedIcon`,
  centered over the existing solid cream `windowSplashScreenBackground`
  (`@color/splash_background`, unchanged). Android 12+ reads this from the theme
  directly; API 24-30 needs the AndroidX compat library to actually draw it, which needs
  `SplashScreen.installSplashScreen(this)` called before `super.onCreate()` in
  `MainActivity.java` (added this task — the theme attributes alone do nothing pre-31
  without it, so the compat dependency already in `build.gradle` was previously unused).
- **In-app entrance** (`components/AppEntranceSplash.tsx`, mounted once around
  `<RouterProvider>` in `main.tsx`): plays once per cold start, native only
  (`Capacitor.isNativePlatform()`; the web renders children immediately, unchanged). It
  is an overlay, not a gate — the router resolves auth/routing underneath it in
  parallel, and whatever it lands on (Home, login, a loading state) is simply revealed
  when the overlay's own fixed ~950ms timer ends and it fades out over 150ms (no
  timeout/cap logic, nothing waits on it). The owl (inline SVG, so the pupils can be
  targeted) scales in from 0.3x with a slight rotation and settles with overshoot
  (`cubic-bezier(.34,1.56,.64,1)`), a soft teal radial glow behind it fades in then out
  over the same window, and the two pupils blink once (`scaleY` 1 → 0.12 → 1) timed to
  land as the bounce settles. Background is `--cream` (the locked token, matching the
  native splash exactly, so there is no color jump). Under `prefers-reduced-motion` the
  motion, glow and blink are all skipped; the static mark simply holds for the same
  window, then fades out the same way. Not exercised on a device (`state.md`).
- **Launcher icon** (`android/app/src/main/res/mipmap-*/ic_launcher*.png`,
  `mipmap-anydpi-v26/ic_launcher.xml`/`ic_launcher_round.xml`): a second, separately
  supplied owl illustration (graduation cap, its own colors baked into the raster,
  not the splash mark above), generated at every density with Pillow, checked into
  the repo as the finished PNGs, not a source file. Adaptive icon (API 26+): the
  foreground layer is scaled so the owl's longer side is 62% of the 108dp canvas,
  centered, transparent around it, so no OEM mask (circle, squircle, rounded
  square) clips the ears or tassel; the background layer is a solid color resource
  (`values/ic_launcher_background.xml`, `#FFF7EA`, the same cream as the splash,
  duplicated there for the same reason `colors.xml` duplicates it — native
  resources can't read CSS custom properties). Legacy icon (pre-Android-8
  launchers, same PNG used for both `ic_launcher` and `ic_launcher_round`): the
  owl at 86% fill on a cream background baked directly into the bitmap (flattened,
  no alpha), so it never depends on the adaptive background layer. Replaces the
  Capacitor scaffold's default robot icon; the two now-unreferenced scaffold
  drawables (`drawable/ic_launcher_background.xml`, `drawable-v24/ic_launcher_foreground.xml`)
  were left in place, unused. Not exercised on a device: how it actually renders
  under a real OEM launcher's mask is unverified (`state.md`).

**Push notifications (2026-09-29, migration 031).** Manual Android push,
sent by an admin, via FCM. Native only (`Capacitor.isNativePlatform()`); on
the web `registerPushNotifications`/`listenForNotificationTaps`
(`lib/pushNotifications.ts`) return immediately — no permission prompt, no
plugin call, no console error.
- **Registration**, once per app session, called from `KidLayout`'s mount
  effect (covers both "just logged in" and "app started with an existing
  session," since that layout mounts fresh either way): request the
  Android 13+ runtime notification permission (`requestPermissions()`; 12
  and below report `granted` without a prompt, per the plugin's own docs),
  `register()` and wait for the FCM token, upsert it into
  `device_push_tokens` directly (`ON CONFLICT (token)` — a device already
  registered under a different account is simply reassigned), then call the
  `register-push-token` Edge Function to subscribe that token to the
  `"all-students"` FCM topic. Every step is best-effort (caught, logged,
  never surfaced to the student, never blocks anything else).
- **Why a server call subscribes the topic, not the client:**
  `@capacitor/push-notifications` 8.1.2 has no client-side
  `subscribeToTopic`/`unsubscribeFromTopic` (checked against its shipped
  types), and topic subscription is only possible through FCM's server-side
  Instance ID API, which needs the service account's OAuth token — so it has
  to happen in `register-push-token` (`schema.md` "Edge Functions"), not in
  the app.
- **Send strategy** (`send-push-notification`): "Everyone" sends once to the
  topic (cheap, but `recipient_count` comes back `null` — FCM does not
  report topic subscriber counts); "a course" or "a student" looks up
  `device_push_tokens` directly and sends to each token individually
  (bounded concurrency), because a topic cannot be scoped to one course or
  student without provisioning a second Google topic per course, which is
  out of scope here.
- **Status-bar icon (2026-09-29, revised same day).** Every send sets
  `android.notification.icon` (`ic_stat_notify`) and `android.notification.color`
  (the locked `--gold` token, `#F2B233`, hardcoded in `_shared/fcm.ts` — native
  resources and a Deno Edge Function can't read a CSS custom property, same
  reason the splash and launcher icon hardcode it) explicitly on the FCM
  payload, not just the `AndroidManifest.xml` `default_notification_icon`
  meta-data (also added, as a fallback for the rare message that omits the
  field). `ic_stat_notify.png` (`android/app/src/main/res/drawable-{m,h,xh,xxh,xxx}hdpi/`)
  is a **derived** monochrome silhouette, not the full-color brand mark reused
  directly: Android requires the small notification icon to be a
  white-on-transparent shape (API 21+ ignores color and fine detail in the
  status bar itself, which is why the default Android white dot was showing
  before this).
  - **Two independent mechanisms, easy to conflate when testing:** the
    **color** is per-message and entirely server-controlled — it takes effect
    on the very next send with no app update needed. The **icon graphic**
    is a bitmap bundled inside the installed app package — it only changes
    once a rebuilt APK is actually installed on the device. A test where the
    color is right but the glyph isn't almost always means the color came
    from this send while the glyph is still whatever shipped in whatever APK
    is currently installed.
  - **First version (same day) failed on-device**: reported as a plain gold
    ring with no visible owl features. Diagnosis: that silhouette put most of
    its visual weight off-center (a tall pointed beak/topper accent above a
    slightly-oval body, in a tightly-cropped bounding box) — if the OS applies
    its own circular safe-zone crop on top of the bitmap for this UI surface
    (as it does for adaptive launcher icons), a centered circular crop over an
    off-center shape plausibly keeps little more than a thin edge of it,
    which reads as a hollow ring. Not confirmed against Android/OEM source,
    since this session has no device to inspect directly — a reasoned
    diagnosis from the symptom, not a certainty.
  - **Redesigned same day** to be robust against exactly that: a single bold,
    genuinely circular head filling almost the whole canvas and centered
    exactly on it (same spirit as the launcher adaptive-icon safe zone,
    `ui.md` "Splash and entrance owl"), two large eye holes, and the beak as a
    small notch fully inside the circle's footprint rather than protruding
    above it. Checked by simulating an aggressive circular crop plus the gold
    tint locally: still reads clearly as an owl face. This is still a
    first-pass derivation, not commissioned artwork, but a considerably
    bolder and more failure-tolerant one than the first attempt.
  - **Not yet confirmed on-device**: the redesigned icon needs the rebuilt
    APK reinstalled on the test device before it can show up at all —
    unlike the color, this doesn't take effect on its own.
- **Logout** (`KidProfilePage` `logOut`): best-effort removal of this
  device's token from `device_push_tokens` before `signOut` (after, the
  session needed for the RLS-scoped delete is gone) — never blocks leaving.
- **A tapped notification** (`pushNotificationActionPerformed`) is a no-op
  beyond logging: the OS already brings the app to whatever screen it was on.
  No deep-linking to a specific lesson in this pass.
- **Admin screen** (`/admin/notifications`, `routes-permissions.md`): a
  compose form (title, body, target: Everyone / a specific course / a
  specific student, reusing `UserPicker`, now shared out of
  `orders/AddOrderDialog.tsx` into `components/admin/UserPicker.tsx`) and a
  read-only history table (`notifications_sent`, most recent first — the
  same "read-only report, no row-selection kit" shape as the Dashboard's
  recent-activity feed, `rules.md`/this file's Component conventions). No
  editing or resending. **`send-push-notification` is deployed and working**
  (`env-deploy.md` "Push notifications"): two real sends from this screen to
  the primary admin's own registered device (2026-09-29, the second after
  adding the status-bar icon above) both returned `recipientCount: 1` with no
  error, and the toast read "Notification sent to 1 device." Confirmed the
  API accepted and FCM returned success for that token both times; not
  confirmed by eye on the phone screen, which needs the device's owner to
  check (`state.md`).
- **Deliberately deferred, no scaffolding built for either:** automated or
  triggered notifications (a streak about to lapse, a new course published —
  these would need a scheduler or a DB trigger calling
  `send-push-notification`, neither exists) and web push (this whole feature
  is Android only; `registerPushNotifications` is a no-op on web and there is
  no service-worker/VAPID path). Also not built: iOS, per-notification
  deep-linking, resending or editing a past send, and per-device
  notification preferences (topic-level only, `"all-students"`).

**Unavailable screens (2026-09-28, migration 029).** A course a student can't open
(still a draft, archived, or gone) and a lesson they can't open (a draft or
unpublished lesson) end on the same compass `Screen`, with copy at two levels and
no query to tell them apart. Course page (`UnavailableScreen`, `StateScreens.tsx`):
"This course hasn't launched yet" / "Something fun is on its way. Check back
soon!" plus Go back. Lesson player (`LessonUnavailableScreen`,
`playerCopy.edge.unavailableInitial`): "This lesson hasn't launched yet" /
"Something fun is on its way. Your path is waiting for you!" plus Back to path.
The mid-session variant ("This lesson is being updated") is unchanged. No em
dashes in the copy. Checked in Chromium at 360, 390 and 430px (no horizontal
overflow, Baloo 2, existing tokens); the other "isn't ready" screens (video, game,
quiz content problems) are a different case and keep their wording.

### Typography scale

| Role | Size / line-height | Weight | CSS var pair | Use |
|---|---|---|---|---|
| display | 32 / 36 | 800 | `--kid-text-display` / `--kid-leading-display` | celebration headline only |
| title | 24 / 30 | 700 | `--kid-text-title` / `--kid-leading-title` | screen and question titles |
| heading | 20 / 26 | 700 | `--kid-text-heading` / `--kid-leading-heading` | section heads, sheet titles |
| body | 18 / 28 | 400 | `--kid-text-body` / `--kid-leading-body` | reading text, quiz options |
| label | 16 / 20 | 600 | `--kid-text-label` / `--kid-leading-label` | buttons, chips |
| caption | 14 / 18 | 500 | `--kid-text-caption` / `--kid-leading-caption` | hints, meta (never smaller) |

Reusable classes `.kid-text-display` … `.kid-text-caption` set size, line-height
and weight together (`kid.css`); `.kid-num` sets `font-variant-numeric:
tabular-nums` for a timer, score or XP figure that changes in place, so digits
don't jitter. Nothing in the player goes below 14 px; reading text never below
18 px. Tokens live in `kid.css`'s `:root`, not duplicated per component.

### Motion tokens

`--motion-fast` (120ms), `--motion-base` (200ms), `--motion-slow` (320ms; one
place, `kid.css`'s `:root`), `--ease-standard`
(`cubic-bezier(0.2, 0.8, 0.2, 1)`, ordinary state changes) and `--ease-playful`
(`cubic-bezier(0.34, 1.56, 0.64, 1)`, rewards and correct answers only: the
ring's time-met pop, the completion medallion). Every new animation here
transitions only `transform`/`opacity`. `prefers-reduced-motion` turns off the
ring pop, the medallion pop, the confetti (dropped entirely) and the wrong-answer
shake; the final state (the number, the icon) still shows, just without motion.

### Colour roles and the contrast numbers behind them

Roles: `--gold` primary action/progress/XP, `--teal` success/completed,
`--coral` wrong answer/error (always a tint, never alarming), `--plum` quiz
identity only (step dots, the selected-option border), `--ink` all text,
`--cream` page background, `--surface` cards/sheets/option rows. This matches
what the roadmap already established (`ui.md` above); nothing here reassigns a
role.

**Measured against `--cream`** (`d3` formula, sRGB): `--ink` 12.94, `--plum-d`
8.01, `--teal-d` 6.20, `--plum` 4.90, `--coral-d` 4.57, `--gold-d` 2.77,
`--teal` 2.88, `--coral` 2.75, `--gold` 1.76. Only `--ink`, the `-d` tones and
`--plum` clear the 3:1 a meaningful icon or UI boundary needs; `--gold`,
`--gold-d`, `--teal` and `--coral` on their own do not. This is why:
- **The active-time ring's fill stays `--teal-d` the whole time**, not the
  spec's literal gold-while-counting/teal-when-done: both gold tones fail 3:1
  outright. The time-met moment is carried by the icon (clock → check) and one
  overshoot pop instead, which is arguably a clearer, colour-blind-safe
  signal anyway.
- **Quiz option borders use `--plum` as specified (4.90, passes) for "selected",
  but `--teal-d`/`--coral-d` in place of the base tones for "correct"/"wrong"**
  (`--teal` 2.88 and `--coral` 2.75 both fail 3:1 against the option's cream/surface
  background). The tinted fill behind each state is still the base tone at 15%
  into cream/surface; every one of those tints measures 10.6 to 12.5:1 with ink
  text, comfortably over 4.5:1 (`ink on 15% gold/teal/coral/plum`, checked for
  all four).
- **A solid `--plum` fill (the selected option's letter badge) needs cream
  text, not ink**: ink-on-plum measures 2.64 (fails even the 3:1 icon floor),
  cream-on-plum measures 4.90 (passes), the same rule the roadmap's `.mod-3`
  module colour already follows.
- Ink on solid `--gold`/`--teal`/`--coral` (the primary button, the medallion,
  a badge) measures 7.33/4.50/4.70, all pass, so those keep ink text/icons.

### Button states (`PrimaryButton`/`PrimaryLink`, `.lp-primary`)

One fixed-size (56 px tall, full width up to 26rem) element in the bottom bar;
only its label and `data-variant` change, so nothing shifts when the label
changes or a spinner appears.

| Situation | Label | Variant |
|---|---|---|
| time not met, not a quiz | "Keep learning, 0:42 left" | muted |
| time met, not a quiz | "Finish lesson" | candy |
| quiz: question unanswered | "Next" / "Check" (last question) | muted |
| quiz: question answered | "Next" / "Check" (last question) | candy |
| quiz: reviewing a graded question | "Continue" | candy |
| quiz passed, time not met | "Keep learning, 0:42 left" | muted |
| finishing (server call) | spinner, label hidden | candy, disabled |
| replay | "Back to roadmap" | candy (secondary link alongside, where relevant) |

**Deviation from the spec's literal table**: mid-quiz advancing (not the last
question) reads "Next", not "Check": there is no per-question grading (below),
so a "Check" that does not check would be misleading. "Check" is reserved for
the one action that actually calls `fn_submit_quiz`.

### Quiz: one question at a time, feedback on the button (2026-09-26)

Replaces the earlier "answer everything, get one grade, then review each question" flow. The page
(`QuizLesson`, shell variant `quiz`) has no hero and no module list; the top bar keeps Back and the quiz
title. One question is on screen at a time, forward only (no Back between questions), under a slim
progress bar (`QuizProgress`, the same `.lp-timebar-*` track and fill as the video and doc lessons)
that advances as each answer is locked in, with "Question 2 of 3" and the prompt above the options.

- **Answer buttons** (`.lp-choice`): full width, 4rem tall, in the candy 3D treatment (a 5px bottom lip
  that presses away on tap, like `.candy-btn`), card surface with an ink outline when idle.
- **Tapping locks the answer** and asks the server (`fn_check_quiz_answer`, `schema.md`). While it
  answers the chosen button shows pressed and every option is inert. Then: the chosen option turns
  `--teal` (lip `--teal-d`) with a check if right, or `--coral` (lip `--coral-d`) with an X and one short
  shake if wrong; after a wrong answer the right option also turns teal with a check. Every other option
  keeps its idle look. Text and icons stay ink on the solid fills (4.50:1 on teal, 4.70:1 on coral);
  colour is never alone (check and X icons, and spoken "Correct" / "Not quite" / "The right answer"
  plus a polite live status). No new colours; there is no green or red token. A failed check (network)
  unlocks the answer and shows a note so the child can tap again.
- **Continue** (`.lp-continue-slot`, the sticky candy bar): held in the layout but hidden until an answer
  is locked in, so nothing shifts when it appears. A per-question confirmation, not the removed page-level
  Next bar. A wrong answer never stops the child going on; nothing is scored mid-quiz.
- **After the last Continue** all the answers go once to `fn_submit_quiz`, which grades against the
  lesson's own pass mark (`lessons.pass_percentage`), records the attempt and, on the first pass, completes
  the lesson and awards its XP once (a passed retake awards none). **Results** (`QuizResultView`): "X of Y",
  never a percentage. Passed: "You did it!" and "+N XP earned", and the shared gold completion sheet opens
  ("Continue to next lesson"), the same component the video and doc lessons use. Failed: "So close!", the pass
  mark in words, a candy **Try again** that restarts the same questions from the first (no pooling or
  shuffling exists) and a Back to roadmap link; the lesson stays incomplete. Passed before the minimum
  time is met: the earlier Finish lesson / keep learning bar. A completed lesson revisited is a
  practice round: the same flow, "Practice round" and the score, no pass or fail, no XP.
- **The answer key** reaches the browser only in the reply to a tap, for that question
  (`rules.md`). Verified in the network log: the question fetch (`quiz_questions_public`) carries no
  `correct` field, and the first reply that names a correct option is the one to the first tap.
- Removed with this: the step dots, the plum "selected" state, the letter badges, the post-grading
  review phase and its feedback panel (`QuizFeedbackPanel`, `QuizStepDots`).

### Other lesson types

**Video**: a poster with a tap-to-play overlay (so nothing plays, and no audio
starts, before the child taps Play), then a normalized YouTube/Vimeo embed in a
16:9 frame (`sandbox="allow-scripts allow-same-origin allow-presentation"`, a
different origin so this does not touch ours) or a native `<video>` with
`controlsList="nodownload noremoteplayback"` and `disablePictureInPicture`. A
load failure shows the shared error pattern inside the frame. Watching is not
tracked; the minimum time is the heartbeat's. **Reading**: `content_html` in a
`srcdoc` iframe, `sandbox="allow-same-origin"`, a CSP meta, body text bumped to
18px/28, capped at a 560px reading column (`.lp-col`) so it doesn't stretch on
a tablet. **Game**: a "Play" start card is shown first, so the iframe is not
even created (and cannot grab audio or focus) until tapped; still treated as
time-based (no protocol exists for a game to report anything) and
`sandbox="allow-scripts"` only; a 10s load timeout shows the error pattern; the
rotate hint still never locks the orientation. **Superseded on 2026-09-26** by the
game lesson host below (no start card, completion by message, native orientation lock).

### The error/empty pattern (`PlayerError`, spec Part A7)

One shared component for every "something didn't load" and "nothing here yet"
case: an icon, a headline, one sentence, and either a Try again button (retry)
or a Back to roadmap link (nothing to retry). It paints its own light
`--surface` background and `--ink` text regardless of where it sits. A real
bug caught in this task: inside the video frame's dark `--ink` letterbox, the
error text inherited dark-on-dark and was invisible; `PlayerError` (and the
`.lp-frame .lp-error` override) now fills the frame with a light surface
instead of relying on the parent's colour. A loading skeleton (`PlayerSkeleton`,
reused for the quiz too) only appears after 200ms (`useDelayedFlag`), so a fast
load never flashes it. Offline and reconnecting get a slim strip under the top
chips (`PausedNotice`); a hidden tab and the resume quiet period are silent,
since the dimmed ring alone carries that state, with no banner and no modal.

### Completion sheet (`LessonCompleteSheet`)

A drawer below `md`, a dialog from `md`. A teal check medallion (not gold:
gold is the XP/primary colour, teal is success), a deterministic confetti burst
(24 CSS pieces on a golden-angle spread, not `Math.random()`, so component
render stays pure; an eslint `react-hooks/purity` rule enforces this
project-wide), an eased XP count-up (`useCountUp`, skipped under reduced
motion), and the XP line only when THIS call awarded some. A repeat or racing
completion (`already_completed` from the server) shows neither XP nor confetti,
just "You already finished this one". "Next lesson" appears only once the
refreshed states show it open; the sheet waits for that refresh.

### Edge screens (spec Part B10)

Not enrolled: the roadmap's existing screen. **Enrollment expired**: a new
screen ("Your course time is over") shown only when an own-row read of
`enrollments` (`enrollments_select_self`) finds `status = 'expired'` for this
course. It is a copy choice on top of the engine's existing `not_enrolled` refusal,
not a new access rule; an admin preview or a genuinely-never-enrolled user still
sees the plain not-enrolled screen. **Lesson unavailable** now has two copies:
`initial` (never available this visit) and `mid-session` (a live call was
refused `lesson_unavailable` after the lesson was already on screen, most
likely because it was just unpublished).

### Dev-only state gallery

`/dev/lesson-player-gallery` (`pages/dev/LessonPlayerGallery.tsx`), registered
in `router.tsx` only under `import.meta.env.DEV`; every state from spec Parts
B3, B7, B8, B9, B10 and A7 with fixture data. Verified absent from the
production bundle: grepped `dist/assets/*.js` after a real build for the
page's own text, zero matches.

### Accessibility

Every interactive element has a visible focus ring; radio focus is drawn on
the label. Targets are at least 48 px for new player elements (the shared top
bar's 44px back button is unchanged, an existing, reused value, per the
"reuse before building" rule); the active-time ring's drawn graphic is 40px
(the spec's size) inside a 48px tap button, padding making up the difference.
Live regions (`role="status"`) cover the offline/reconnecting strip and the
quiz result; "Time is up" is announced once, not every second. SVG is
`aria-hidden`; state is never colour alone. Hover styles apply only inside
`(hover: hover)`.

### Verified (2026-09-23, Chromium headless, real JWTs, the live project, fixtures removed afterwards)

The dev gallery at 360/390/430px (no horizontal overflow at any width),
reduced motion (medallion, confetti and the wrong-answer shake all
`animation-name: none`, confetti removed from the DOM), 200% zoom (no
overflow). Against a live course: a full quiz answer → review → results
cycle (wrong pass: coral tint/border/shake, "Almost", "So close!", "You need N
of N to pass"; then a passed retry: teal tint/border, "Nice one!", "You did
it!", the completion sheet opening only after the review, not mid-review); a
game's start card (zero iframes before tapping Play, one after); a replay's
full teal ring and its exact-numbers popover; the completion sheet's XP,
no-XP-on-repeat and Next-lesson variants; the video/game/doc empty and
error states, including the dark-letterbox contrast bug above being caught
and fixed. **Not tested**: a real device, the Capacitor webview, iOS Safari,
a screen reader, keyboard-only quiz use, 320px, the 768px+ dialog variant of
the sheet, a landscape game's rotate hint, real video playback, an
explanation actually showing (needs migration 020), and the
enrollment-expired and mid-session-unpublish screens against a live refusal
(built and exercised only in the dev gallery with fixture props).

## Admin visual language (`/admin/*`)

Neutral shadcn default: Geist font (from shadcn's Nova preset), neutral
greys. Rationale: dense data reads better utilitarian, and admins are a
different audience than the kids using the product.

**Baloo 2 must not leak in.** It's scoped to the `.auth-page`, `.kid-app` and
`.kid-font` classes, none of which appear on admin routes, and `AdminLayout`'s
root sets `font-sans` explicitly to make that intent obvious rather than merely
inherited. Verified against the computed font of every element on three admin
pages.

**Color is functional, not decorative.** The panel stays visually quiet —
sidebar, cards and borders are neutral — and color appears only where it
carries meaning: status pills, KPI accents, the attention list.

| Token | Means |
|---|---|
| `teal` | healthy / published / active / paid |
| `gold` | draft / paused / needs review |
| `coral` | unresolved / failed / error |
| `plum` | gamification and XP surfaces |
| `ink` on near-white | body text and chrome |

Use the `-d` variants for text (`text-coral-d`, `text-gold-d`) — the base
tones are tuned for fills and fail contrast as small text on white.

**Tokens are Tailwind utilities.** `src/index.css`'s `@theme inline` block
maps each brand token to a `--color-*` entry, so `bg-gold`, `text-teal-d`,
`border-coral` all work. `inline` keeps the utility pointing at the `var()`
rather than copying the value, so `styles.css` stays the single definition
point. **Never hardcode a hex** in a component — if a utility is missing,
add the mapping instead.

### Admin CRUD conventions

Established by Courses; follow these for the next admin domain.

**Enrollment row actions** (`UserDetailPage`, Enrollments section). Each row
carries its status pill plus, contextually: **Revoke** (active rows only),
**Restore access** (revoked rows only, AND only when no active enrollment
exists for that course — a second active row is refused by the partial index,
so the button never offers something the database would reject), and **Reset
progress** (every row, whatever its status: progress outlives an enrollment, so
a revoked or expired one can still have something worth clearing). Restore and
Reset are independent — restoring never touches progress, resetting never
touches the enrollment.

- **Restore access** is a `Dialog` with two `<input type="date">` fields
  (enrollment date, defaulting to today; expiry, defaulting to the same
  *duration* the revoked row granted). Editing the start date moves the expiry
  with it until the admin edits the expiry by hand, after which their value
  stands. An empty expiry means lifetime, and the helper text says which case
  the row is in. No calendar dependency was added; a native date input is the
  right control for a desktop admin form.
- **Reset progress** is a destructive `AlertDialog` that states the real
  numbers before confirming — completed lessons (and total progress records,
  when they differ), quiz attempts, and XP to be clawed back — read from
  `fn_admin_course_progress_summary`, the same SQL the reset acts on. The
  confirm button stays disabled while those counts load, and reads "Nothing to
  reset" (still disabled) when all three are zero, so an admin never confirms a
  blank or pointless action. Both dialogs disable their submit while the
  mutation is in flight, the same double-submit guard `AwardXpForm` uses.

- **Dedicated routes for create and edit**, not modals —
  `/admin/<thing>/new` and `/admin/<thing>/$id/edit`. Both return to the list
  on success with a toast. Forms are long enough that a dialog would fight
  them.
- **One form component shared by both**, taking `mode: 'create' | 'edit'`
  plus optional `initialValues`, rather than two near-identical forms
  (`CourseForm.tsx`).
- **Row actions live in a kebab menu and are contextual to status** — the
  menu only offers transitions that are legal from the current state.
  Clicking the row itself does nothing, since several actions compete.
- **"View course" opens the student-facing page in a new tab, for every
  course whatever its status** (draft, published, archived — never hidden or
  disabled by status). It is the **first item** of each row's kebab menu (with a
  `lucide` `ExternalLink` icon) and a secondary (outline) button in the course
  editor's page header, right-aligned beside the title. Both are TanStack
  `Link`s to the typed route `/courses/$courseId` with `target="_blank"` and
  `rel="noopener noreferrer"` — a relative path, never a hardcoded host, so it
  works on localhost, over the LAN IP and in production — with
  `aria-label="View course: <title> (opens in a new tab)"`. It is a per-course
  action only: the bulk action bar has no version of it. An admin who is not
  enrolled in the course lands on the student page's "not enrolled" screen
  (`routes-permissions.md`) — accepted for now. The editor button sits in the
  page header rather than the row of lifecycle buttons because that row is
  already full at narrow admin widths: beside it, an archived course wrapped at
  720 px and pushed the tabs down (measured). In the header it adds no height at
  1400, 900 or 720 px; a very long title (132 characters tested) wraps one line
  earlier at 900 and 720 px, which moves the tabs down by that line.
- **Archive and Move to trash are both reversible; neither deletes.** A course's
  row menu offers its legal status transitions (archive is a status, undone by
  Restore) and Move to trash (see the trash-first bullet below). Neither needs a
  confirmation dialog because both can be undone; only `/admin/trash` deletes.
- **Lifecycle actions are explicit buttons, separate from "Save changes"** —
  not a status dropdown inside the form. They apply immediately; the form
  save is its own action.
- **Server-side constraint violations resolve to the field that caused
  them** (a slug uniqueness clash renders under the slug input), not a toast
  the user has to map back to an input.
- **Trigger-maintained counters are shown read-only** (`total_students`,
  `total_lessons`) and visually separated from editable fields.
- **Conditional fields are removed, not disabled** — price/currency vanish
  when a course is free; duration appears only for fixed access. A disabled
  field still reads as "something I might need to fill in".

### Course Builder (tabbed editor)

- **Tabs, with the dependent tab locked until the parent row exists.**
  `/admin/courses/new` shows Curriculum greyed out with a "Save the course
  first" tooltip — topics and lessons need a `course_id` to attach to. The
  create submit reads **"Save & continue"** and lands on
  `?tab=curriculum`, since building the curriculum is the actual next step.
- **Tab state lives in the URL** (`?tab=basics|curriculum`), so it survives a
  refresh and can be linked to. See `routes-permissions.md`.
- **Reordering is real drag-and-drop, via `@dnd-kit/core` + `@dnd-kit/sortable`
  + `@dnd-kit/utilities`.** (An earlier pass shipped up/down buttons instead
  and deferred the dependency — since corrected; buttons are gone entirely,
  not offered alongside drag.) A `GripVertical` handle at the left edge of
  each row is the *only* draggable surface — listeners live solely on the
  handle (`DragHandle` in `CurriculumTab.tsx`), never the row, so dragging
  can't conflict with clicking to rename/expand/edit/delete. Both
  `PointerSensor` (small activation distance so a click doesn't register as
  a drag start) and `KeyboardSensor` are wired — reordering must stay
  keyboard-accessible, not just mouse-draggable.
  **Topics and lessons share one `DndContext`, with one `SortableContext`
  per lesson container.** This isn't a style choice: lesson rows render
  inside topic cards, so any context spanning every topic's lessons is
  unavoidably the nearest context for the topic cards too, and dnd-kit
  resolves `useSortable` through plain React context (nearest provider
  wins). Nesting two contexts cannot separate them. What separates them
  instead is `data.type` (`'module'` / `'lesson'` / `'container'`), which a
  custom `collisionDetection` filters on so a topic drag never targets a
  lesson list. A container's own drop zone id is namespaced
  (`dropzone:<id>`) because a topic card is already registered as a
  droppable under its bare id, and one context means one id space.
  A lesson can be dragged **between** topics, and into and out of
  Ungrouped, which is a normal container rather than a special case.
  Three things this needs that a single-container list doesn't:
  - Each container registers via `useDroppable` on the container element,
    not just on its rows, or a topic with no lessons could never be dropped
    into. Ungrouped stays mounted for the duration of any lesson drag even
    when empty, since an unmounted section can't be a drop target — that's
    the only way a lesson gets out of every topic.
  - `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`.
    Moving a lesson between topics resizes both mid-drag, and dnd-kit
    otherwise measures droppables once at drag start, so every rect past the
    first resize is stale.
  - Collision detection prefers `pointerWithin` and, when the pointer is in
    a container but inside no row (the gap between rows, or the padding),
    snaps to the *nearest row in that container* rather than answering with
    the container. Answering with the container means "append to the end",
    which made the dragged row flick to the bottom of the list every time
    the pointer crossed a gap between two rows.
  The live preview during a lesson drag is a local draft array, and it is
  **pointer-only**. Keyboard drags take their coordinates from the layout,
  so reordering the list under them feeds back into the sensor and one
  ArrowDown travels two slots; keyboard drags therefore keep dnd-kit's own
  transform preview and resolve placement once, on drop. Both paths run the
  same placement function, so preview and drop can't disagree.
  On drop, every sibling whose position actually changed (not just the two
  endpoints of the drag) is recomputed and written in one `upsert` call
  seeded with full row objects — a partial `{id, position}` payload fails
  Postgres's `NOT NULL` check on the row `ON CONFLICT DO UPDATE` has to
  build, even though only the provided columns end up written.
  Two more pieces the first pass shipped without, both required for the
  drag to feel correct rather than merely functional — copy this shape for
  the next sortable list:
  - **`<DragOverlay>` renders the floating, pointer-following copy** (a
    portal, unconstrained by the list's own layout). The item actually being
    dragged (`useSortable`'s `isDragging`) skips applying its own `transform`
    and instead sits in its slot as a static, dimmed placeholder — applying
    a positional transform to it *as well as* rendering it via the overlay
    is what let it drift outside the list and overlap unrelated content
    above it. Non-dragged siblings still need their transform to animate out
    of the way.
  - **The reorder mutation carries an optimistic `onMutate`** that writes the
    new order into the query cache synchronously, before the network request
    resolves (`useModuleMutations`/`useLessonMutations` in
    `useCurriculum.ts`). Without it, `onDragEnd` firing the mutation still
    leaves the cache holding the pre-drag order for the whole round-trip —
    dnd-kit resets its drag transforms the instant the pointer is released,
    based on whatever the `items` array currently is, so the list visibly
    snaps back to the old order and then jumps again once the real data
    arrives. See `rules.md` for the "mutate on drop, not before" half of
    this — the two only work together.
- **Nested editing goes one level deep in a Dialog, not a new route.** A
  lesson opens in a centered `Dialog` (`LessonDialog.tsx`, `sm:max-w-lg` plus
  explicit `max-h-[85vh] overflow-y-auto` since base `DialogContent` has no
  built-in height cap); a quiz lesson's questions are edited *inside that
  same dialog* rather than in a third route or a dialog-over-dialog. Questions
  only appear once the lesson row exists, since they need a `lesson_id`. This
  replaced an earlier Sheet (slide-over) — swapped for consistency with the
  Dialog convention already used elsewhere (e.g. Admin Users' create/edit);
  only the container primitive changed, not the field set or submit logic.
- **Lesson timing and pass-mark settings (migration 015, enforced server-side since 017).** The
  field copy describes the intended kid-side behaviour ("Kids can tap Mark
  complete after spending this long…", "Kids must score at least this to
  pass…") exactly as specified, and the lesson engine now enforces them
  (`schema.md`, `rules.md`); no kid-side screen shows them yet. The lesson dialog gains *Minimum time on lesson*
  (`MinTimeField.tsx`: quick-pick chips Off / 30s / 1 min / 90s / 2 min / 5 min
  plus a numeric input — a chip is only a shortcut for typing its number) and,
  for quiz lessons only, *Pass mark* (whole percent). A NEW lesson pre-fills 90
  seconds (video, game and text) or 0 (quiz); switching the type re-derives the
  pre-fill only while the admin hasn't touched the field, and an existing
  lesson's saved value is never re-derived. Validation mirrors the database
  checks (0–3600 s, 1–100 %) with readable messages (`lib/lessonSettings.ts`).
  The XP reward field's helper text shows the effective XP — the lesson's own
  value, else the *course* default (blank means the course default, not a
  per-type one), and none when the course has gamification off; it is computed
  in the browser for display only. Saving a lesson requests `.select('id')` and
  treats anything but one row as an error.
  - **Row chips** (`LessonSettingChips` in `ContentTypeBadge.tsx`): a clock and
    the time ("1:30") when above 0, and "Pass 60%" for quizzes. They are plain
    spans inside a group with the type and status badges that *wraps* rather
    than forcing one line, so at narrow widths the edit and trash buttons stay
    inside the row; the drag handle and checkbox are separate siblings and are
    untouched.
  - **Bulk "Set minimum time"** (`SetMinTimeDialog.tsx`) sits in the course
    editor's bulk bar beside Move to trash. It applies to the selected
    *lessons* only (disabled, with a reason, when only topics are selected),
    says when topics are selected too, and flags quizzes in its copy without
    excluding them. One update per lesson, each required to touch exactly one
    row; the toast reads "2 updated, 1 failed" with each reason, and failed
    lessons stay selected for a retry. The dialog cannot be dismissed while it
    runs.
  - **Games:** an *Orientation* select (Any / Portrait / Landscape) in
    `GameDialog` with the helper text "Landscape games will ask kids to rotate
    their phone." — still stored only (nothing reads it; there is no game player),
    and not a column on the games list.
- **Quiz questions and doc content blocks (2026-09-28): drag-reorder, delete
  confirmation, and a real doc-block editor where only direct SQL existed
  before.** Both are nested in the same `LessonDialog` a lesson's own edit
  already opens — no new route, matching the "one level deep in a Dialog, not
  a new route" rule above — and both only exist once the lesson row does
  (`lesson_id`), same as the quiz question editor always required.
  - **`SimpleSortableList.tsx`** generalises `CurriculumTab`'s drag machinery
    for the simple case it doesn't itself need: one flat, single-container
    list. Same sensors (`PointerSensor` with a small activation distance,
    `KeyboardSensor`), the same zero-animation convention (`transition: null`,
    `animateLayoutChanges: () => false` on `useSortable`; `dropAnimation={null}
    transition={() => undefined}` on `<DragOverlay>` — `rules.md`'s invariant,
    unchanged), and the same generalised `computeChangedPositions` (every row
    whose `position` actually changed, not just the drag's two endpoints) feeding
    a batched `upsert` plus an optimistic `onMutate` cache write, so the list
    doesn't snap back and re-jump while the round trip resolves. `QuizQuestionsEditor`
    and `DocBlocksEditor` each own their row's own layout (a truncated prompt vs.
    a type-specific preview) through a render prop; the component itself only
    owns the drag mechanics.
  - **Quiz questions**: the up/down chevron buttons are gone, replaced by the
    same drag handle as everywhere else in the builder. Delete now goes through
    a confirm `AlertDialog` (the same pattern `CurrenciesSection.tsx`'s currency
    delete already uses) instead of an immediate, unconfirmed delete. The
    add/edit form, its options list and its "exactly one correct answer that
    must match a current option" validation are unchanged — they already did
    everything this task asked for.
  - **Pass threshold, reused rather than duplicated.** The brief asked for a
    new nullable `lessons.quiz_pass_threshold` percentage column, "null for
    every non-quiz lesson" — which is exactly what `lessons.pass_percentage`
    (migration 015) already was in spirit, already read by real grading
    (`fn_submit_quiz`, 017) and already the "Pass mark" field in `LessonDialog`.
    Migration 028 reshapes that column instead of adding a second one that
    would mean the same thing: it is now nullable, `0–100` (was `1–100`), NULL
    for every non-quiz lesson and required for a quiz one (a bidirectional
    CHECK, not just convention). The 70% pre-fill for a new/never-set quiz
    lesson moved out of the column's own default and into the client
    (`DEFAULT_PASS_PERCENTAGE`, `lib/lessonSettings.ts`) — see `schema.md` for
    the full reasoning and the "why not just add the column" call.
  - **`DocBlocksEditor.tsx`** — the first UI for `lesson_content_blocks`
    (migration 023's 13 seeded rows existed only because that migration wrote
    them directly; there was no way to add a 14th). A labeled type picker
    (Paragraph / Callout / Image, not a `Select` — three options read better
    all at once, the same reasoning as the video-link mode switch) reveals
    only the fields valid for the chosen type; switching type clears the
    other type's fields rather than leaving something stale that a later save
    could turn into a constraint violation — the form is built to only ever
    produce one of `lesson_content_blocks_shape_check`'s three shapes, never to
    be caught by it. Callout colour is four labeled swatches (`bg-gold` /
    `bg-teal` / `bg-coral` / `bg-plum` — the brand tokens' Tailwind utilities,
    2026-09-09 — spelled out as static class names, since Tailwind's scanner
    can't see a template-literal `` `bg-${color}` ``); callout icon is five
    labeled buttons using the identical icon set the kid renderer
    (`DocBlocks.tsx`) already maps `CalloutIcon` to, kept as its own small
    lookup rather than an import across the admin/kid boundary. An image
    block's URL is checked against `^https?://` client-side before save, so a
    bad paste reads as a form error, never a raw Postgres constraint message.
    The row list shows a compact preview per block: truncated text for
    paragraph, the coloured icon badge plus truncated text for callout, a
    small thumbnail (or a placeholder icon before one loads) for image.
- **Destructive copy states the actual consequence.** Deleting a topic says
  its lessons move to Ungrouped (the FK is `SET NULL`, so they genuinely
  survive); deleting a lesson warns that its questions go with it and that
  student activity will block it outright. "Are you sure?" would be wrong in
  both directions.
- **Orphaned rows stay visible.** Lessons whose topic was deleted render in an
  explicit "Ungrouped" section rather than disappearing from the builder.
- **`content_type` badges are outlined; status badges are solid.** Both draw
  from the same four accents, so a quiz lesson in draft would otherwise put
  gold next to gold — the two badge families differ by more than hue.
  Mapping: video=teal, text=plum, quiz=gold, game=coral.

### Admin shell

`src/components/admin/AdminLayout.tsx` — persistent left sidebar + topbar
wrapping an `<Outlet />`. **Desktop-first; mobile responsiveness is explicitly
not implemented.**

- Sidebar nav is grouped (Content / Engagement / Commerce / Administration)
  and defined by the `NAV_GROUPS` array — the single place to add an item.
- Topbar shows the page title derived from the active route (exact match,
  falling back to the longest matching section prefix so deep routes still
  label correctly), the signed-in admin's `display_name`, and sign-out.
- `NavLink` still carries one `to as never` cast, but for a different reason
  than when it was added: every nav target is a real route now, yet
  `/admin/orders` and `/admin/settings` declare a required search param
  (`?view=`/`?tab=`, validated with a default), which a typed `Link` would
  force every nav entry to pass explicitly. Don't "clean up" the cast just
  because all the routes exist — it would break the typecheck.

## Component conventions

- shadcn components live in `src/components/ui/` (generated) — do not
  hand-edit generated files beyond the documented `eslint-disable` fix on
  `button.tsx`/`badge.tsx` (see `context.md` gotchas), the indeterminate-
  icon fix on `checkbox.tsx` (see the row-selection entry below), and
  correcting `import { cn } from "cn"` back to `@/lib/utils` on every file
  the Windows CLI bug generates (`popover.tsx`, `command.tsx`,
  `input-group.tsx` needed this when adding the currency combobox) — see
  `context.md`'s gotchas for the bug itself.
- Feature-specific UI is grouped by domain: `components/auth/`,
  `components/admin/` (shell only: `AdminGuard.tsx`, `AdminLayout.tsx`),
  `components/admin/users/`, `components/admin/courses/`,
  `components/admin/games/`, `components/admin/orders/`,
  `components/admin/settings/`, `components/admin/gamification/`,
  `components/admin/selection/` (the shared multi-select kit) and
  `components/admin/trash/` (the Trash page's table and dialogs).
- **Flat single-entity CRUD (no nested child content) uses a Dialog, not a
  dedicated route or wizard.** Games (`GameDialog.tsx`) follow Admin Users
  (`EditUserDialog.tsx`), not the Courses create/edit flow — a course has
  modules/lessons/quiz questions hanging off it and earns its own routed
  builder, a game is one row. Same list-table shape as `CourseTable.tsx`
  (TanStack Table v9 feature registration, client-side sort/filter/paginate,
  row actions via a `DropdownMenu`) for consistency across admin list pages,
  even though the create/edit container differs.
- **A row with real content density (multiple related sub-resources, not
  just its own fields) earns a routed detail page, not a dialog.**
  `/admin/users/$userId` (`UserDetailPage.tsx`) follows `/admin/courses/
  $courseId/edit`, not the Games/Users Dialog pattern — a user has account
  fields *plus* stats, enrollments, per-course progress, and badges, the
  same reasoning that gave Courses its own routed builder over a modal. The
  page is stacked bordered `<section>` cards (Account / Stats / Enrollments
  / Progress / Badges), not `Tabs` — unlike Course Builder's Basics/
  Curriculum split, none of these sections is large or exclusive enough to
  justify hiding the others behind a click, and an admin usually wants the
  whole picture at once. **Clicking a table row navigates to its detail
  page**; the actions cell stops click propagation
  (`onClick={(e) => e.stopPropagation()}`) so opening the row's own
  dropdown doesn't also fire the row-level navigation — see `UserTable.tsx`
  for the first instance of this pattern, worth copying rather than
  reinventing for the next list that gets a detail route.
- **The existing account-action dialogs (Edit/Change email/Reset password/
  Delete) are reused as-is from a second entry point, never re-implemented.**
  The detail page adapts its richer profile-plus-stats query down to the
  list page's `AdminUserRow` shape (`toAdminUserRow` in
  `UserDetailPage.tsx`) purely so the same dialogs can be passed the same
  prop type — none of them read `user_stats`, so this is a type-shape
  adapter, not a functional difference. This is what keeps the primary-admin
  delete guard (disabled button + tooltip) identical at both entry points
  without a second implementation to drift out of sync.
- **A permanent delete that can be blocked needs a readable reason, not a raw
  error.** A game still referenced by a lesson, a badge a student unlocked, a
  lesson with student progress, a course with enrollments — each reports what
  blocks it ("Used by 2 lessons (trashed lessons count too)"). Those checks live
  in `lib/permanentDelete.ts`, which only the Trash page imports; the count is
  looked up before the delete rather than parsed out of a constraint message.
- **A read-only record with a narrow, specific edit is still the Dialog
  convention, not a routed page.** `OrderDetailDialog.tsx` (payments) shows
  the full record read-only — including a pretty-printed `raw_payload` — and
  exposes exactly two editable fields (`reconciliation_status` and
  `reconciliation_note`; trash/restore is a separate row action, not part of
  this dialog — see `rules.md` for what an admin may change on a payment),
  mirroring Games' "flat record, one Dialog" shape. Creating a payment is its
  own dialog (`AddOrderDialog.tsx`, via `fn_create_manual_order`). The table
  row's actions are a `DropdownMenu` — View details / Move to Trash in the
  Active view, Restore / Delete Permanently in Trash. It started as a single
  `Eye` icon button, since a menu for exactly one possible action is one extra
  click for nothing; it became a `DropdownMenu` the moment a second action
  existed (the trash actions), which is the threshold to apply again.
- **A payment with no linked account (`user_id` null) is a normal state, not
  an error.** A payment can arrive before its buyer signs up (see
  `schema.md`), so `OrderTable.tsx` shows the raw `email` plus an outline
  "Unclaimed" badge, and `OrderDetailDialog.tsx` says "Unclaimed — no account
  yet" — no error styling in either.
- **Shared *logic* gets extracted into one hook; shared *presentation* with
  no logic of its own doesn't have to be.** The Dashboard's and Orders
  page's revenue KPI card call the exact same `useRevenue()` (moved to
  `usePayments.ts`) so the two pages can never independently drift on what
  "revenue" means. The small `KpiCard` box that renders it (label/value/
  pending/error) is deliberately *not* extracted into a shared component —
  it has no domain logic to drift, so a second ~15-line copy in
  `OrdersPage.tsx` is cheaper than coupling both pages' JSX to one shared
  component for a wrapper this thin. Duplication is the default; only
  extract when there's a rule (like "revenue means paid + INR-only") that
  two copies could quietly stop agreeing on.
- **All five admin list tables are TanStack Table v9** (`UserTable`,
  `CourseTable`, `GameTable`, `OrderTable`, `BadgeTable`) and
  search/filter/sort/paginate entirely client-side over one fetched list. (The
  Dashboard's "Recent activity" table also uses `useTable`, but with an empty
  feature set — it's a read-only display, so it isn't one of the list tables
  this convention describes.) `/admin/users` was the last
  plain `<table>` and was migrated; it previously filtered and paged
  server-side through PostgREST `.or()`/`.eq()`/`.range()`, which is gone. At
  account and catalog volumes bounded by real signups, a round-trip per
  keystroke buys nothing, and a client-side filter needs no debounce.
  `OrderTable` is the first with no search box at all — the task only ever
  called for status/reconciliation filters, so `globalFilteringFeature`
  wasn't wired in; add it the usual way if a search box is ever asked for.
- **A search box spanning more than one column is `globalFilteringFeature`,
  not a column filter.** `/admin/users` matches name *and* email from one
  input, which a per-column `filterFn` can't express. Two things this needs:
  `globalFilterFn: 'includesString'` on the table (the feature resolves its
  function from the `filterFns` registry and silently filters nothing when
  unset), and `enableGlobalFilter: false` on every column that shouldn't be
  scanned — otherwise typing "admin" matches all admins via the role column,
  and "2026" matches every row via the joined date. Display columns are
  excluded automatically, having no accessor.
- **Anything passed to `useTable`'s `state` must have a stable identity.**
  The filtered row model compares `columnFilters`/`globalFilter` by
  *reference*; a fresh array or object literal each render reads as "the
  filters changed" and fires the model's `autoResetPageIndex`, which snaps
  the table back to page 1. The symptom is Next appearing to do nothing
  while page-size changes still work — so a table with only one page of rows
  looks completely fine and the bug only surfaces once the data grows. Every
  admin list table memoises its filter array and `state` object; copy that,
  and don't pass an inline literal.
- **Multi-select is one shared kit, used by every admin table**
  (`components/admin/selection/`): `useTableSelection`, `SelectPageCheckbox` /
  `SelectRowCheckbox`, and `BulkActionBar` (with `TableSelectionBar`, the
  one-line table wiring). It sits on TanStack Table v9's `rowSelectionFeature`,
  which needs no row-model factory of its own — its getters read straight off
  whichever row model is registered. Every list table (Users, Courses, Games,
  Badges, Orders, and the six Trash tabs) registers the feature, and the course
  editor's topic/lesson lists use the same hook and bar without a table. No
  list of records ships without it; the read-only report tables (the
  Dashboard's recent-activity feed, the import dialog's preview and results)
  are the exception, since their rows are not records anyone can act on. What
  the kit guarantees:
  - **The page owns the state.** `useTableSelection(resetKeys)` returns a
    controlled `{ [rowId]: true }` map; the page passes it to the table as
    `selection` and reads `selection.selectedIds` for its bulk actions. The map
    persists across pagination by itself.
  - **Stable row ids.** Every table sets `getRowId` to the real id, never the
    index, so a selection survives a filter change or a refetch reordering rows
    instead of silently pointing at whatever now sits at that index.
  - **It clears when the scope changes.** `resetKeys` are the page's search and
    filter values (plus the Active/Trash view on Orders); changing any of them
    empties the selection, because a selection made under one filter says
    nothing about the rows shown under another. The reset is state adjusted
    during render, not an effect (`react-hooks/set-state-in-effect` rejects the
    effect version).
  - **The header checkbox is scoped to the current PAGE** (checked when the
    whole page is selected, indeterminate when only some of it is; clicking an
    indeterminate box selects the page, like a native indeterminate input).
    "Select all N matching" — the whole *filtered* set, across pages — is a
    button in the bar, shown when the filtered set is larger than the selection
    (`toggleAllRowsSelected(true)` reads the filtered row model).
  - **Selection state stays out of the other state slices' identity.** `state`
    composes `columnFilters`/`globalFilter` and `rowSelection` as separate
    memoised pieces, so ticking a checkbox can't regenerate the filter array and
    fire the page-reset bug above.
  - **Keyboard and screen readers.** Every checkbox has an `aria-label` ("Select
    ZZ Bulk 01", "Select all users on this page"); Space toggles. The row
    checkbox swallows click *and* key events so a table whose rows are links
    (`UserTable` navigates on row click and on Enter) doesn't navigate when a box
    is toggled — Enter must not bubble.
  - **A row can be selected even if its action would be refused** (the primary
    admin in a user selection): the bulk run reports it as a failure with the
    server's reason rather than the UI guessing ahead. Selection is dropped for
    the ids that were acted on (`removeIds`), never blanket-cleared, so a
    single-row action can't wipe an unrelated in-progress selection.
  - **Drag handles stay separate from checkboxes** in the course editor: dnd-kit's
    listeners live on the handle alone, the checkbox is its sibling, so ticking a
    box can't start a drag and a drag doesn't toggle one (selection also
    survives a drop). Reorder stays zero-animation (`rules.md`).
- **A view toggle over two disjoint row sets is a real search param
  (`?view=`), a `Tabs` control, and a cleared selection on switch** —
  `/admin/orders`'s Active/Trash toggle (migration 009) follows Course
  Builder's `?tab=` convention exactly (see `routes-permissions.md`), not a
  new pattern. Selection is cleared on every view switch because Active and
  Trash never share rows, so a selection made in one is meaningless in the
  other — done in the `Tabs`'s `onValueChange` handler directly (an
  ordinary event handler, not a `useEffect` reacting to the search param
  changing, which the `react-hooks/set-state-in-effect` rule would reject
  anyway).
  **Selection also needs manual cleanup after a row disappears from view for
  any reason** (trashed, restored, or actually deleted) — TanStack's own
  row-selection skill docs call this out explicitly: selection is
  independent state that does not clean itself up when the data it points
  at changes shape. `OrdersPage.tsx`'s `removeFromSelection(ids)` deletes
  exactly the acted-upon ids from the selection map rather than clearing it
  entirely, since the same handler backs both a bulk toolbar action (`ids`
  is the whole selection) and a single row's dropdown action (`ids` is just
  that one row, which may not even be selected) — a blanket clear would be
  wrong for the second case, wiping an unrelated in-progress selection.
  **Not every destructive-sounding action gets the same confirmation
  weight.** Move to Trash gets an ordinary confirm (reversible, but "trash"
  language still warrants a pause); Delete Permanently gets its own
  strongly-worded copy and a destructive-styled button, explicitly not
  reusing Move to Trash's copy; Restore gets no confirmation dialog at all
  — undoing a soft delete is the safe direction and the task that
  introduced this deliberately only asked for confirmation on the other two.
  A future action added to this toolbar should pick its confirmation weight
  the same way: by what a wrong click actually costs, not by copying
  whatever's nearest in the file.
- **Toolbar-owned filters, table-owned pagination.** The search input and
  role/status select live on the page and are passed down as controlled
  state; the page-size select and prev/next live in the table's own footer
  next to the row-range label. Page-size controls ship with the table from
  day one rather than being added once row counts grow.
- **Empty states distinguish "nothing here" from "nothing matched."** A list
  with zero rows and a list filtered down to zero are different problems for
  an admin, so they don't share copy — "No users yet" vs "No users match
  your search".
- Dialogs that need to reset form state on reopen: split the form into an
  inner component that mounts fresh per open (Radix unmounts dialog content
  on close), rather than a `useEffect` resetting state — the lint rule
  `react-hooks/set-state-in-effect` will reject the effect version. See
  `EditUserDialog.tsx` / `CreateUserDialog.tsx` for the pattern.
- **A handful of admin-config rows (add + toggle, no sort/filter/paginate
  need) is a plain `<ul>`, not a TanStack Table instance.**
  `ManualOrderProvidersSection.tsx` (`/admin/settings`) lists
  `manual_order_providers` as a bordered `<ul className="divide-y rounded-md
  border">` with a `<Switch>` per row toggling `is_active` — the moment this
  list needs sorting, filtering or pagination it graduates to the TanStack
  convention above, but standing up that machinery for a handful of rows
  today would be building for a scale problem that doesn't exist.
- **`/admin/settings` is `Tabs` over purpose-built sections, not a generic
  settings framework.** Three tabs — Commerce
  (`CommerceSettingsSection.tsx`: `ManualOrderProvidersSection.tsx` +
  `CurrenciesSection.tsx` + the default-currency picker), Gamification
  (`GamificationSettingsSection.tsx`), Site Identity
  (`SiteIdentitySettingsSection.tsx`) — each rendered inside its own
  `TabsContent`. This replaced an earlier, shorter-lived two-tab
  Providers | Platform split (see `changelog.md`) once Platform's seven
  fields had an actual category structure to be grouped by, rather than
  landing in one undifferentiated second tab. Adding a fourth tab later is
  one more `TabsTrigger`/`TabsContent` pair, not a registry to extend. Same
  `?tab=`-as-search-param convention as Course Builder (see
  `routes-permissions.md`).
- **Splitting one config row across multiple tabs means each tab saves its
  own slice independently, not one shared cross-tab form.**
  `useUpdateAppSettings`'s input type is a `Partial` (besides `id`)
  specifically so Gamification's form can submit just
  `quiz_pass_threshold_percent`, Site Identity's just its five fields, and
  the Commerce tab's currency picker just `default_currency` — none of them
  needs to know or carry the other tabs' current values, and `.update()`
  only ever touches the columns actually passed. This is a direct
  consequence of the earlier one-form-one-submit `PlatformSettingsSection`
  being split across tabs a user might not have both open — see
  `changelog.md`.
  **A discrete choice (the currency picker) auto-saves on selection, the
  same immediate-action feel as the `Switch` toggles in the list editors
  right above/below it in Commerce; typed fields (the quiz threshold,
  Site Identity's text inputs) keep an explicit Save button**, since typing
  a number or URL character-by-character has a meaningful "still typing"
  state that a Select's onSelect doesn't. Match this split when adding the
  next Settings field: pick the save behavior by whether partial input is
  ever a valid intermediate state, not by copying whichever field is
  nearest.
  **Initializing local form state from a query-loaded singleton row (not a
  dialog) still needs the "mount fresh" trick** — there's no open/close
  moment to reset on the way a dialog has, so the parent renders each form
  with `key={settings.id}` once the row has loaded. Since the singleton's
  `id` never changes across a refetch, this does NOT remount on every
  background refetch (which would blow away in-progress edits) — it only
  (re)mounts once, the first time real data replaces the loading state.
- **A searchable combobox (Popover + `Command`, shadcn's standard shape) is
  the pattern for any Select with too many options to scroll.** The default
  currency picker in `CommerceSettingsSection.tsx` is the first use of
  this — a plain `Select` was fine for the two-item course-currency
  dropdown, but ~180 seeded currencies need to be filterable by typing.
  `Command`'s built-in text-content filtering means `CommandItem`'s
  rendered children (code + name) double as the search index — no separate
  search-string prop needed unless the visible text and the intended match
  text diverge. Reach for this combination the next time a Select's option
  list is large enough that scrolling stops being a reasonable way to find
  an entry; a plain `Select` stays correct below that threshold (see the
  two-currency `Select` still used in `CourseForm.tsx`, deliberately not
  touched — wiring courses to this full list is a flagged follow-on, not
  done here, see `state.md`).
- **A true hard delete on a config-list row (Providers, Currencies) needs
  the live RLS policy checked, not assumed from a stale doc or a sibling
  table's shape.** Both list editors offer Delete alongside Deactivate,
  each behind its own confirm `AlertDialog` with copy specific to that
  entity (not a shared cross-entity dialog — the add-form shapes already
  differ enough, one field vs. two, that generalizing the confirm dialog
  too would be indirection for two call sites). Deleting the currency
  currently set as the platform default is expected to fail — the FK
  blocks it — and the dialog in that case deliberately stays open on that
  specific error (see `CurrenciesSection.tsx`) rather than closing, so the
  toast explaining why stays legible next to the row that caused it.
- **`/admin/gamification` stacks two sections instead of using tabs.**
  Badges (`BadgesSection.tsx`) and Level Thresholds
  (`LevelThresholdsSection.tsx`) are both real workspaces rather than small
  config forms, and an admin editing one usually wants the other in view — a
  badge's "Total XP" threshold only means something against the level curve
  below it. Settings uses `Tabs` because its sections are independent small
  forms; that's the distinguishing question for the next admin page with two
  sections, not "how many are there."
- **A condition field whose meaning depends on another field changes its
  label AND hint, not just its validation.** `BadgeDialog.tsx`'s
  `condition_value` reads "Total XP" / "Consecutive days" / "Lessons
  completed" / "Courses completed" with a matching one-line hint, driven off
  the selected `condition_type` (metadata lives beside the hook in
  `useBadges.ts`'s `CONDITION_TYPES`, so the table's "Unlocks at" column and
  the form can't drift). A bare "Condition value" over four different units
  would be a guessing game.
- **Badge icons have two modes — a closed colour+glyph picker, or an upload —
  never a bare pasted URL (`BadgeIconPicker.tsx`, `lib/badgeIcon.ts`).**
  **Picker** (2026-09-28): the six original badges (seeded directly by
  migration, no admin UI existed for them until now) are all the same visual
  formula — a filled circle, a darker stroke ring, one cream glyph.
  `buildBadgeIconSvg`/`buildBadgeIconDataUri` reproduce that formula from a
  fixed set: four colours (gold/teal/coral/plum, labeled swatches,
  `bg-{token}` spelled out as static Tailwind classes since the scanner can't
  see a template literal) and six glyphs (checkmark, flame, spark, trophy,
  star, dots — checkmark/flame/spark/dots reuse the *exact* path data the
  real seeded rows already draw; trophy and star are new, in the same
  style). A data URI has no access to CSS custom properties, so the four
  tokens' hex values are necessarily inlined in `badgeIcon.ts` — the one
  deliberate exception to "never hardcode hex," clearly commented as such.
  **Upload** (2026-09-28, added same day): a compact drop-zone (the same
  hidden-input-plus-label pattern as `ImportDropZone.tsx`, scaled down),
  `readBadgeIconFile` reads the chosen file into its own `data:` URI —
  client-side, no Storage bucket exists in this project (the same reason
  `lesson_content_blocks.image_url` is paste-only), capped at 100 KB since
  it lands inline in the `badges` row, not an object store, and restricted
  to a fixed image-type allow-list (PNG/JPEG/WebP/GIF/SVG) rather than a
  bare `image/*`. An uploaded SVG is safe to render exactly like every other
  badge icon (`<img src>`, never inline-injected or `<object>`) — an
  `<img>` runs SVG in "image mode," which never executes embedded scripts.
  Either mode's live preview renders the identical `data:` URI a save would
  write (`badgeIconToUrl`, never a CSS/React re-implementation of the same
  shapes), so preview and saved output can't drift apart.
  **`initialBadgeIconState`** decides which mode a badge opens in: an exact
  match against the picker's own output opens in picker mode with that real
  colour+glyph preselected; any other existing icon (the six hand-seeded
  rows, or a previous upload) opens in upload mode showing that same image,
  so switching tabs or editing an unrelated field never silently swaps out
  an icon nobody asked to change; a genuinely new badge starts in picker
  mode with gold+star already selected, not blank.
- **`condition_value` has no visible field at all for `course_complete`.**
  `fn_evaluate_badges` only ever checks "at least one course finished" for
  that type, so a number input with nothing meaningful to type into it would
  be worse than no field — the value is fixed at 1 in `handleSubmit` and the
  grid collapses to one column. The badge list's "Unlocks at" column reads
  in plain language too (`describeCondition` in `useBadges.ts`): "5 lessons
  completed", "7-day streak", "100 XP", "Finish a course", not the raw
  `condition_type`/`condition_value` pair.
- **Archiving a badge asks first — the one entity in this admin panel where
  Move to trash isn't immediate-plus-Undo-toast.** Games and Courses trash
  immediately (an Undo toast is the safety net); a badge can already be
  earned by real students, so `BadgesSection.tsx` confirms with an
  `AlertDialog` (the doc-blocks/quiz-questions delete-confirmation pattern)
  before calling the same trash action, stating explicitly that archiving
  never removes an already-earned badge. Verified directly, not assumed:
  archiving sets only `badges.deleted_at`/`deleted_by` — no cascade touches
  `user_badges`, and a student's `unlocked_at` row for an archived badge is
  untouched. The Active column is now a real inline `Switch` per row (was a
  dropdown-menu "Activate/Deactivate" item) — the same control, just no
  longer buried a click deeper — and the table gained a leading icon-preview
  column.
- **An editable numeric list keeps a per-row draft with an explicit Save,
  keyed by the saved value.** `ThresholdRow` in `LevelThresholdsSection.tsx`
  holds its own draft `useState`, and the parent keys it
  `${level}:${xp_required}`, so a successful save (list refetches, saved value
  changes) remounts the row with a fresh draft — no `useEffect` resetting
  state, which `react-hooks/set-state-in-effect` would reject. Save appears
  only when the draft differs from the saved value and is disabled while
  invalid: a half-typed number (`2` on the way to `2700`) is a real
  intermediate state, which is the same reason typed Settings fields keep a
  Save button while discrete controls auto-save. The client-side rule check
  (`validateThreshold` in `useLevelThresholds.ts`) deliberately mirrors the DB
  trigger's messages word for word — it's fast feedback in front of the
  trigger, never a replacement, and a DB rejection that slips through (a
  concurrent edit) still surfaces the trigger's own human-readable text.
  **Protect a structurally special row (level 1) in the UI with a disabled
  field and no delete affordance** rather than special-casing it in SQL —
  and record that the DB does NOT enforce it (see `rules.md`) so nobody
  assumes it does.
- **Every "delete" is "Move to trash" — immediate, with an Undo toast; only the
  Trash page deletes.** Courses, topics (modules), lessons, games and badges move
  to trash with no confirm dialog: `useTrashActions().trash([...])` runs the
  update per item, refreshes every admin query (lists, counts, the sidebar
  badge) and shows "Moved X to trash" (or "Moved N items to trash") with an
  **Undo** that restores exactly the items that moved, parents before children.
  Trashing is reversible, so the toast is the safety net, not a dialog.
  - **Users get the one exception**: a lightweight `TrashUsersDialog`, because
    trashing bans the login and signs them out. Title "Move Rahul to trash?",
    body "They will be signed out and lose access immediately. You can restore
    them any time from Trash.", buttons Cancel and **Move to trash in the default
    (not red) style**. Red is reserved for permanent deletion on the Trash page.
  - **Guards are disabled up front with a tooltip** (the primary admin, and the
    calling admin's own row) — the server still enforces them; this only saves a
    refused click. In a bulk selection those rows stay selectable and are
    reported as failures with the server's message.
  - **Partial failure is a first-class result:** "8 moved, 2 failed" with the
    first few "name — reason" lines, and Undo for the ones that did move.
  - **A write that RLS filters to zero rows returns no error**, so every trash and
    restore update asks for `.select('id')` and treats a row count other than the
    number requested as a failure — the exact bug class that made the old Delete
    buttons report success while removing nothing (`rules.md`).
  - Row-action menus say "Move to trash" (never "Delete"); no screen outside
    `/admin/trash` offers permanent deletion of a course, module, lesson, game,
    badge or user, and none calls the Edge Function `delete` action. (Payments
    keep their own older Trash view on `/admin/orders`; config-list rows —
    providers, currencies, level thresholds, quiz questions — are outside the
    trash-first set and still hard-delete with their own confirm.)
- **Column definitions must have a stable identity** (`useMemo`, with page-level
  handlers routed through `useStableCallbacks`). TanStack's `FlexRender` treats a
  column's `cell`/`header` function as a component type, so a column array
  rebuilt every render remounts every cell: an open row menu snaps shut on any
  background refetch, and a checkbox loses keyboard focus the moment its own
  toggle re-renders the table. `TrashTable` passes its row handlers through
  context instead; the other tables use the hook.
- **`/admin/trash` is the only place anything is permanently deleted.** One tab
  per entity (`?tab=courses|modules|lessons|games|badges|users`, the same
  search-param convention as Course Builder), each a full `TrashTable`
  (search, sort, pagination, the shared multi-select) showing name, "Was in"
  (parent course for a module, course › topic for a lesson, status/role
  elsewhere), Deleted at, and Deleted by (resolved to a display name — the
  Users tab looks the names up by id because a `profiles` → `profiles` embed
  resolves in the wrong direction). Rows are normalised to one `TrashRow`.
  - **Restore** is disabled with a tooltip naming the trashed parent ("Its
    course “X” is in the trash. Restore that first.") — blocked, never cascaded.
    Restoring a course or module asks first ("their modules and lessons reappear
    exactly as they were; anything trashed on its own stays trashed"); a slug
    collision (`23505`) says to rename or trash the live item using the slug.
  - **Delete permanently** is an AlertDialog with the exact count and a typed
    `DELETE`; after the run the same dialog shows the outcome (deleted / blocked
    with each item's readable reason / failed). A module's dialog quotes "N
    lessons will move to trash"; a blocked course lists what still uses it and
    offers "Archive it instead". Nothing shows a raw database error.
  - **Empty trash** (per tab) runs the same dialog over every trashed item in
    the tab and skips blocked ones, with a summary.
  - The sidebar's Trash entry carries the total count badge.
- **CSV export and import (Users).** Shared helpers live in `lib/csv.ts`:
  `toCsv(rows, columns)` (RFC 4180 quoting, CRLF, and a formula-injection
  guard — a string cell starting with `=`, `+`, `-`, `@`, TAB or CR gets one
  leading `'`; real numbers are exempt), `download(filename, csv)` (prepends a
  UTF-8 BOM), `parseCsvTable(text)` (papaparse: BOM strip, delimiter
  auto-detect, blank lines skipped, an unclosed quote is fatal) and
  `stripFormulaGuard` (undoes the guard so an exported file re-imports as it
  was). The Orders export/import still uses the original hand-written helpers
  (`parseCsv`, `stringifyCsv`, `downloadTextFile`), which have no BOM and no
  guard.
  - **Export** — an Export menu in the Users header: *Selected rows* (disabled
    with nothing selected), *Current filtered results* (every page of the
    current search + role filter, in the table's sort order) and *All users*,
    plus an *Include trashed users* toggle (off by default; it has no effect on
    *Selected rows*, since a trashed user can't be ticked in the list).
    *Export selected* is repeated in the bulk bar. Columns: `id, display_name,
    email, role, xp, level, phone_number, created_at, status` (`active` or
    `trashed`); `xp` and `level` are blank for a user with no `user_stats` row.
    No password or hash is ever exported. The file is
    `wisdom-hatch-users-YYYY-MM-DD.csv` (the admin's local date) and a toast
    reports the count ("Exported N users"). "All users" and the trashed part of
    a filtered export come from `fetchUsers(scope)` in `useUsers.ts`, which
    pages in batches of 1000 and also backs the list itself.
  - **Import** — the Import button opens `ImportUsersDialog`
    (`components/admin/users/import/`), four views. (1) A Download template
    link (`display_name, email, phone_number, password` plus two example rows)
    and a drop zone: .csv only, ≤ 2 MB, ≤ 1000 rows, each refused with its own
    message. (2) A preview, one line per row: Valid, Error with its reason,
    "Already exists, will be skipped", or "In trash, restore that user
    instead"; the password column says only "Provided" or "Auto-generate",
    never the value; unknown columns are listed in a warning, and a `role`
    column is one of them — everything imported is a student. "Row" is the
    position among non-blank rows (header = 1). (3) *Import N valid rows* sends
    chunks of 25 to `bulk_create` one after another, with a progress bar
    ("Batch i of n"), a Stop that halts after the chunk in flight, and retry
    with backoff (1 s, 2 s, 4 s) on 429, 502/503/504 and network errors; a
    request unanswered for 60 s is abandoned and retried. The dialog cannot be
    closed while running (no X or Cancel; Escape is ignored — exercised; outside
    clicks and closing the tab are also guarded in code but were not exercised). A chunk that still can't be delivered ends the run: its rows are
    failed and the rest are "Not imported". (4) A summary: created / skipped /
    failed (plus Not imported), a table of every row that needs attention, and
    *Download results CSV* (`email, status, reason, generated_password`), built
    in memory on click. When the server generated passwords the summary warns
    that the file holds credentials that cannot be regenerated, and closing
    without downloading asks first. The dialog drops its rows and any
    passwords about 300 ms after it closes.
  - A **"Needs attention"** row is not a failure but did not go cleanly: the
    phone number could not be saved, or a retried chunk found its accounts
    already created (the unheard first reply may have carried their generated
    passwords — reset the password from the user's actions).
- Installed shadcn components: button, table, dialog, alert-dialog,
  dropdown-menu, input, label, select, badge, skeleton, avatar, tooltip,
  sonner, switch, checkbox, tabs (used since Course Builder, missing from
  this list until now — corrected, not a new install), popover, command,
  input-group (pulled in by `command`, not imported directly), textarea, sheet
  (generated, currently unused by any page or component), and progress (used by
  the import dialog; written by hand in the shadcn shape from `radix-ui`'s
  Progress rather than with `shadcn add`, to avoid the CLI's Windows path bug
  described in `context.md`).
  The generated `checkbox.tsx` unconditionally
  rendered `CheckIcon` for every checked state — hand-patched to swap in
  `MinusIcon` when `checked === "indeterminate"`, since a bulk-selection
  header checkbox needs the two states to actually look different (see the
  row-selection entry above). Documented here because it's a hand-edit to a
  generated file, same disclosure obligation as `button.tsx`/`badge.tsx` in
  `context.md`'s gotchas.

## Testing on a real phone over Wi-Fi

1. Run the dev server so it listens on the network: `npm run dev -- --host`
   (Vite prints a `Network:` URL such as `http://192.168.x.x:5173`).
2. Put the phone on the **same Wi-Fi** as the computer and open that URL in the
   phone's browser.
3. If the page never loads, the computer's firewall is the usual cause: allow
   Node.js through Windows Defender Firewall for **Private** networks (or allow
   inbound TCP 5173).
4. **It is `http`, not `https`, so the page is an insecure context.** Sign-in,
   the roadmap, the admin screens and Supabase calls all work (verified in
   desktop Chromium against the LAN IP, `window.isSecureContext === false`), but
   browsers withhold secure-context-only APIs there: `crypto.randomUUID`,
   `crypto.subtle`, clipboard, camera/microphone, share, notifications and
   service workers. Code must not depend on them without a fallback (`rules.md`,
   `uuid()` in `src/lib/uuid.ts`). Anything that genuinely needs one — a future
   camera or push feature — can only be tested on `localhost` or over HTTPS.
5. `localhost` on the phone means the phone itself; always use the computer's
   LAN IP. Not yet exercised: a real phone, the Capacitor webview and iOS Safari.

### Lesson page layout (simplified 2026-09-24, ages 5 to 7)

One obvious thing to do per screen; when in doubt, cut. The page is scoped to the
lesson's MODULE: the list shows only this module's lessons, the only count is this
module's ("3 of 5", published lessons only, from `fn_course_lesson_states`), and the
course name never appears. Same content at every size.

1. **Top bar** (`KidLayout`, shared with the roadmap): back arrow and the lesson title,
   nothing else (the active-time ring is gone; the heartbeat still runs). Solid `--cream`
   (no translucency, so content never shows through it), sticky, safe-area padded; the back
   button is 56px and the title 18px.
2. **Hero** (`LessonHero`): the lesson title large and bold, the module name under it in
   regular 18px. A soft teal-tinted wash with a curved edge; two outline shapes (teal, plum)
   from md up only. No pill, no count.
3. **Activity card** (`ActivityCard`, one `.kid-card`): for a video or game, a teal icon
   tile, one description line (`lessons.summary`, else a short default) and the big gold
   Play button, THE main action. Play mounts the video (embeds get `autoplay=1`, a file
   plays with its controls) or the game frame in the card. Reading lessons show their text
   directly; quizzes run their own flow without the card chrome (their sticky bar cannot
   live inside a card). A completed lesson shows one teal "Done" check badge and its Play
   turns into a non-gold "Play again". A lesson whose video or game cannot load at all shows
   the error straight away rather than a Play that leads nowhere. "Watch" / "Play" step
   labels exist only for a two-step lesson, which the schema cannot express today, so none
   render.
4. **Lesson list** (`ModuleLessonList`), titled with the module name, a small teal ring and
   "X of N". One row per lesson, 56px minimum, the whole row tappable. States, each with its
   own icon: done (teal check), current (teal outline, lesson-type icon), next (gold accent,
   arrow icon, "Next" tag; this is the roadmap's own `currentLessonId`), locked (lock icon,
   dimmed, not tappable, no text). Below lg it follows the card; from lg it is a sticky
   20rem left column beside the card.
5. **Finish action**: once the lesson is completed, one sticky gold button,
   "Next: <title>" (the next lesson in this module) or "Back to roadmap" after the module's
   last. Otherwise no bottom button.

### Desktop widths (2026-09-27): one breakpoint, one column

**Superseded from 1024px for the four nav screens only (2026-09-30):** Home, Badges, Courses and Profile
now get a left sidebar in place of the bottom nav, and Home a list layout with a right rail (next
section). Everything below still holds for 768-1023px and for every other kid screen at any width.

The kid app is mobile-first and stays exactly that below **768px** (checked: the Home, video, doc, quiz
and game pages are pixel-identical at 360, 390 and 430px before and after). From 768px it is a centred
column, not a redesign: no sidebar, no second column, no moved controls. Single source of truth, in
`kid.css` (`.kid-app { --kid-col; --kid-col-wide }` and the "desktop widths" block at the end):

| | Value | Applies to |
|---|---|---|
| Breakpoint | `min-width: 768px` (the tiers above already used it) | everything below |
| `--kid-col` | 40rem (640px) | the roadmap (path, stat bar, module bar, dividers), text, doc blocks, quiz, lesson info, the bottom nav, the top bar's contents |
| `--kid-col-wide` | 64rem (1024px), capped at the window minus 2rem | the video player and the game frame only, centred over the column |
| Quiz measure | 34rem (544px) | the quiz flow: answer buttons stay 544x64, not a slab |
| Callouts | 36rem | doc callout cards |

- The cream page fills the window; the top bar's background spans it and its row (Back) sits in the column.
- **Bottom nav**: still at the bottom, but `--kid-col` wide, centred, with rounded top corners and a hairline
  border, instead of an edge to edge stripe. (768-1023px only; from 1024px it is replaced by the sidebar.)
- **Lesson pages** are one column at every width. The earlier "from lg the module list is a sticky left
  column" (legacy HTML doc lessons) and the 70rem main width at 1024px are gone.
- **Media**: `.lp-video-bleed` and `.lp-game-bleed` are `position: relative; left: 50%; translateX(-50%)` at
  `min(64rem, 100vw - 2rem)` with 20px corners; the game frame's height is the window's minus the top bar,
  capped at 44rem. The column (`.lp`, `.lp-layout`, `.lp-main`) is pinned to its own width so a wider child
  cannot grow it. Everything under the player (title, description, time bar) stays in the standard column.
- **Popover, stat bar, module bar** needed no change: the popover measures the node and the path's own box, so
  it stays inside the column (verified at 1280 and 1600px: tail on the node's centre, flips above near the nav).
- **Completion card** is the existing dialog (28rem at md and up), centred; the quiz "+N XP earned" line is
  content-width, not a slab.
- **Orientation lock** on a desktop browser: the plugin's web fallback is called, its refusal is swallowed, no
  page error, no layout change. The "turn your phone" hint now shows only on a coarse pointer (a handheld),
  never in a desktop window.
- **Hover** (`@media (hover: hover)`, so touch screens are unchanged): nodes, popover and primary buttons
  brighten slightly, nav tabs and quiz options tint teal-10%, course rows lift 2px, the course link's underline
  thickens, the player's icon buttons get a soft cream wash, quiet buttons a faint ink wash. Simple by design.
- **Verified** at 1280 and 1600px on the live project: Home (column, nav, popover), video, doc, quiz through
  its completion card, game.
- **Rough but left alone**: the Back arrow sits at the column's left edge rather than the window's; the
  placeholder demo games are `example.com` pages, and on desktop a host with no CORS headers logs one blocked
  fetch to the console before the game loads straight from its URL (the cache falls back, nothing breaks);
  the admin panel was not touched.

### Desktop shell and Home (2026-09-30): sidebar, list, right rail

At **>= 1024px** (`LG_UP` in `useMediaQuery.ts`, Tailwind `lg`) the four nav screens change presentation;
below it nothing changed (checked at 1023 and 390px against the old layout: bottom nav, path, stat bar).
**This supersedes the earlier locked decision that "on desktop the bottom nav stays at the bottom,
matching the content column width".** The lesson player, `/courses/$courseId`, admin, and Badges /
Courses / Profile *content* are untouched (they only gain the shell and sit centred for now; grid
redesigns come later).

- **One switch, in JS.** `KidLayout` and `KidHomePage` read `useMediaQuery(LG_UP)` (a `useSyncExternalStore`
  over `matchMedia`, correct on first render, no flash) and mount ONE view. CSS hiding is not used: the
  mobile path auto-scrolls and opens a popover on mount and must not run on desktop. `KidLayout` also sets
  `data-shell="side"` from the same value, so the shell CSS has no media query of its own and the mounted
  nav and the CSS cannot disagree.
- **Sidebar** (`KidSidebar`, `.kid-side`): fixed, 15rem (`--kid-side-w`), full height, `--surface` with a
  hairline right border and a soft warm shadow. Top: the owl mark (`OwlMark`, exported from
  `AppEntranceSplash.tsx`, `size` 40, decorative) plus the "Wisdom Hatch Kids" wordmark, a link Home. Then
  `<nav aria-label="Main">` with Home, Badges, Courses, Profile from `KID_TABS` (same icons; Profile shows
  the student's avatar), each full width and >= 48px tall. Active: the bottom nav's teal pill, bold label,
  `aria-current="page"`; hover a light teal tint (mouse only); focus-visible is the shared 3px ink ring.
  Tapping the active item is a no-op, as in the bottom nav. It is first in the DOM (fixed, so nothing moves)
  so Tab goes sidebar, then the page. The bottom nav (`KidNav`) is not mounted at this width, so it is
  neither focusable nor announced; `--kid-bottom-inset` is 0.
- **Content area**: `.kid-app[data-shell="side"]` pads left by the sidebar; `.kid-main` is capped at
  68.75rem (1100px), centred in the remaining space, with 2rem padding. Baloo 2 as everywhere under
  `.kid-app`; admin is untouched. The top bar still shows its title on Badges / Courses / Profile, in the
  old 40rem row (a known rough edge until those screens are redone).
- **Desktop Home** (`components/kid/home/DesktopHome.tsx`): same data, no new query. `useHomeCourse` picks
  the course; `useCourseRoadmap` (already shared with the mobile path; the only change is a new
  `Roadmap.gamified` flag) supplies sections, lesson states, XP and the next-up id. It also stamps the
  enrollment (`useTouchEnrollment`) as the mobile view does. Loading is a 5-row skeleton; not-enrolled,
  unavailable, empty, error and "No courses yet" reuse the mobile screens and copy (rail hidden).
  - **Main column**: one `<h1>` (course name) with a quiet teal-d "Switch course" link to `/courses`
    (replaces the stat bar's course link). Every module is a collapsible `<section>` (see "Desktop Home
    polish") with a header band (caption "SECTION N", `<h2>` title, "3 of 5 lessons"; teal-d as on the
    mobile module bar, muted with a lock when every lesson in it is locked; not sticky). Lessons are `<li>`
    rows, flat cards on `--surface` with a soft shadow and no 3D press, >= 60px tall.
  - **Row states**, each an icon AND a word, never colour alone: **Completed** (teal check, "Review" link
    text), **Next up** (the only gold: gold outline + tint, a gold play badge and a flat gold ink-text
    "Start" button, or "Keep going" if in progress, the mobile wording), **Available** (open-lock icon,
    teal-d "Start" and chevron; "In progress" if it is), **Locked** (lock, muted, `aria-disabled="true"`, a
    plain `div` with no href, so not focusable and no navigation). Every unlocked row is a real link to the
    lesson player (the same destination as the mobile popover). Each row also shows the type icon + word
    (Video / Reading / Quiz / Game) and a "+N XP" chip on unlocked rows only (locked rows hide it, as the
    mobile node does; this supersedes the first build, which kept a muted chip there).
  - **On open** the next-up row (or, for a finished course, the "You finished every lesson!" note) is
    scrolled to the middle, smooth unless `prefers-reduced-motion`, once per mount. Nothing opens by
    itself; no popover, decoration, dividers or connector exist on desktop.
  - **Right rail** (300px+, sticky): day-streak card (coral-d flame) and total-XP card (plum-d sparkle),
    same values as the mobile stat bar (`useKidProfile`), plus a "Course progress" card (done of total
    lessons, teal-d bar, `role="progressbar"`) from the roadmap already loaded. No gold. **A
    gamification-off course** hides the XP chips (the roadmap already sets `xp` to null) and the streak and
    XP cards, exactly as the mobile stat bar hides its pills; only the progress card remains.
- **Accessibility**: one `<h1>`, sections `<h2>`, lessons in a `<ul>`; Tab order brand, four nav items,
  "Switch course", unlocked rows (locked skipped); text on gold is ink; the section band's cream on teal-d
  and teal-d on cream are the mobile pairs already measured; hit targets >= 44px; hover only under
  `@media (hover: hover)`; transitions off under reduced motion.
- **Verified** in Chromium against the live project with a throwaway student (removed after): 1280, 1366,
  1440 and 1024px (sidebar, no bottom nav, no path, one gold element, next-up centred, 8 lessons visible at
  1366x768, no horizontal overflow, no console errors), 1023 and 390px (unchanged), the in-progress and
  gamification-off variants, reduced motion, Tab order, a locked click (no navigation), and Badges /
  Courses / Profile inside the shell. Not exercised: a real Android tablet in the Capacitor shell (which
  also gets this layout at >= 1024px wide), a screen reader, Firefox or Safari.

#### Desktop Home polish (2026-09-30): Nunito type scale, collapsible sections

Scope is `.kid-app[data-shell='side']` only (kid.css); mobile and 768-1023px markup and CSS are untouched.

- **Type.** Token `--font-ui-desktop` = Nunito Variable, then Baloo 2 (so Devanagari still resolves), then
  system. The scale is `--kd-text-*` / `--kd-leading-*` (12, 13, 14, 15, 16, 20, 28, 32px; leading 1.2 /
  1.3 / 1.4), **not** `--text-*`, which is Tailwind's own theme namespace and would rewrite `text-sm` etc.
  Roles: page `<h1>` Baloo 2 32/700; section caption Nunito 12/700, .08em, uppercase, cream mixed toward
  teal-d; section title Baloo 2 20/700; "N of M lessons" Nunito 13/600; lesson title Nunito 16/700 lh 1.3;
  meta Nunito 13/600 `--kid-muted-fg`; row action Nunito 14/700; "Review" is a quiet 14/600 muted link with
  a chevron; the gold Start / Keep going is Nunito 15/800 ink on gold; sidebar labels Nunito 15/600, 700
  when active (wordmark stays Baloo 2); rail number Baloo 2 28/700, rail label Nunito 13/600. Nunito is
  fetched only where those selectors render (checked: no request at 390px).
- **XP chip strengths** (locked rows have none; a gamification-off course has no xp at all): next-up full
  (ink, 1.5px ring, coral-d icon), available softer (hairline ring, 600, dimmed icon), completed no ring,
  no fill, muted text and icon.
- **Sections are disclosure accordions.** The band is a `<button>` inside the `<h2>`
  (`aria-expanded`, `aria-controls`, >= 44px, real focus ring), multi-open, local state keyed by section id,
  not persisted. Default open: only the section holding the next-up lesson; a finished course opens the
  last section; a single section is open; no next-up and unfinished opens the first. If a refetch moves
  next-up into a closed section it opens once (render-time state adjustment, not an effect); closing it
  afterwards sticks. Locked sections open too; their rows stay locked and inert. The band shows caption,
  title, "N of M lessons", a slim decorative progress bar (`aria-hidden`), a check when complete, a chevron
  rotating 90deg, and a quiet cream "Next up" pill (never gold) when collapsed and holding the next-up
  lesson. A locked band uses ink text on the muted fill (muted-fg there was 4.2:1). "Expand all" /
  "Collapse all" is a text link beside "Switch course" when there is more than one section.
- **Motion and a11y.** The panel animates `grid-template-rows` 0fr -> 1fr over `--motion-base`; closed
  content is `inert` (out of Tab order and the accessibility tree) and `visibility:hidden` after the
  transition. Under `prefers-reduced-motion` the toggle is instant. Toggling never moves the page; closing
  a section whose header is above the viewport scrolls the header back into view.
- **Contrast** (computed in Chromium, alpha composited): all text >= 4.5:1 (lowest: band caption 5.07,
  locked-row text 5.00, row meta and rail label 5.76; gold-button ink 7.33).
- **Verified** (Chromium, live project, throwaway students removed after, baseline counts of 3 courses /
  17 lessons / 7 modules confirmed): tsc, lint, build; 1024 / 1280 / 1366x768 / 1920 with no horizontal
  overflow; 1023 and 390 unchanged; the four default-open cases (mid-course, finished, single section,
  gamification off); toggle, multi-open, expand/collapse all, no page jump, keyboard Enter/Space with focus
  kept, closed rows skipped by Tab; auto-open-once; reduced motion (0s durations, instant toggle); font
  requests; live resize across 1023/1024. At 1366x768 the mid-course page shows 4 lesson rows and 4
  section headers by default (5 headers counting the partly visible one) vs 8 lessons and 0 headers
  before: fewer rows, but the whole course outline is now visible at once. The page reserves its scrollbar width (`scrollbar-gutter: stable` on html, desktop shell only) so opening a section never shifts the layout sideways (measured 0px). Known: crossing 1024 unmounts
  the desktop view, so open sections reset. Not exercised: a real tablet, a screen reader, Firefox / Safari.

### Desktop Profile and the shared page header (2026-10-01)

At >= 1024px `/profile` is laid out for width; below it nothing changed (the 1023 and 390px screenshots are
byte-identical to before). `KidProfilePage` is now a thin switch: the same `useMediaQuery(LG_UP)` the shell
uses mounts `DesktopProfile` OR `MobileProfile` (the old page body, unchanged), never both, so the mobile
view's effects never run on desktop. Whether the builder is open (`building`) lives in the switch, so a resize
across 1024px keeps the page in edit mode.

- **Shared `DesktopPageHeader`** (`components/kid/DesktopPageHeader.tsx`): one `<h1>` (Baloo 2 32/700, the
  Home title role), an optional subtitle slot (desktop UI font 14/600, `--kid-muted-fg`) and an optional
  right-aligned actions slot, inside the content area so it lines up with Home. **Badges and Courses have NOT
  been converted**; they adopt it in their own passes (they keep the old top bar at every width today).
- **Old top-bar title hidden on Profile at >= 1024px, and only there.** Cause of the narrow title: from 768px
  `.kid-topbar-row` is capped at `--kid-col` (40rem) and centred, while the desktop `.kid-main` is 68.75rem,
  so the title sat in a column narrower than the content; Badges and Courses share the bar. The page view
  calls `useOwnDesktopHeader()` (kidHeader.ts), `KidLayout` sets `data-own-header` (only together with
  `data-shell='side'`), and kid.css then hides the row and its border and sets `--kid-topbar-h: 0px`, as Home
  does. It is only mounted at >= 1024px, so the mechanism cannot disagree with the shell.
- **Layout**: a two-column grid, identity card 340-380px (`clamp(21.25rem, 30%, 23.75rem)`) and the rest,
  inside the same 68.75rem content box as Home. DOM and Tab order: header, identity card, right column. Left:
  `ProfileIdentityCard`, sticky at top 2rem: the avatar at 152px in its ring, the name (Baloo 2 28/700, two
  lines then an ellipsis, `overflow-wrap: anywhere`, the full name in `title`), and the page's ONE gold
  element, a flat ink-on-gold "Edit your avatar" button (the existing entry wording; it keeps
  `data-testid="edit-avatar"`). Right: `ProfileStatCard` x3 in an auto-fit grid (Level, XP, Day streak: the
  Home rail's `.khd-card`, Baloo 2 28 number, Nunito 13/600 label), the streak calendar ("Your last 5
  weeks", capped at 21rem wide so its cells stay modest), Preferences & Support, Account & Security
  (collapsed by default), and Log out, quiet and last (`.candy-btn-quiet`, left-aligned), bottom of the
  column.
- **Reuse, nothing new**: every value comes from `useKidProfile` / `useActivityDays` / `useUpdateAvatar`; the
  sections moved unchanged into `components/kid/profile/ProfileSections.tsx` (shared by both views) and log
  out into `hooks/useLogOut.ts`. **Content that exists on mobile and nowhere else stays as it was**: there is
  no badges summary and no lessons-completed stat on the mobile Profile, so none was invented; Profile has
  never hidden XP or streak for a gamification-off course (it is not course-scoped), so nothing is hidden here
  either.
- **Desktop type and cards**: only the existing roles (`--kd-text-*`, `--font-ui-desktop`). The sections keep
  their mobile markup (`.kp-card`) with desktop overrides scoped under `.kpd-main`: 22px radius, Baloo 2 20/700
  titles, Nunito for the small text, rows >= 44px with a hover wash (mouse only; the switches' hit area is
  extended without changing how they look), no candy press on cards.
- **Gold audit**: exactly one gold element in view mode, including with Account & Security open (the Terms
  row's gold icon badge and the email-pending gold wash use coral and teal on desktop; the account forms'
  submit buttons use the teal-d candy tone), and exactly one in edit mode (Save avatar).
- **Edit mode**: the builder replaces the identity card and right column under the same header, whose title
  becomes "Edit your avatar" (same size, so the header and sidebar do not move: measured identical rects). The
  builder's own two-column layout is untouched. Focus moves to the builder's Shuffle button on entering and
  back to "Edit your avatar" on Save or Cancel (transition-only effect, so a remount does not steal focus).
  After Save the identity card and the sidebar show the new avatar at once (shared cache).
- **States**: null avatar renders the default via `normalizeAvatarConfig`; a zero student shows 1 / 0 / 0; a
  45+ character name, with or without spaces, stays inside the card; loading is a skeleton of the identity
  card and stat cards; the error state is the existing `RetryScreen` alone (it brings its own h1, so no page
  header there).
- **Resize across 1024px** (single session): view mode swaps cleanly (one view mounted, sidebar and bottom
  nav swap, `data-own-header` clears and returns). **In edit mode the page stays in edit mode, but the
  builder's unsaved picks are lost** (they are local state inside `AvatarBuilder`, which remounts; keeping
  them would need a change to the builder's internals, which this pass did not make).
- **Verified** (Chromium, live project, throwaway students removed after): 1024 / 1280 / 1366x768 / 1440 /
  1920 with no horizontal scroll and no console errors, content centred in 1100px, the identity card sticky
  (32px from the top after scrolling); Tab order (sidebar, Edit your avatar, switches, links, Account, fields,
  then Log out last), Enter/Space activation, 3px ink focus ring, no target under 44px; contrast all >= 4.5:1
  (lowest 5.43); Baloo 2 on the h1, name, stat numbers and card titles, Nunito on the small text; Nunito is
  not requested on /login. Not exercised: a real tablet, a screen reader, Firefox / Safari.

### Game lessons (2026-09-26)

A game lesson hosts a page the admin registered in `games` (`bundle_url`); there is no content to build.
`LessonPlayerShell` variant `game`: the game fills the screen below the top bar (`.lp-game-bleed`, edge to
edge, cancelling the page gutter and bottom padding), the top bar carries Back and nothing else (no title),
there is no hero, module list, Next bar or bottom nav. The old "Play" start card is gone (the game loads on
entry). `GameLesson` is the host.

- **Loading and failure.** A `role="status"` overlay ("Getting your game ready.", a teal-d spinner on cream)
  covers the frame until it fires `load`; a frame that has not loaded within 10 s becomes the shared
  `PlayerError` with Try again (the same pattern and tone as the video failure), and a lesson whose game or
  URL is unusable shows "This game isn't ready". Known limit (unchanged): a cross-origin frame fires `load`
  for an error page too, so a URL that answers with a broken page cannot be told from a game.
- **The frame.** A live load is `src` with `sandbox="allow-scripts allow-same-origin"` (safe: the game is on
  another origin, so it still cannot reach this app, and it keeps its own storage); a stored or freshly
  fetched entry page is `srcdoc` with `sandbox="allow-scripts"` only (no same-origin, or a `srcdoc` frame
  would share this app's origin) and a `<base>` for the game's folder so its relative links still load. No
  referrer; `allow="autoplay"` only.
- **Best-effort entry-page cache** (`lib/gameCache.ts`, Capacitor Filesystem: real files on iOS and Android,
  IndexedDB in a browser). The first successful `fetch` of `bundle_url` stores the entry document and a small
  meta file (`bundle_version`, `bundle_url`); later visits show the stored copy unless the version or URL
  changed, in which case it is fetched again and replaced. **This caches the entry document only. It is not
  offline support**, and no user-facing copy claims it: whatever the page pulls in (scripts, images, audio)
  still comes from the game's host through that host's own cache headers and the WebView's HTTP cache, and a
  cross-origin frame's subresources cannot be intercepted or kept by this app. Any failure (the host sends no
  CORS headers to a browser, offline, storage full) falls back to loading straight from the URL; on a native
  shell `CapacitorHttp` is enabled in `capacitor.config.json` so the fetch does not depend on CORS.
- **Orientation.** For `orientation` of `portrait` or `landscape` (not `any`) the device is locked while the
  game is mounted and unlocked on exit, through `@capacitor/screen-orientation` (`lib/gameOrientation.ts`),
  never throwing. In a plain browser the plugin falls back to the web Screen Orientation API, and the old
  "turn your phone" hint shows only when not native.
- **Completion contract (for whoever builds or uploads a game bundle).** The game reports that the child
  finished with one message to its parent:

  ```js
  window.parent.postMessage({ type: 'game:complete', score: 12 }, '*')
  ```

  `score` must be a finite number, zero or more, and is the XP the game thinks was earned: the server floors
  it and clamps it to the game's `max_xp` (`games.max_xp`, set by the admin), so a game can never award more
  than that, and a huge number is simply capped. A message with another `type`, a missing, non-number,
  non-finite or negative `score`, or that comes from any window but this game's own frame is ignored. The app
  never credits XP from the message: it holds the first valid score, waits for the lesson's minimum time, and
  sends it to `fn_complete_game` (`schema.md`). The game may send the message every time it is finished; only
  the first, on an incomplete lesson, awards XP, and the game itself can be replayed freely. A game should not
  rely on its own origin's storage when the entry page is served from the stored copy (opaque origin).
- **Only this game can speak.** A `message` counts only if `event.source` is this frame's own window AND its
  origin equals the origin of `bundle_url`; a message from the app window, another frame or a popup never
  matches. The one variant: when the entry page comes from a stored or fetched copy (opaque-origin `srcdoc`),
  the origin is the string `null`, and the frame-window check alone identifies the sender.
- **Celebration and replay.** A first completion opens the shared gold completion sheet (`+N XP`, one
  "Continue to next lesson", exactly as video, doc and quiz); XP is the server's clamped score, once. A
  finished lesson replayed (its message arrives while the lesson is completed) shows a small pill over the
  game ("Nice replay! No XP this time.", 5 s) and calls nothing.
- **Verified** in Chromium against the live project with real JWTs and a local test game: see `changelog.md`.
  The native plugins were exercised only through their browser fallbacks (see `state.md`).

### Doc lessons with content blocks (2026-09-26)

A `text` lesson whose `lesson_content_blocks` (migration 023, `schema.md`) are not empty gets its own
single-column page, sharing the video page's title row and progress bar (`LessonStatus`:
`LessonTitle`, `LessonTimeBar`, `DocInfo`); a doc lesson with no blocks keeps the older hero plus
sandboxed HTML frame (`content_html`), and a failed blocks fetch counts as no blocks. Top to bottom:
the back-arrow-only top bar (no title), the title with its inline marker (the XP pill while there is
XP to earn, the small check badge once done, never both; glued to the title's last word), the slim
minimum-time bar ("Reading time 0:20 of 1:00", shown only while completable and when the lesson has
a minimum) and the blocks in `position` order, one column, 1rem apart. No hero, no module list, no
Next bar, no description, no separate header illustration (a lesson that wants a header image puts an
image block first). No bottom nav.

- **paragraph**: plain body text (18px, weight 400, Baloo 2), rendered as text, never HTML.
- **callout**: a `.kid-card` with a 3rem round icon in the block's colour token at full strength
  and its `-d` variant as a `0 4px 0` press shadow (the candy button convention), a cream icon
  (`lucide`: info, lightbulb, star, heart, circle-help) and the text in ink at weight 600. The icons are
  decorative (`aria-hidden`; the text carries the meaning) and do not reach 3:1 against their circles
  (cream on teal 2.88:1, coral 2.75:1, gold lower, plum higher); that follows the brief's cream icon and
  is worth a look in the later design pass.
- **image**: the pasted URL in a `figure` with a 20px radius, capped at 32rem, `img` at natural
  proportions (no cropping), lazy-loaded, alt text from `image_alt` (empty when none). A URL that is
  not https (http in dev) is skipped, like every other embedded URL.
- **Completion is minimum-time only.** There is no end-of-content signal, so the heartbeat counts
  whenever the page is open and foregrounded (nothing is gated on play or pause, unlike video) and the
  existing auto-finish calls `fn_complete_lesson` the moment the server says the minimum is met; a
  lesson with no minimum completes as soon as its blocks have loaded (nothing shows or completes
  before they arrive, because the blocks decide the layout). The gold completion sheet is the video
  lesson's own (`LessonCompleteSheet`, one "Continue to next lesson" button). A revisit opens in replay:
  the check badge, no XP pill, no time bar, no clock, no sheet, no XP.

### Video lessons (2026-09-26)

The first fully built lesson type; it reuses the page above (heartbeat, server completion and
XP, module list, replay mode) and changes only what a video needs. Nothing about doc, quiz or
game lessons changed, apart from two shared fixes listed at the end.

- **Layout** (`LessonPlayerShell`, video branch). No hero and no activity card: the player runs
  edge to edge right under the top bar (`.lp-video-bleed` cancels the page gutter; from md it sits
  in its column with 20px corners). The top bar carries only Back (no title, since the title is
  under the player). Simplified 2026-09-26 to a YouTube-style page, top to bottom: the player, the
  title (`.lp-hero-title`, the app's existing lesson title style) with its status marker on the same
  line, the description as a normal paragraph (`lessons.summary`; none is shown when it is empty; the
  module name is no longer on the page), and the minimum-time bar. There is no status row and nothing
  between the title and the description. **No module list and no Next / Back bar**: the completion
  sheet's one button is the only next-step action, and Back in the top bar leaves. The marker sits
  inside the `h1`, glued to the title's last word (`.lp-vtitle-tail`, nowrap), so a title that fills the
  line wraps that word and the marker together, and it is one of two things, never both: the roadmap's
  `.rm-chip` XP pill (`+10 XP`) while there is XP to earn, or, for a finished lesson, a small check
  badge (`.lp-done-mark`, cream on `--teal-d`, 1.75rem, `role="img"` labelled "Done"; a status, not a
  control). Replaying lives in the player's control strip (below), not in the content. Nothing on the
  page is floating or positioned, so nothing can sit under the top bar. No bottom nav (the nav only
  shows on Home, Badges, Courses and Profile).
- **Player** (`VideoLesson`, `VideoEngines`, `lib/videoPlayback.ts`). A chromeless stage over our
  own control strip: play or pause, a scrubber that seeks freely in both directions, mute plus a
  volume slider (the slider hides below 400px, where the strip also shows only the current time; the
  mute button stays), a **replay** button next to play (rewinds to 0:00 and plays; earns nothing extra,
  active time still counts only as playing), and full screen. No speed control.

  **Full screen.** Where the Fullscreen API exists (desktop, Android, iPad) the whole player, strip
  included, goes fullscreen, and on entering it the page calls `screen.orientation.lock('landscape')`;
  on leaving (including Esc or the system back gesture, since it is driven by `fullscreenchange`) it
  calls `unlock()`. Both are wrapped in try/catch and never touch playback: a browser without the API,
  or one that refuses the lock, just stays as it was. On **iOS** (iPhone, iPad, or an iPad reporting
  as a Mac) a file goes to the OS's own player through the video element's `webkitEnterFullscreen`,
  which rotates by itself and never uses the lock; the button shows there even though the iPhone has
  no Fullscreen API. A YouTube or Vimeo embed on iOS has no native path (its video is in another
  origin's frame): the button shows only where the Fullscreen API does (iPad), else it is hidden. Cream on `--ink`; the big centre Play is the one gold thing. Three engines report the
  same state (`ready`, `playing`, `ended`, `current`, `duration`, `volume`, `muted`, `failed`) and
  register the same controls: a plain https file (`<video>`; dev/test only, see `video.ts`), a
  YouTube embed (`controls=0`, driven over its postMessage API: the `listening` handshake, then
  `infoDelivery` and `onStateChange`) and a Vimeo embed (`controls=0`, its postMessage
  `addEventListener` API). No third-party script is loaded. The iframes have `pointer-events: none`
  so the provider's own controls are never tappable. A failed engine shows the existing
  `PlayerError` with Try again.
- **Active time counts only while the video is actually playing.** `useLessonClock` takes an
  `active` flag (`ClockPause` gains `idle`): false stops the clock exactly like a backgrounded
  app, with the same quiet period on resume, so paused time never counts. The page passes
  "the video is playing" (a stop is reported after 1 s so a buffering blip does not stop the
  clock; playing is reported at once). When the video stops after counting, the clock sends one
  final beat so the stretch just played is credited (the server credits the real elapsed seconds,
  capped); a stop during the quiet period sends nothing, because nothing was being counted and a beat
  then would credit the paused gap. Backgrounding the app still pauses as before.
- **Completion needs both**: the server says the minimum time is met AND the video played to its
  end (`ended`). Seeking to the end satisfies only the second, so it never completes a lesson whose
  time is not met. The existing auto-finish then calls `fn_complete_lesson` once; XP is awarded
  once by the server. A video with no usable URL keeps the old rule (time only).
- **Minimum-time bar** (`.lp-timebar`): a slim `--teal-d` fill on the muted track with "Watch time
  0:05 of 2:00" under it, separate from the scrubber. It shows only while the lesson can still be
  completed.
- **Completion card**: the existing `LessonCompleteSheet` (teal check medallion, "Lesson done!",
  the `+N XP` count-up, confetti). It now has ONE button: "Continue to next lesson" when the next
  lesson is open, else "Back to roadmap" (the secondary link is gone for every lesson type).
- **Revisiting a completed lesson** opens in replay: the check badge instead of the XP pill (no time
  bar), no clock, no XP, no celebration, however much of the video is played, including after the
  replay button.
- **Back** returns to Home at the node the child left from: the player records its lesson
  (`lib/roadmapReturn.ts`) and the roadmap, on its next mount, scrolls that node to the middle
  through the same code path as the locked-lesson redirect (`focusLessonId`). If it is the next-up
  lesson the popover opens as usual; any other lesson (a completed one) is scrolled to with no
  popover. In-app history stays [Home, lesson] (the list links used by the other lesson types and the
  sheet's Continue replace the entry), so the Back arrow's `history.back()` lands on Home; with no
  history it goes to `/`.
- **Module list**: the list of sibling lessons was built for video lessons on 2026-09-26 and removed
  the same day; doc, quiz and game lessons still show theirs.
- **Shared fixes made in the same pass**: the "Done" badge (`.lp-done`) is now cream on `--teal-d`
  (6.20:1; it was ink on `--teal`, 4.50:1), and the completion sheet has one button for all types.
- **Known limits**: the resume position of the video itself is not persisted (only accrued time is);
  Vimeo's `controls=0` hides its own chrome only on plans that allow it, and its playback could
  not be exercised in automation (the player answers `ready` but Vimeo's edge blocked headless
  playback with a 401 challenge), so the Vimeo engine is verified to the handshake only; iPhone
  Safari has no Fullscreen API for elements, so the full screen button is hidden there.
- **Verified** (Chromium against the live project, real JWTs, fixtures removed): see `changelog.md`.

**Completion is automatic (decided 2026-09-24).** There is no Finish button: once the server
says the minimum time is met, and for a video or game once the child has tapped Play (a
reading lesson: time only), the page calls the existing `fn_complete_lesson` itself, once per
visit; the server still checks enrollment, unlock and time, and the celebration sheet opens
as before. A failed call shows a single Try again button. Quizzes keep their own flow.

**Gold on screen**: the Play button before completion, the Next button after (Play is then
not gold), and the "next" row's accent. Never two gold buttons at once, except the
celebration sheet's own Next while it covers the page.

**Removed**: the overview card, breadcrumb, meta pills (type, XP, minutes, Completed), the
progress strip and bottom sheet, the sidebar with its teal header, the Up next card, the
"Step 1" label and every uppercase letter-spaced label, the old Finish / Keep learning bar
and the fixed Back to roadmap bar in replay.

**Not changed, and below the 56px target**: the quiz's own Back button and the completion
sheet's secondary link (48px), both outside this brief's scope.

Checked in real viewports (375x667 and 1280x800, viewport captures, not full-page) on a live
fixture course: no horizontal scroll, the hero starts at the bar's bottom edge, 0 uppercase
labels, no text under 16px, rows 56 to 72px, "1 of 5" then "2 of 5" (module only; the course's
sixth lesson in another module never counted), the course name absent, auto-finish opening the
sheet after Play plus the time, the Next bar pinned to the viewport's bottom at both sizes,
"Back to roadmap" on the module's last lesson, and the real Word Lab game rendering in the
desktop card. The blank game area seen before is the database's two games having placeholder
`https://example.com/...` bundle URLs: a cross-origin frame fires `load` for such a page, so it
cannot be detected as broken (`state.md`).

## Admin visual language (`/admin/*`)

Neutral shadcn default: Geist font (from shadcn's Nova preset), neutral
greys. Rationale: dense data reads better utilitarian, and admins are a
different audience than the kids using the product.

**Baloo 2 must not leak in.** It's scoped to the `.auth-page`, `.kid-app` and
`.kid-font` classes, none of which appear on admin routes, and `AdminLayout`'s
root sets `font-sans` explicitly to make that intent obvious rather than merely
inherited. Verified against the computed font of every element on three admin
pages.

**Color is functional, not decorative.** The panel stays visually quiet —
sidebar, cards and borders are neutral — and color appears only where it
carries meaning: status pills, KPI accents, the attention list.

| Token | Means |
|---|---|
| `teal` | healthy / published / active / paid |
| `gold` | draft / paused / needs review |
| `coral` | unresolved / failed / error |
| `plum` | gamification and XP surfaces |
| `ink` on near-white | body text and chrome |

Use the `-d` variants for text (`text-coral-d`, `text-gold-d`) — the base
tones are tuned for fills and fail contrast as small text on white.

**Tokens are Tailwind utilities.** `src/index.css`'s `@theme inline` block
maps each brand token to a `--color-*` entry, so `bg-gold`, `text-teal-d`,
`border-coral` all work. `inline` keeps the utility pointing at the `var()`
rather than copying the value, so `styles.css` stays the single definition
point. **Never hardcode a hex** in a component — if a utility is missing,
add the mapping instead.

### Admin CRUD conventions

Established by Courses; follow these for the next admin domain.

**Enrollment row actions** (`UserDetailPage`, Enrollments section). Each row
carries its status pill plus, contextually: **Revoke** (active rows only),
**Restore access** (revoked rows only, AND only when no active enrollment
exists for that course — a second active row is refused by the partial index,
so the button never offers something the database would reject), and **Reset
progress** (every row, whatever its status: progress outlives an enrollment, so
a revoked or expired one can still have something worth clearing). Restore and
Reset are independent — restoring never touches progress, resetting never
touches the enrollment.

- **Restore access** is a `Dialog` with two `<input type="date">` fields
  (enrollment date, defaulting to today; expiry, defaulting to the same
  *duration* the revoked row granted). Editing the start date moves the expiry
  with it until the admin edits the expiry by hand, after which their value
  stands. An empty expiry means lifetime, and the helper text says which case
  the row is in. No calendar dependency was added; a native date input is the
  right control for a desktop admin form.
- **Reset progress** is a destructive `AlertDialog` that states the real
  numbers before confirming — completed lessons (and total progress records,
  when they differ), quiz attempts, and XP to be clawed back — read from
  `fn_admin_course_progress_summary`, the same SQL the reset acts on. The
  confirm button stays disabled while those counts load, and reads "Nothing to
  reset" (still disabled) when all three are zero, so an admin never confirms a
  blank or pointless action. Both dialogs disable their submit while the
  mutation is in flight, the same double-submit guard `AwardXpForm` uses.

- **Dedicated routes for create and edit**, not modals —
  `/admin/<thing>/new` and `/admin/<thing>/$id/edit`. Both return to the list
  on success with a toast. Forms are long enough that a dialog would fight
  them.
- **One form component shared by both**, taking `mode: 'create' | 'edit'`
  plus optional `initialValues`, rather than two near-identical forms
  (`CourseForm.tsx`).
- **Row actions live in a kebab menu and are contextual to status** — the
  menu only offers transitions that are legal from the current state.
  Clicking the row itself does nothing, since several actions compete.
- **"View course" opens the student-facing page in a new tab, for every
  course whatever its status** (draft, published, archived — never hidden or
  disabled by status). It is the **first item** of each row's kebab menu (with a
  `lucide` `ExternalLink` icon) and a secondary (outline) button in the course
  editor's page header, right-aligned beside the title. Both are TanStack
  `Link`s to the typed route `/courses/$courseId` with `target="_blank"` and
  `rel="noopener noreferrer"` — a relative path, never a hardcoded host, so it
  works on localhost, over the LAN IP and in production — with
  `aria-label="View course: <title> (opens in a new tab)"`. It is a per-course
  action only: the bulk action bar has no version of it. An admin who is not
  enrolled in the course lands on the student page's "not enrolled" screen
  (`routes-permissions.md`) — accepted for now. The editor button sits in the
  page header rather than the row of lifecycle buttons because that row is
  already full at narrow admin widths: beside it, an archived course wrapped at
  720 px and pushed the tabs down (measured). In the header it adds no height at
  1400, 900 or 720 px; a very long title (132 characters tested) wraps one line
  earlier at 900 and 720 px, which moves the tabs down by that line.
- **Archive and Move to trash are both reversible; neither deletes.** A course's
  row menu offers its legal status transitions (archive is a status, undone by
  Restore) and Move to trash (see the trash-first bullet below). Neither needs a
  confirmation dialog because both can be undone; only `/admin/trash` deletes.
- **Lifecycle actions are explicit buttons, separate from "Save changes"** —
  not a status dropdown inside the form. They apply immediately; the form
  save is its own action.
- **Server-side constraint violations resolve to the field that caused
  them** (a slug uniqueness clash renders under the slug input), not a toast
  the user has to map back to an input.
- **Trigger-maintained counters are shown read-only** (`total_students`,
  `total_lessons`) and visually separated from editable fields.
- **Conditional fields are removed, not disabled** — price/currency vanish
  when a course is free; duration appears only for fixed access. A disabled
  field still reads as "something I might need to fill in".

### Course Builder (tabbed editor)

- **Tabs, with the dependent tab locked until the parent row exists.**
  `/admin/courses/new` shows Curriculum greyed out with a "Save the course
  first" tooltip — topics and lessons need a `course_id` to attach to. The
  create submit reads **"Save & continue"** and lands on
  `?tab=curriculum`, since building the curriculum is the actual next step.
- **Tab state lives in the URL** (`?tab=basics|curriculum`), so it survives a
  refresh and can be linked to. See `routes-permissions.md`.
- **Reordering is real drag-and-drop, via `@dnd-kit/core` + `@dnd-kit/sortable`
  + `@dnd-kit/utilities`.** (An earlier pass shipped up/down buttons instead
  and deferred the dependency — since corrected; buttons are gone entirely,
  not offered alongside drag.) A `GripVertical` handle at the left edge of
  each row is the *only* draggable surface — listeners live solely on the
  handle (`DragHandle` in `CurriculumTab.tsx`), never the row, so dragging
  can't conflict with clicking to rename/expand/edit/delete. Both
  `PointerSensor` (small activation distance so a click doesn't register as
  a drag start) and `KeyboardSensor` are wired — reordering must stay
  keyboard-accessible, not just mouse-draggable.
  **Topics and lessons share one `DndContext`, with one `SortableContext`
  per lesson container.** This isn't a style choice: lesson rows render
  inside topic cards, so any context spanning every topic's lessons is
  unavoidably the nearest context for the topic cards too, and dnd-kit
  resolves `useSortable` through plain React context (nearest provider
  wins). Nesting two contexts cannot separate them. What separates them
  instead is `data.type` (`'module'` / `'lesson'` / `'container'`), which a
  custom `collisionDetection` filters on so a topic drag never targets a
  lesson list. A container's own drop zone id is namespaced
  (`dropzone:<id>`) because a topic card is already registered as a
  droppable under its bare id, and one context means one id space.
  A lesson can be dragged **between** topics, and into and out of
  Ungrouped, which is a normal container rather than a special case.
  Three things this needs that a single-container list doesn't:
  - Each container registers via `useDroppable` on the container element,
    not just on its rows, or a topic with no lessons could never be dropped
    into. Ungrouped stays mounted for the duration of any lesson drag even
    when empty, since an unmounted section can't be a drop target — that's
    the only way a lesson gets out of every topic.
  - `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`.
    Moving a lesson between topics resizes both mid-drag, and dnd-kit
    otherwise measures droppables once at drag start, so every rect past the
    first resize is stale.
  - Collision detection prefers `pointerWithin` and, when the pointer is in
    a container but inside no row (the gap between rows, or the padding),
    snaps to the *nearest row in that container* rather than answering with
    the container. Answering with the container means "append to the end",
    which made the dragged row flick to the bottom of the list every time
    the pointer crossed a gap between two rows.
  The live preview during a lesson drag is a local draft array, and it is
  **pointer-only**. Keyboard drags take their coordinates from the layout,
  so reordering the list under them feeds back into the sensor and one
  ArrowDown travels two slots; keyboard drags therefore keep dnd-kit's own
  transform preview and resolve placement once, on drop. Both paths run the
  same placement function, so preview and drop can't disagree.
  On drop, every sibling whose position actually changed (not just the two
  endpoints of the drag) is recomputed and written in one `upsert` call
  seeded with full row objects — a partial `{id, position}` payload fails
  Postgres's `NOT NULL` check on the row `ON CONFLICT DO UPDATE` has to
  build, even though only the provided columns end up written.
  Two more pieces the first pass shipped without, both required for the
  drag to feel correct rather than merely functional — copy this shape for
  the next sortable list:
  - **`<DragOverlay>` renders the floating, pointer-following copy** (a
    portal, unconstrained by the list's own layout). The item actually being
    dragged (`useSortable`'s `isDragging`) skips applying its own `transform`
    and instead sits in its slot as a static, dimmed placeholder — applying
    a positional transform to it *as well as* rendering it via the overlay
    is what let it drift outside the list and overlap unrelated content
    above it. Non-dragged siblings still need their transform to animate out
    of the way.
  - **The reorder mutation carries an optimistic `onMutate`** that writes the
    new order into the query cache synchronously, before the network request
    resolves (`useModuleMutations`/`useLessonMutations` in
    `useCurriculum.ts`). Without it, `onDragEnd` firing the mutation still
    leaves the cache holding the pre-drag order for the whole round-trip —
    dnd-kit resets its drag transforms the instant the pointer is released,
    based on whatever the `items` array currently is, so the list visibly
    snaps back to the old order and then jumps again once the real data
    arrives. See `rules.md` for the "mutate on drop, not before" half of
    this — the two only work together.
- **Nested editing goes one level deep in a Dialog, not a new route.** A
  lesson opens in a centered `Dialog` (`LessonDialog.tsx`, `sm:max-w-lg` plus
  explicit `max-h-[85vh] overflow-y-auto` since base `DialogContent` has no
  built-in height cap); a quiz lesson's questions are edited *inside that
  same dialog* rather than in a third route or a dialog-over-dialog. Questions
  only appear once the lesson row exists, since they need a `lesson_id`. This
  replaced an earlier Sheet (slide-over) — swapped for consistency with the
  Dialog convention already used elsewhere (e.g. Admin Users' create/edit);
  only the container primitive changed, not the field set or submit logic.
- **Lesson timing and pass-mark settings (migration 015, enforced server-side since 017).** The
  field copy describes the intended kid-side behaviour ("Kids can tap Mark
  complete after spending this long…", "Kids must score at least this to
  pass…") exactly as specified, and the lesson engine now enforces them
  (`schema.md`, `rules.md`); no kid-side screen shows them yet. The lesson dialog gains *Minimum time on lesson*
  (`MinTimeField.tsx`: quick-pick chips Off / 30s / 1 min / 90s / 2 min / 5 min
  plus a numeric input — a chip is only a shortcut for typing its number) and,
  for quiz lessons only, *Pass mark* (whole percent). A NEW lesson pre-fills 90
  seconds (video, game and text) or 0 (quiz); switching the type re-derives the
  pre-fill only while the admin hasn't touched the field, and an existing
  lesson's saved value is never re-derived. Validation mirrors the database
  checks (0–3600 s, 1–100 %) with readable messages (`lib/lessonSettings.ts`).
  The XP reward field's helper text shows the effective XP — the lesson's own
  value, else the *course* default (blank means the course default, not a
  per-type one), and none when the course has gamification off; it is computed
  in the browser for display only. Saving a lesson requests `.select('id')` and
  treats anything but one row as an error.
  - **Row chips** (`LessonSettingChips` in `ContentTypeBadge.tsx`): a clock and
    the time ("1:30") when above 0, and "Pass 60%" for quizzes. They are plain
    spans inside a group with the type and status badges that *wraps* rather
    than forcing one line, so at narrow widths the edit and trash buttons stay
    inside the row; the drag handle and checkbox are separate siblings and are
    untouched.
  - **Bulk "Set minimum time"** (`SetMinTimeDialog.tsx`) sits in the course
    editor's bulk bar beside Move to trash. It applies to the selected
    *lessons* only (disabled, with a reason, when only topics are selected),
    says when topics are selected too, and flags quizzes in its copy without
    excluding them. One update per lesson, each required to touch exactly one
    row; the toast reads "2 updated, 1 failed" with each reason, and failed
    lessons stay selected for a retry. The dialog cannot be dismissed while it
    runs.
  - **Games:** an *Orientation* select (Any / Portrait / Landscape) in
    `GameDialog` with the helper text "Landscape games will ask kids to rotate
    their phone." — still stored only (nothing reads it; there is no game player),
    and not a column on the games list.
- **Destructive copy states the actual consequence.** Deleting a topic says
  its lessons move to Ungrouped (the FK is `SET NULL`, so they genuinely
  survive); deleting a lesson warns that its questions go with it and that
  student activity will block it outright. "Are you sure?" would be wrong in
  both directions.
- **Orphaned rows stay visible.** Lessons whose topic was deleted render in an
  explicit "Ungrouped" section rather than disappearing from the builder.
- **`content_type` badges are outlined; status badges are solid.** Both draw
  from the same four accents, so a quiz lesson in draft would otherwise put
  gold next to gold — the two badge families differ by more than hue.
  Mapping: video=teal, text=plum, quiz=gold, game=coral.

### Admin shell

`src/components/admin/AdminLayout.tsx` — persistent left sidebar + topbar
wrapping an `<Outlet />`. **Desktop-first; mobile responsiveness is explicitly
not implemented.**

- Sidebar nav is grouped (Content / Engagement / Commerce / Administration)
  and defined by the `NAV_GROUPS` array — the single place to add an item.
- Topbar shows the page title derived from the active route (exact match,
  falling back to the longest matching section prefix so deep routes still
  label correctly), the signed-in admin's `display_name`, and sign-out.
- `NavLink` still carries one `to as never` cast, but for a different reason
  than when it was added: every nav target is a real route now, yet
  `/admin/orders` and `/admin/settings` declare a required search param
  (`?view=`/`?tab=`, validated with a default), which a typed `Link` would
  force every nav entry to pass explicitly. Don't "clean up" the cast just
  because all the routes exist — it would break the typecheck.

## Component conventions

- shadcn components live in `src/components/ui/` (generated) — do not
  hand-edit generated files beyond the documented `eslint-disable` fix on
  `button.tsx`/`badge.tsx` (see `context.md` gotchas), the indeterminate-
  icon fix on `checkbox.tsx` (see the row-selection entry below), and
  correcting `import { cn } from "cn"` back to `@/lib/utils` on every file
  the Windows CLI bug generates (`popover.tsx`, `command.tsx`,
  `input-group.tsx` needed this when adding the currency combobox) — see
  `context.md`'s gotchas for the bug itself.
- Feature-specific UI is grouped by domain: `components/auth/`,
  `components/admin/` (shell only: `AdminGuard.tsx`, `AdminLayout.tsx`),
  `components/admin/users/`, `components/admin/courses/`,
  `components/admin/games/`, `components/admin/orders/`,
  `components/admin/settings/`, `components/admin/gamification/`,
  `components/admin/selection/` (the shared multi-select kit) and
  `components/admin/trash/` (the Trash page's table and dialogs).
- **Flat single-entity CRUD (no nested child content) uses a Dialog, not a
  dedicated route or wizard.** Games (`GameDialog.tsx`) follow Admin Users
  (`EditUserDialog.tsx`), not the Courses create/edit flow — a course has
  modules/lessons/quiz questions hanging off it and earns its own routed
  builder, a game is one row. Same list-table shape as `CourseTable.tsx`
  (TanStack Table v9 feature registration, client-side sort/filter/paginate,
  row actions via a `DropdownMenu`) for consistency across admin list pages,
  even though the create/edit container differs.
- **A row with real content density (multiple related sub-resources, not
  just its own fields) earns a routed detail page, not a dialog.**
  `/admin/users/$userId` (`UserDetailPage.tsx`) follows `/admin/courses/
  $courseId/edit`, not the Games/Users Dialog pattern — a user has account
  fields *plus* stats, enrollments, per-course progress, and badges, the
  same reasoning that gave Courses its own routed builder over a modal. The
  page is stacked bordered `<section>` cards (Account / Stats / Enrollments
  / Progress / Badges), not `Tabs` — unlike Course Builder's Basics/
  Curriculum split, none of these sections is large or exclusive enough to
  justify hiding the others behind a click, and an admin usually wants the
  whole picture at once. **Clicking a table row navigates to its detail
  page**; the actions cell stops click propagation
  (`onClick={(e) => e.stopPropagation()}`) so opening the row's own
  dropdown doesn't also fire the row-level navigation — see `UserTable.tsx`
  for the first instance of this pattern, worth copying rather than
  reinventing for the next list that gets a detail route.
- **The existing account-action dialogs (Edit/Change email/Reset password/
  Delete) are reused as-is from a second entry point, never re-implemented.**
  The detail page adapts its richer profile-plus-stats query down to the
  list page's `AdminUserRow` shape (`toAdminUserRow` in
  `UserDetailPage.tsx`) purely so the same dialogs can be passed the same
  prop type — none of them read `user_stats`, so this is a type-shape
  adapter, not a functional difference. This is what keeps the primary-admin
  delete guard (disabled button + tooltip) identical at both entry points
  without a second implementation to drift out of sync.
- **A permanent delete that can be blocked needs a readable reason, not a raw
  error.** A game still referenced by a lesson, a badge a student unlocked, a
  lesson with student progress, a course with enrollments — each reports what
  blocks it ("Used by 2 lessons (trashed lessons count too)"). Those checks live
  in `lib/permanentDelete.ts`, which only the Trash page imports; the count is
  looked up before the delete rather than parsed out of a constraint message.
- **A read-only record with a narrow, specific edit is still the Dialog
  convention, not a routed page.** `OrderDetailDialog.tsx` (payments) shows
  the full record read-only — including a pretty-printed `raw_payload` — and
  exposes exactly two editable fields (`reconciliation_status` and
  `reconciliation_note`; trash/restore is a separate row action, not part of
  this dialog — see `rules.md` for what an admin may change on a payment),
  mirroring Games' "flat record, one Dialog" shape. Creating a payment is its
  own dialog (`AddOrderDialog.tsx`, via `fn_create_manual_order`). The table
  row's actions are a `DropdownMenu` — View details / Move to Trash in the
  Active view, Restore / Delete Permanently in Trash. It started as a single
  `Eye` icon button, since a menu for exactly one possible action is one extra
  click for nothing; it became a `DropdownMenu` the moment a second action
  existed (the trash actions), which is the threshold to apply again.
- **A payment with no linked account (`user_id` null) is a normal state, not
  an error.** A payment can arrive before its buyer signs up (see
  `schema.md`), so `OrderTable.tsx` shows the raw `email` plus an outline
  "Unclaimed" badge, and `OrderDetailDialog.tsx` says "Unclaimed — no account
  yet" — no error styling in either.
- **Shared *logic* gets extracted into one hook; shared *presentation* with
  no logic of its own doesn't have to be.** The Dashboard's and Orders
  page's revenue KPI card call the exact same `useRevenue()` (moved to
  `usePayments.ts`) so the two pages can never independently drift on what
  "revenue" means. The small `KpiCard` box that renders it (label/value/
  pending/error) is deliberately *not* extracted into a shared component —
  it has no domain logic to drift, so a second ~15-line copy in
  `OrdersPage.tsx` is cheaper than coupling both pages' JSX to one shared
  component for a wrapper this thin. Duplication is the default; only
  extract when there's a rule (like "revenue means paid + INR-only") that
  two copies could quietly stop agreeing on.
- **All five admin list tables are TanStack Table v9** (`UserTable`,
  `CourseTable`, `GameTable`, `OrderTable`, `BadgeTable`) and
  search/filter/sort/paginate entirely client-side over one fetched list. (The
  Dashboard's "Recent activity" table also uses `useTable`, but with an empty
  feature set — it's a read-only display, so it isn't one of the list tables
  this convention describes.) `/admin/users` was the last
  plain `<table>` and was migrated; it previously filtered and paged
  server-side through PostgREST `.or()`/`.eq()`/`.range()`, which is gone. At
  account and catalog volumes bounded by real signups, a round-trip per
  keystroke buys nothing, and a client-side filter needs no debounce.
  `OrderTable` is the first with no search box at all — the task only ever
  called for status/reconciliation filters, so `globalFilteringFeature`
  wasn't wired in; add it the usual way if a search box is ever asked for.
- **A search box spanning more than one column is `globalFilteringFeature`,
  not a column filter.** `/admin/users` matches name *and* email from one
  input, which a per-column `filterFn` can't express. Two things this needs:
  `globalFilterFn: 'includesString'` on the table (the feature resolves its
  function from the `filterFns` registry and silently filters nothing when
  unset), and `enableGlobalFilter: false` on every column that shouldn't be
  scanned — otherwise typing "admin" matches all admins via the role column,
  and "2026" matches every row via the joined date. Display columns are
  excluded automatically, having no accessor.
- **Anything passed to `useTable`'s `state` must have a stable identity.**
  The filtered row model compares `columnFilters`/`globalFilter` by
  *reference*; a fresh array or object literal each render reads as "the
  filters changed" and fires the model's `autoResetPageIndex`, which snaps
  the table back to page 1. The symptom is Next appearing to do nothing
  while page-size changes still work — so a table with only one page of rows
  looks completely fine and the bug only surfaces once the data grows. Every
  admin list table memoises its filter array and `state` object; copy that,
  and don't pass an inline literal.
- **Multi-select is one shared kit, used by every admin table**
  (`components/admin/selection/`): `useTableSelection`, `SelectPageCheckbox` /
  `SelectRowCheckbox`, and `BulkActionBar` (with `TableSelectionBar`, the
  one-line table wiring). It sits on TanStack Table v9's `rowSelectionFeature`,
  which needs no row-model factory of its own — its getters read straight off
  whichever row model is registered. Every list table (Users, Courses, Games,
  Badges, Orders, and the six Trash tabs) registers the feature, and the course
  editor's topic/lesson lists use the same hook and bar without a table. No
  list of records ships without it; the read-only report tables (the
  Dashboard's recent-activity feed, the import dialog's preview and results)
  are the exception, since their rows are not records anyone can act on. What
  the kit guarantees:
  - **The page owns the state.** `useTableSelection(resetKeys)` returns a
    controlled `{ [rowId]: true }` map; the page passes it to the table as
    `selection` and reads `selection.selectedIds` for its bulk actions. The map
    persists across pagination by itself.
  - **Stable row ids.** Every table sets `getRowId` to the real id, never the
    index, so a selection survives a filter change or a refetch reordering rows
    instead of silently pointing at whatever now sits at that index.
  - **It clears when the scope changes.** `resetKeys` are the page's search and
    filter values (plus the Active/Trash view on Orders); changing any of them
    empties the selection, because a selection made under one filter says
    nothing about the rows shown under another. The reset is state adjusted
    during render, not an effect (`react-hooks/set-state-in-effect` rejects the
    effect version).
  - **The header checkbox is scoped to the current PAGE** (checked when the
    whole page is selected, indeterminate when only some of it is; clicking an
    indeterminate box selects the page, like a native indeterminate input).
    "Select all N matching" — the whole *filtered* set, across pages — is a
    button in the bar, shown when the filtered set is larger than the selection
    (`toggleAllRowsSelected(true)` reads the filtered row model).
  - **Selection state stays out of the other state slices' identity.** `state`
    composes `columnFilters`/`globalFilter` and `rowSelection` as separate
    memoised pieces, so ticking a checkbox can't regenerate the filter array and
    fire the page-reset bug above.
  - **Keyboard and screen readers.** Every checkbox has an `aria-label` ("Select
    ZZ Bulk 01", "Select all users on this page"); Space toggles. The row
    checkbox swallows click *and* key events so a table whose rows are links
    (`UserTable` navigates on row click and on Enter) doesn't navigate when a box
    is toggled — Enter must not bubble.
  - **A row can be selected even if its action would be refused** (the primary
    admin in a user selection): the bulk run reports it as a failure with the
    server's reason rather than the UI guessing ahead. Selection is dropped for
    the ids that were acted on (`removeIds`), never blanket-cleared, so a
    single-row action can't wipe an unrelated in-progress selection.
  - **Drag handles stay separate from checkboxes** in the course editor: dnd-kit's
    listeners live on the handle alone, the checkbox is its sibling, so ticking a
    box can't start a drag and a drag doesn't toggle one (selection also
    survives a drop). Reorder stays zero-animation (`rules.md`).
- **A view toggle over two disjoint row sets is a real search param
  (`?view=`), a `Tabs` control, and a cleared selection on switch** —
  `/admin/orders`'s Active/Trash toggle (migration 009) follows Course
  Builder's `?tab=` convention exactly (see `routes-permissions.md`), not a
  new pattern. Selection is cleared on every view switch because Active and
  Trash never share rows, so a selection made in one is meaningless in the
  other — done in the `Tabs`'s `onValueChange` handler directly (an
  ordinary event handler, not a `useEffect` reacting to the search param
  changing, which the `react-hooks/set-state-in-effect` rule would reject
  anyway).
  **Selection also needs manual cleanup after a row disappears from view for
  any reason** (trashed, restored, or actually deleted) — TanStack's own
  row-selection skill docs call this out explicitly: selection is
  independent state that does not clean itself up when the data it points
  at changes shape. `OrdersPage.tsx`'s `removeFromSelection(ids)` deletes
  exactly the acted-upon ids from the selection map rather than clearing it
  entirely, since the same handler backs both a bulk toolbar action (`ids`
  is the whole selection) and a single row's dropdown action (`ids` is just
  that one row, which may not even be selected) — a blanket clear would be
  wrong for the second case, wiping an unrelated in-progress selection.
  **Not every destructive-sounding action gets the same confirmation
  weight.** Move to Trash gets an ordinary confirm (reversible, but "trash"
  language still warrants a pause); Delete Permanently gets its own
  strongly-worded copy and a destructive-styled button, explicitly not
  reusing Move to Trash's copy; Restore gets no confirmation dialog at all
  — undoing a soft delete is the safe direction and the task that
  introduced this deliberately only asked for confirmation on the other two.
  A future action added to this toolbar should pick its confirmation weight
  the same way: by what a wrong click actually costs, not by copying
  whatever's nearest in the file.
- **Toolbar-owned filters, table-owned pagination.** The search input and
  role/status select live on the page and are passed down as controlled
  state; the page-size select and prev/next live in the table's own footer
  next to the row-range label. Page-size controls ship with the table from
  day one rather than being added once row counts grow.
- **Empty states distinguish "nothing here" from "nothing matched."** A list
  with zero rows and a list filtered down to zero are different problems for
  an admin, so they don't share copy — "No users yet" vs "No users match
  your search".
- Dialogs that need to reset form state on reopen: split the form into an
  inner component that mounts fresh per open (Radix unmounts dialog content
  on close), rather than a `useEffect` resetting state — the lint rule
  `react-hooks/set-state-in-effect` will reject the effect version. See
  `EditUserDialog.tsx` / `CreateUserDialog.tsx` for the pattern.
- **A handful of admin-config rows (add + toggle, no sort/filter/paginate
  need) is a plain `<ul>`, not a TanStack Table instance.**
  `ManualOrderProvidersSection.tsx` (`/admin/settings`) lists
  `manual_order_providers` as a bordered `<ul className="divide-y rounded-md
  border">` with a `<Switch>` per row toggling `is_active` — the moment this
  list needs sorting, filtering or pagination it graduates to the TanStack
  convention above, but standing up that machinery for a handful of rows
  today would be building for a scale problem that doesn't exist.
- **`/admin/settings` is `Tabs` over purpose-built sections, not a generic
  settings framework.** Three tabs — Commerce
  (`CommerceSettingsSection.tsx`: `ManualOrderProvidersSection.tsx` +
  `CurrenciesSection.tsx` + the default-currency picker), Gamification
  (`GamificationSettingsSection.tsx`), Site Identity
  (`SiteIdentitySettingsSection.tsx`) — each rendered inside its own
  `TabsContent`. This replaced an earlier, shorter-lived two-tab
  Providers | Platform split (see `changelog.md`) once Platform's seven
  fields had an actual category structure to be grouped by, rather than
  landing in one undifferentiated second tab. Adding a fourth tab later is
  one more `TabsTrigger`/`TabsContent` pair, not a registry to extend. Same
  `?tab=`-as-search-param convention as Course Builder (see
  `routes-permissions.md`).
- **Splitting one config row across multiple tabs means each tab saves its
  own slice independently, not one shared cross-tab form.**
  `useUpdateAppSettings`'s input type is a `Partial` (besides `id`)
  specifically so Gamification's form can submit just
  `quiz_pass_threshold_percent`, Site Identity's just its five fields, and
  the Commerce tab's currency picker just `default_currency` — none of them
  needs to know or carry the other tabs' current values, and `.update()`
  only ever touches the columns actually passed. This is a direct
  consequence of the earlier one-form-one-submit `PlatformSettingsSection`
  being split across tabs a user might not have both open — see
  `changelog.md`.
  **A discrete choice (the currency picker) auto-saves on selection, the
  same immediate-action feel as the `Switch` toggles in the list editors
  right above/below it in Commerce; typed fields (the quiz threshold,
  Site Identity's text inputs) keep an explicit Save button**, since typing
  a number or URL character-by-character has a meaningful "still typing"
  state that a Select's onSelect doesn't. Match this split when adding the
  next Settings field: pick the save behavior by whether partial input is
  ever a valid intermediate state, not by copying whichever field is
  nearest.
  **Initializing local form state from a query-loaded singleton row (not a
  dialog) still needs the "mount fresh" trick** — there's no open/close
  moment to reset on the way a dialog has, so the parent renders each form
  with `key={settings.id}` once the row has loaded. Since the singleton's
  `id` never changes across a refetch, this does NOT remount on every
  background refetch (which would blow away in-progress edits) — it only
  (re)mounts once, the first time real data replaces the loading state.
- **A searchable combobox (Popover + `Command`, shadcn's standard shape) is
  the pattern for any Select with too many options to scroll.** The default
  currency picker in `CommerceSettingsSection.tsx` is the first use of
  this — a plain `Select` was fine for the two-item course-currency
  dropdown, but ~180 seeded currencies need to be filterable by typing.
  `Command`'s built-in text-content filtering means `CommandItem`'s
  rendered children (code + name) double as the search index — no separate
  search-string prop needed unless the visible text and the intended match
  text diverge. Reach for this combination the next time a Select's option
  list is large enough that scrolling stops being a reasonable way to find
  an entry; a plain `Select` stays correct below that threshold (see the
  two-currency `Select` still used in `CourseForm.tsx`, deliberately not
  touched — wiring courses to this full list is a flagged follow-on, not
  done here, see `state.md`).
- **A true hard delete on a config-list row (Providers, Currencies) needs
  the live RLS policy checked, not assumed from a stale doc or a sibling
  table's shape.** Both list editors offer Delete alongside Deactivate,
  each behind its own confirm `AlertDialog` with copy specific to that
  entity (not a shared cross-entity dialog — the add-form shapes already
  differ enough, one field vs. two, that generalizing the confirm dialog
  too would be indirection for two call sites). Deleting the currency
  currently set as the platform default is expected to fail — the FK
  blocks it — and the dialog in that case deliberately stays open on that
  specific error (see `CurrenciesSection.tsx`) rather than closing, so the
  toast explaining why stays legible next to the row that caused it.
- **`/admin/gamification` stacks two sections instead of using tabs.**
  Badges (`BadgesSection.tsx`) and Level Thresholds
  (`LevelThresholdsSection.tsx`) are both real workspaces rather than small
  config forms, and an admin editing one usually wants the other in view — a
  badge's "Total XP" threshold only means something against the level curve
  below it. Settings uses `Tabs` because its sections are independent small
  forms; that's the distinguishing question for the next admin page with two
  sections, not "how many are there."
- **A condition field whose meaning depends on another field changes its
  label AND hint, not just its validation.** `BadgeDialog.tsx`'s
  `condition_value` reads "Total XP" / "Consecutive days" / "Lessons
  completed" / "Courses completed" with a matching one-line hint, driven off
  the selected `condition_type` (metadata lives beside the hook in
  `useBadges.ts`'s `CONDITION_TYPES`, so the table's "Unlocks at" column and
  the form can't drift). A bare "Condition value" over four different units
  would be a guessing game.
- **An editable numeric list keeps a per-row draft with an explicit Save,
  keyed by the saved value.** `ThresholdRow` in `LevelThresholdsSection.tsx`
  holds its own draft `useState`, and the parent keys it
  `${level}:${xp_required}`, so a successful save (list refetches, saved value
  changes) remounts the row with a fresh draft — no `useEffect` resetting
  state, which `react-hooks/set-state-in-effect` would reject. Save appears
  only when the draft differs from the saved value and is disabled while
  invalid: a half-typed number (`2` on the way to `2700`) is a real
  intermediate state, which is the same reason typed Settings fields keep a
  Save button while discrete controls auto-save. The client-side rule check
  (`validateThreshold` in `useLevelThresholds.ts`) deliberately mirrors the DB
  trigger's messages word for word — it's fast feedback in front of the
  trigger, never a replacement, and a DB rejection that slips through (a
  concurrent edit) still surfaces the trigger's own human-readable text.
  **Protect a structurally special row (level 1) in the UI with a disabled
  field and no delete affordance** rather than special-casing it in SQL —
  and record that the DB does NOT enforce it (see `rules.md`) so nobody
  assumes it does.
- **Every "delete" is "Move to trash" — immediate, with an Undo toast; only the
  Trash page deletes.** Courses, topics (modules), lessons, games and badges move
  to trash with no confirm dialog: `useTrashActions().trash([...])` runs the
  update per item, refreshes every admin query (lists, counts, the sidebar
  badge) and shows "Moved X to trash" (or "Moved N items to trash") with an
  **Undo** that restores exactly the items that moved, parents before children.
  Trashing is reversible, so the toast is the safety net, not a dialog.
  - **Users get the one exception**: a lightweight `TrashUsersDialog`, because
    trashing bans the login and signs them out. Title "Move Rahul to trash?",
    body "They will be signed out and lose access immediately. You can restore
    them any time from Trash.", buttons Cancel and **Move to trash in the default
    (not red) style**. Red is reserved for permanent deletion on the Trash page.
  - **Guards are disabled up front with a tooltip** (the primary admin, and the
    calling admin's own row) — the server still enforces them; this only saves a
    refused click. In a bulk selection those rows stay selectable and are
    reported as failures with the server's message.
  - **Partial failure is a first-class result:** "8 moved, 2 failed" with the
    first few "name — reason" lines, and Undo for the ones that did move.
  - **A write that RLS filters to zero rows returns no error**, so every trash and
    restore update asks for `.select('id')` and treats a row count other than the
    number requested as a failure — the exact bug class that made the old Delete
    buttons report success while removing nothing (`rules.md`).
  - Row-action menus say "Move to trash" (never "Delete"); no screen outside
    `/admin/trash` offers permanent deletion of a course, module, lesson, game,
    badge or user, and none calls the Edge Function `delete` action. (Payments
    keep their own older Trash view on `/admin/orders`; config-list rows —
    providers, currencies, level thresholds, quiz questions — are outside the
    trash-first set and still hard-delete with their own confirm.)
- **Column definitions must have a stable identity** (`useMemo`, with page-level
  handlers routed through `useStableCallbacks`). TanStack's `FlexRender` treats a
  column's `cell`/`header` function as a component type, so a column array
  rebuilt every render remounts every cell: an open row menu snaps shut on any
  background refetch, and a checkbox loses keyboard focus the moment its own
  toggle re-renders the table. `TrashTable` passes its row handlers through
  context instead; the other tables use the hook.
- **`/admin/trash` is the only place anything is permanently deleted.** One tab
  per entity (`?tab=courses|modules|lessons|games|badges|users`, the same
  search-param convention as Course Builder), each a full `TrashTable`
  (search, sort, pagination, the shared multi-select) showing name, "Was in"
  (parent course for a module, course › topic for a lesson, status/role
  elsewhere), Deleted at, and Deleted by (resolved to a display name — the
  Users tab looks the names up by id because a `profiles` → `profiles` embed
  resolves in the wrong direction). Rows are normalised to one `TrashRow`.
  - **Restore** is disabled with a tooltip naming the trashed parent ("Its
    course “X” is in the trash. Restore that first.") — blocked, never cascaded.
    Restoring a course or module asks first ("their modules and lessons reappear
    exactly as they were; anything trashed on its own stays trashed"); a slug
    collision (`23505`) says to rename or trash the live item using the slug.
  - **Delete permanently** is an AlertDialog with the exact count and a typed
    `DELETE`; after the run the same dialog shows the outcome (deleted / blocked
    with each item's readable reason / failed). A module's dialog quotes "N
    lessons will move to trash"; a blocked course lists what still uses it and
    offers "Archive it instead". Nothing shows a raw database error.
  - **Empty trash** (per tab) runs the same dialog over every trashed item in
    the tab and skips blocked ones, with a summary.
  - The sidebar's Trash entry carries the total count badge.
- **CSV export and import (Users).** Shared helpers live in `lib/csv.ts`:
  `toCsv(rows, columns)` (RFC 4180 quoting, CRLF, and a formula-injection
  guard — a string cell starting with `=`, `+`, `-`, `@`, TAB or CR gets one
  leading `'`; real numbers are exempt), `download(filename, csv)` (prepends a
  UTF-8 BOM), `parseCsvTable(text)` (papaparse: BOM strip, delimiter
  auto-detect, blank lines skipped, an unclosed quote is fatal) and
  `stripFormulaGuard` (undoes the guard so an exported file re-imports as it
  was). The Orders export/import still uses the original hand-written helpers
  (`parseCsv`, `stringifyCsv`, `downloadTextFile`), which have no BOM and no
  guard.
  - **Export** — an Export menu in the Users header: *Selected rows* (disabled
    with nothing selected), *Current filtered results* (every page of the
    current search + role filter, in the table's sort order) and *All users*,
    plus an *Include trashed users* toggle (off by default; it has no effect on
    *Selected rows*, since a trashed user can't be ticked in the list).
    *Export selected* is repeated in the bulk bar. Columns: `id, display_name,
    email, role, xp, level, phone_number, created_at, status` (`active` or
    `trashed`); `xp` and `level` are blank for a user with no `user_stats` row.
    No password or hash is ever exported. The file is
    `wisdom-hatch-users-YYYY-MM-DD.csv` (the admin's local date) and a toast
    reports the count ("Exported N users"). "All users" and the trashed part of
    a filtered export come from `fetchUsers(scope)` in `useUsers.ts`, which
    pages in batches of 1000 and also backs the list itself.
  - **Import** — the Import button opens `ImportUsersDialog`
    (`components/admin/users/import/`), four views. (1) A Download template
    link (`display_name, email, phone_number, password` plus two example rows)
    and a drop zone: .csv only, ≤ 2 MB, ≤ 1000 rows, each refused with its own
    message. (2) A preview, one line per row: Valid, Error with its reason,
    "Already exists, will be skipped", or "In trash, restore that user
    instead"; the password column says only "Provided" or "Auto-generate",
    never the value; unknown columns are listed in a warning, and a `role`
    column is one of them — everything imported is a student. "Row" is the
    position among non-blank rows (header = 1). (3) *Import N valid rows* sends
    chunks of 25 to `bulk_create` one after another, with a progress bar
    ("Batch i of n"), a Stop that halts after the chunk in flight, and retry
    with backoff (1 s, 2 s, 4 s) on 429, 502/503/504 and network errors; a
    request unanswered for 60 s is abandoned and retried. The dialog cannot be
    closed while running (no X or Cancel; Escape is ignored — exercised; outside
    clicks and closing the tab are also guarded in code but were not exercised). A chunk that still can't be delivered ends the run: its rows are
    failed and the rest are "Not imported". (4) A summary: created / skipped /
    failed (plus Not imported), a table of every row that needs attention, and
    *Download results CSV* (`email, status, reason, generated_password`), built
    in memory on click. When the server generated passwords the summary warns
    that the file holds credentials that cannot be regenerated, and closing
    without downloading asks first. The dialog drops its rows and any
    passwords about 300 ms after it closes.
  - A **"Needs attention"** row is not a failure but did not go cleanly: the
    phone number could not be saved, or a retried chunk found its accounts
    already created (the unheard first reply may have carried their generated
    passwords — reset the password from the user's actions).
- Installed shadcn components: button, table, dialog, alert-dialog,
  dropdown-menu, input, label, select, badge, skeleton, avatar, tooltip,
  sonner, switch, checkbox, tabs (used since Course Builder, missing from
  this list until now — corrected, not a new install), popover, command,
  input-group (pulled in by `command`, not imported directly), textarea, sheet
  (generated, currently unused by any page or component), and progress (used by
  the import dialog; written by hand in the shadcn shape from `radix-ui`'s
  Progress rather than with `shadcn add`, to avoid the CLI's Windows path bug
  described in `context.md`).
  The generated `checkbox.tsx` unconditionally
  rendered `CheckIcon` for every checked state — hand-patched to swap in
  `MinusIcon` when `checked === "indeterminate"`, since a bulk-selection
  header checkbox needs the two states to actually look different (see the
  row-selection entry above). Documented here because it's a hand-edit to a
  generated file, same disclosure obligation as `button.tsx`/`badge.tsx` in
  `context.md`'s gotchas.

## Testing on a real phone over Wi-Fi

1. Run the dev server so it listens on the network: `npm run dev -- --host`
   (Vite prints a `Network:` URL such as `http://192.168.x.x:5173`).
2. Put the phone on the **same Wi-Fi** as the computer and open that URL in the
   phone's browser.
3. If the page never loads, the computer's firewall is the usual cause: allow
   Node.js through Windows Defender Firewall for **Private** networks (or allow
   inbound TCP 5173).
4. **It is `http`, not `https`, so the page is an insecure context.** Sign-in,
   the roadmap, the admin screens and Supabase calls all work (verified in
   desktop Chromium against the LAN IP, `window.isSecureContext === false`), but
   browsers withhold secure-context-only APIs there: `crypto.randomUUID`,
   `crypto.subtle`, clipboard, camera/microphone, share, notifications and
   service workers. Code must not depend on them without a fallback (`rules.md`,
   `uuid()` in `src/lib/uuid.ts`). Anything that genuinely needs one — a future
   camera or push feature — can only be tested on `localhost` or over HTTPS.
5. `localhost` on the phone means the phone itself; always use the computer's
   LAN IP. Not yet exercised: a real phone, the Capacitor webview and iOS Safari.

### Lesson page layout: hero, course path, overview (2026-09-24)

`LessonPlayerShell` now frames every lesson type in a page laid out from
`docs/reference/lms.html` (the mock; visuals only, none of its code, CSS or content
copied). Top to bottom: `LessonHero`, then a two-column `.lp-layout` (from lg: a sticky
252px `CoursePathSidebar` beside `.lp-main`; below lg: one column with a
`CoursePathStrip` at its top), and in `.lp-main`: the offline strip, the strip,
`LessonOverviewCard`, a "Step 1" label over the lesson itself, `UpNextCard` and the bottom
bar. The top bar (title, time ring) and every rule of the player are unchanged.

- **Hero**: a cream-to-gold wash (`color-mix` of `--gold` into `--cream`) with a curved cream
  bottom edge, a plum-tint episode eyebrow ("Episode X of N", from `fn_course_lesson_states`, so
  published lessons only), the lesson title (`clamp(1.75rem, 6.5vw, 3.25rem)`) and the course
  name. It bleeds to the screen edges on phones and is a 26px card from md. Lanterns and
  squiggles show from md up only; nothing moves (no parallax). No age band: the schema has none.
- **Course path**: one data component, `CoursePathList`, used by both. Below lg the strip (a teal
  conic-gradient ring plus "X of N episodes") opens a bottom `Sheet` (rendered outside `.kid-app`,
  so its content carries `.kid-font`); from lg the sidebar has a solid `--teal` header. The active row
  is a teal tint with a `--teal-d` outline and a teal number tile; locked rows are muted and inert;
  completed rows show a check. State is never colour alone (a check, a lock or the number, plus a
  spoken state word). Titles come from `useCourseRoadmap` (shared with the course page); counts and
  the episode number come from the states, so they show before titles load.
- **Overview card**: breadcrumb (course, Episode N), the heading "About this episode" (the lesson
  title is already the hero title), the lesson's `summary` and pills: episode X of N (plum), lesson
  type (teal), `+N XP` while it can still be earned (plum, coral sparkle), about N min while playing,
  and a teal "Completed" pill in replay. The old chip row under the top bar is gone.
- **Step label**: a short teal bar and "Step 1 · Watch / Read / Play / Take" by lesson type. A lesson
  is exactly one type, so there is never a "Step 2".
- **Video card**: `.lp-video-card`, a 6px `--surface` border, 26px radius, a large soft shadow and a
  `--teal-d` frame. The play button on it stays gold (the one main action there).
- **Up next**: a dashed card with a gold accent (border tint, icon tile) and a status pill; it links
  only when the engine already shows that lesson open. Hidden while a quiz is being played (the quiz
  owns its own sticky bar and a card after it would sit under it).
- **Gold**: hero wash and lanterns, the Up next accent, the primary button and the video play button.
  Everything else is teal or plum. Framer Motion `Reveal` rises blocks once on scroll and renders a
  plain element under `useReducedMotion`.
- **Not built**: the mock's "Step 2, Activity" game card. A game is its own lesson type here (the
  player's Play card), so no lesson has a video plus a linked game to offer, and the launch modal is
  out of scope.

Checked at 390px and 1280px in Chromium against the live project: no horizontal scroll, sidebar only at
1280 and strip only at 390, the sheet lists the episodes.
