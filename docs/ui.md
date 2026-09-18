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
  scoped to the `.auth-page` wrapper class only — does not override the
  app's global sans (Geist) elsewhere.
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
via shared `AuthCard`/`AuthField` in `src/components/auth/`. Not applied
anywhere else — the (future) student experience should probably use this,
the admin section deliberately does not.

## Admin visual language (`/admin/*`)

Neutral shadcn default: Geist font (from shadcn's Nova preset), neutral
greys. Rationale: dense data reads better utilitarian, and admins are a
different audience than the kids using the product.

**Baloo 2 must not leak in.** It's scoped to the `.auth-page` class, and
`AdminLayout`'s root sets `font-sans` explicitly to make that intent obvious
rather than merely inherited.

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
- **Archive, never delete.** No hard-delete affordance exists anywhere in the
  admin UI for courses — see `rules.md` for why. Archive needs no
  confirmation dialog because Restore reverses it.
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
  `components/admin/settings/`, `components/admin/gamification/`.
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
- **A hard delete (no archive/status column) that can be FK-blocked needs a
  friendly count, not a raw error.** Games can be deleted outright — unlike
  courses, which are archived because deleting cascades silently — but a
  game still referenced by a lesson must fail with "used by N lesson(s)",
  not a Postgres constraint message. The count is a second query run only on
  the FK-violation path (`useDeleteGame` in `useGames.ts`), not fetched
  up front, since the common case never needs it.
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
- **Bulk row selection: `rowSelectionFeature`, a checkbox column, and
  controlled `state.rowSelection` lifted to the page** — `OrderTable.tsx` is
  the first table with this. `rowSelectionFeature` needs no row-model factory
  of its own; its "select all"/"is all selected" getters read straight off
  whichever row model is already registered (`getFilteredRowModel()` here,
  since this table has no grouping/expansion) — this is what makes
  `table.toggleAllRowsSelected()` naturally scope to the *currently filtered*
  rows, not the full unfiltered list, with zero extra wiring. Selection
  state is a plain `{[id]: true}` map, so `getRowId: (payment) => payment.id`
  is required — the default index-into-`data` id would make a selected set
  point at the wrong rows the moment a filter or refetch reorders `data`.
  Because ids are real payment ids, the page can turn `rowSelection` back
  into actual rows (`payments.filter(p => rowSelection[p.id])`) without
  reaching into the table instance at all — only the checkbox cells
  themselves (header + per-row) need `table`/`row`, and both live inside
  `OrderTable`. Two things worth copying, one easy to get backwards:
  - **Indeterminate must be scoped to the filtered set, not
    `table.getIsSomeRowsSelected()`** — that getter counts selected ids
    table-wide regardless of the active filter, so it reads "some selected"
    even when every selected row is currently filtered out of view. Use
    `table.getFilteredSelectedRowModel().rows.length > 0` instead.
  - **Clicking an indeterminate checkbox selects everything, it does not
    clear the selection** — same as a native indeterminate `<input>`; the
    visual "indeterminate" is a rendering hint only, and the underlying
    value it resolves to on click is `true`. Design around this rather than
    assuming a single click round-trips indeterminate back to empty.
  Selection state itself must stay out of the memoised `state` object's
  other fields' dependency arrays (see the stable-identity rule above) —
  toggling a checkbox must not regenerate `columnFilters`'s array reference,
  or it fires the same page-reset bug this file already warns about, just
  via a different field.
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
- Installed shadcn components: button, table, dialog, alert-dialog,
  dropdown-menu, input, label, select, badge, skeleton, avatar, tooltip,
  sonner, switch, checkbox, tabs (used since Course Builder, missing from
  this list until now — corrected, not a new install), popover, command,
  input-group (pulled in by `command`, not imported directly), textarea, and
  sheet (generated, currently unused by any page or component).
  The generated `checkbox.tsx` unconditionally
  rendered `CheckIcon` for every checked state — hand-patched to swap in
  `MinusIcon` when `checked === "indeterminate"`, since a bulk-selection
  header checkbox needs the two states to actually look different (see the
  row-selection entry above). Documented here because it's a hand-edit to a
  generated file, same disclosure obligation as `button.tsx`/`badge.tsx` in
  `context.md`'s gotchas.
