/**
 * Android hardware Back (Capacitor `App` "backButton"), the pure parts: the
 * overlay registry, the leave-guard registry, and the priority decision. The
 * native listener lives in `components/native/AndroidBackButton.tsx`; nothing
 * here touches Capacitor, so it is inert on the web.
 *
 * Overlay registry: every overlay a child can open (popover, sheet, dialog,
 * fullscreen video, the avatar builder, the collapsible Account section)
 * registers a close handler while it is open (`useBackClosable`). Back closes the
 * MOST RECENTLY OPENED one first and does nothing else on that press.
 *
 * Leave guards: a quiz with at least one answer locked in and not yet graded,
 * and a game lesson in play, register a guard (`useLeaveGuard`). Back on such a
 * screen asks "Leave this lesson?" instead of leaving.
 */

type Entry = { id: number; close: () => void }

let nextId = 1
const overlays: Entry[] = []
const guards = new Set<number>()

/** Registers an open overlay's close handler; returns the unregister function. */
export function pushOverlay(close: () => void): () => void {
  const entry = { id: nextId++, close }
  overlays.push(entry)
  return () => {
    const i = overlays.findIndex((e) => e.id === entry.id)
    if (i >= 0) overlays.splice(i, 1)
  }
}

export function hasOverlay(): boolean {
  return overlays.length > 0
}

/** Closes the top overlay. Its own close normally unregisters it (the effect cleanup); it is removed here too so one press never closes two. */
export function closeTopOverlay(): boolean {
  const top = overlays.pop()
  if (!top) return false
  top.close()
  return true
}

export function addLeaveGuard(): () => void {
  const id = nextId++
  guards.add(id)
  return () => guards.delete(id)
}

export function hasLeaveGuard(): boolean {
  return guards.size > 0
}

/** The four bottom-nav destinations. */
const KID_TABS = new Set(['/', '/badges', '/courses', '/profile'])
/** Where Back offers "press again to exit" instead of navigating. */
const EXIT_ROOTS = new Set(['/', '/login', '/signup', '/admin'])

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

/** Where Back goes when there is no in-app history: one level up, never a loop. */
export function fallbackFor(pathname: string): string {
  const p = normalize(pathname)
  const lesson = /^\/courses\/([^/]+)\/lessons\/[^/]+$/.exec(p)
  if (lesson) return `/courses/${lesson[1]}`
  if (isAdminPath(p)) return '/admin'
  return '/'
}

export type BackAction =
  | { kind: 'close-overlay' }
  | { kind: 'confirm-leave' }
  | { kind: 'home' }
  | { kind: 'exit' }
  | { kind: 'arm-exit' }
  | { kind: 'back' }
  | { kind: 'navigate'; to: string }

export interface BackInput {
  pathname: string
  hasOverlay: boolean
  hasLeaveGuard: boolean
  canGoBack: boolean
  /** A first Back on an exit root was pressed less than the window ago. */
  exitArmed: boolean
}

/**
 * The priority order (docs/ui.md):
 * 1. an open overlay closes (everywhere, admin included: the app never exits under an open overlay);
 * 2. a guarded lesson (quiz in progress, game) asks to confirm (kid only);
 * 3. a bottom-nav tab other than Home goes to Home;
 * 4. Home, login, signup and the admin dashboard: press again to exit;
 * 5. otherwise history back, or one level up when there is none.
 */
export function decideBackAction(input: BackInput): BackAction {
  const p = normalize(input.pathname)
  const admin = isAdminPath(p)
  if (input.hasOverlay) return { kind: 'close-overlay' }
  if (!admin && input.hasLeaveGuard) return { kind: 'confirm-leave' }
  if (!admin && KID_TABS.has(p) && p !== '/') return { kind: 'home' }
  if (EXIT_ROOTS.has(p)) return input.exitArmed ? { kind: 'exit' } : { kind: 'arm-exit' }
  if (input.canGoBack) return { kind: 'back' }
  return { kind: 'navigate', to: fallbackFor(p) }
}

/** How long the second press has to exit. */
export const EXIT_WINDOW_MS = 2000
