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
  app's global sans (Geist) on admin routes.
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
bar, full width on phones, and names whichever module is in view. It is scroll-spy
(`useModuleSpy`): every lesson row carries `data-module-key`, and the active module owns the
topmost row whose centre is below a reading line 40% of the way down the visible area under
the stuck bar (so the last module also gets its turn on a page that cannot scroll further).
Cream text on `--teal-d` for a module a child can work in (changed 2026-09-26 from ink on
`--teal`, 4.50:1: cream on plain `--teal` would have been 2.88:1, so the fill was darkened
rather than only the text lightened); a dimmer neutral with a lock icon when every lesson in it
is locked. It is flat, not a control, and never gold: gold stays
with the next-up node and its popover. It announces changes politely (`aria-live`). Where the
path crosses into a module, an inline divider marks it (next paragraphs).

**Continue bar.** Removed on 2026-09-26 (the next step now opens itself, see above); the bottom
nav took over the bottom edge on 2026-09-26.

**Bottom nav** (`KidNav`, `.kid-nav`, `kidTabs.ts`; 2026-09-26). Four tabs in order: Home
(`/`), Badges (`/badges`), Courses (`/courses`), Profile (`/profile`), lucide icons House,
Award, BookOpen, User. Shown only on those four routes (`tabForPath`); the lesson player and the
`/courses/$courseId` deep link keep their own bottom edge and get no nav. Fixed to the viewport
bottom, `--surface` with a hairline top border, `z-index` 35 (above the popover 15 and module bar
20, below the top bar 40). Content height `--kid-nav-h` (4.25rem); the safe-area inset is added in
the bar's own bottom padding via `env(safe-area-inset-bottom, 0px)`, so the home indicator never
covers a tab, and `.kid-app[data-nav]` sets `--kid-bottom-inset` to `--kid-nav-h` so `.kid-main`'s
bottom padding clears it. Active tab: ink icon and label with a soft teal pill
(`color-mix(teal 26%, surface)`, 26px radius) behind the icon, `aria-current="page"`; inactive:
`--kid-muted-fg`. Gold is not used (it stays "the next action"). Tapping the active tab is a no-op:
`preventDefault` on the link, so no navigation, no remount, no scroll change, and an open lesson
popover stays open (the roadmap's outside-tap handler ignores `.kid-nav`). The lesson popover
also treats the nav's top edge as the bottom of the viewport when deciding whether to flip
above its node.

**Courses, Badges, Profile** (`KidCoursesPage`, `KidBadgesPage`, `KidProfilePage`). Courses is the
course switcher: one `kid-card` button per active enrollment in a live, published course (title,
thumbnail or a book icon, a progress bar, "N of M lessons"), most recently used first; progress
comes from `fn_course_lesson_states` (published lessons only) under the roadmap's own query key;
tapping a row calls `fn_touch_enrollment`, seeds the Home query with that course, and goes Home.
Zero courses reuses `NoCoursesScreen`. Badges: a two-column grid (three from 640px) of every
active badge, earned ones with a coral medallion and "Earned", the rest muted with a lock and "Not
yet", plus "N of M earned"; no animation. Profile: initial or avatar, name, Level, XP and Day
streak cards, and a quiet Log out button (signs out, clears the query cache, goes to `/login`).
**Badges and Profile are intentionally minimal and need a real design pass.**

**Module divider** (`ModuleDivider`, `.rm-divider`, 2026-09-26). Before the first node of every
module after the first: a short rule, the module's name (`section.title`, the same text as the
sticky module bar, up to two lines), a second short rule, on the cream page background in muted ink
(`--kid-muted-fg`, 5.46:1; the rules are decorative). Fixed height `--rm-div-h` (6.5rem), which
`PathDecor` counts (`breaks`, `--d`) so the background shapes stay aligned with the rows; it
covers the connector for its height, which reads as a break in the road. Not interactive:
`pointer-events: none`, no tab stop, `role="separator"` with an `aria-label`. It appears at every
boundary, including before a module that is still fully locked.

