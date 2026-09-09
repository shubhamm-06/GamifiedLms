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

### Admin shell

`src/components/admin/AdminLayout.tsx` — persistent left sidebar + topbar
wrapping an `<Outlet />`. **Desktop-first; mobile responsiveness is explicitly
not implemented.**

- Sidebar nav is grouped (Content / Engagement / Commerce / Administration)
  and defined by the `NAV_GROUPS` array — the single place to add an item.
- Topbar shows the page title derived from the active route (exact match,
  falling back to the longest matching section prefix so deep routes still
  label correctly), the signed-in admin's `display_name`, and sign-out.
- `NavLink` carries one `to as never` cast because most nav targets aren't in
  the typed route tree yet; drop it as real routes land.

## Component conventions

- shadcn components live in `src/components/ui/` (generated) — do not
  hand-edit generated files beyond the documented `eslint-disable` fix on
  `button.tsx`/`badge.tsx` (see `context.md` gotchas).
- Feature-specific UI is grouped by domain: `components/auth/`,
  `components/admin/`, `components/admin/users/`.
- Dialogs that need to reset form state on reopen: split the form into an
  inner component that mounts fresh per open (Radix unmounts dialog content
  on close), rather than a `useEffect` resetting state — the lint rule
  `react-hooks/set-state-in-effect` will reject the effect version. See
  `EditUserDialog.tsx` / `CreateUserDialog.tsx` for the pattern.
- Installed shadcn components: button, table, dialog, alert-dialog,
  dropdown-menu, input, label, select, badge, skeleton, avatar, tooltip,
  sonner.