**Stat bar** (`StatBar`, `.kid-statbar`; Home only, 2026-09-26). A slim 3rem row, sticky directly
under the kid top bar and above the module bar, full-bleed on the cream page with a hairline bottom
border. Left: two `--surface` pills with the inset ring the XP chips use, a flame (`--coral-d`) with
the current streak and a spark (`--plum-d`) with lifetime XP (`user_stats.total_xp`, never
level-relative), ink numbers at weight 500; gold is not used. Right: the course name as a link to
`/courses`, deliberately not a pill: `--teal-d` text (6.2:1), bold, underlined, with a chevron,
truncated with an ellipsis, a 44px tall hit target. Numbers come from `useKidProfile` (the Profile
screen's query; no second fetch of `user_stats`); a student with no stats row shows 0 and 0, and a
dash stands in only while loading or on error. The course name is read from the roadmap's own cached
content query (`useQuery` with `enabled: false`, never fetches) for the `fn_home_course` id; the
link is absent while there is no course. The top bar's title is empty on Home (the course name
lives here instead; `CourseRoadmapView`'s `showTitle` is false), and the `/courses/$courseId` deep
link is unchanged: title, no stat bar. **Sticky stack:** `.kid-home` sets `--kid-top-inset` to
`--kid-statbar-h`, the module bar's `top` adds it (default `0px` off Home, same pattern as
`--kid-bottom-inset`), and scroll-spy and the popover measure the stack through
`lib/stickyTop.ts` (`stickyTopEdge`: the lower of the top bar's and stat bar's bottom edges) instead
of hardcoding anything. Gems and hearts/energy are still deferred, with no placeholders.

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
that can meet a notch or home indicator pads with `env(safe-area-inset-*)`;
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
insets, the native back button, and a physical screen reader (only programmatic
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

### Quiz: one grade, then a per-question review

`fn_submit_quiz` still grades the whole quiz in one call once every question is
answered, and still never returns the correct option or (until migration 020 is
approved) an explanation, unchanged by this redesign and required by
`rules.md`. What changed is what happens with that one reply: instead of a
single results list, `QuizLesson` walks the child back through each question
one more time (`phase: 'review'`), showing:
- **unanswered**: `--kid-line-base` border, letter badge.
- **selected** (before grading): `--plum` border (3px, reserved from the start
  as an inset shadow so picking never shifts the layout), plum-tinted
  background, cream-on-plum letter badge, a check.
- **graded, chosen, correct**: teal tint, `--teal-d` border, badge becomes a
  check.
- **graded, chosen, wrong**: coral tint, `--coral-d` border, a 0.4s shake, badge
  becomes a cross.
- **graded, not chosen**: dimmed to 60% opacity, not tappable.

**The correct option is never marked on an option the child did not choose,
in review or anywhere**: the server does not send which option that is,
before or after grading (`rules.md`'s "quiz answers never leave the server").
This is a deliberate, security-preserving reading of the spec's per-question
reveal, not a shortcut: showing it would need either the server to reveal the
answer key (an invariant change, not something this task's UI pass can grant
itself) or the client to know it independently (exactly the client-trust hole
`rules.md` exists to close). A completion this review unlocks (quiz passed,
minimum time already met) waits until the review is finished before opening
the completion sheet. An early pass opened it mid-review; fixed before commit.

Results screen: never a percentage, always "X of Y". Passed: a teal check
badge, "You did it!". Failed: "So close!", the pass mark in words ("You need 2
of 2 to pass"), a candy Try again and a secondary Back to roadmap link.
Replay's practice attempt: "Practice round", the score, no pass/fail language,
no XP. Step dots (`--plum`, quiz identity only) replace a question counter as
the primary progress cue; the score never shows mid-quiz.

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
rotate hint still never locks the orientation.

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
