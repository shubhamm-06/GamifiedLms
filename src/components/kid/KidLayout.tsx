import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { LG_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { registerPushNotifications } from '@/lib/pushNotifications'
import { useSettings } from '@/hooks/useSettings'
import { KidHeaderContext } from './kidHeader'
import { KidNav } from './KidNav'
import { KidSidebar } from './KidSidebar'
import { OfflineBanner } from './OfflineBanner'
import { tabForPath } from './kidTabs'

/**
 * Shell for every kid-facing (student) route: a sticky top bar — Back, the
 * page title (truncated), safe-area padding — over a scrolling page on the
 * cream background. Document scroll, not an inner scroller, so iOS momentum and
 * the sticky roadmap banners behave. On the four top-level screens (Home, Badges,
 * Courses, Profile) it also shows the bottom nav (`KidNav`) and reports its height
 * through `--kid-bottom-inset` (`data-nav`, kid.css), so the page never sits under it.
 * On Home (`data-home`) the bar's row collapses, leaving only the safe-area padding: Home's own
 * stat bar is the first thing on screen and everything sticky measures from what remains.
 */
export function KidLayout({ children }: { children?: ReactNode }) {
  const router = useRouter()
  // Subscribing here re-renders the student screens when the settings change (copy that reads
  // the terminology through `getTerms()` then shows the new words without a reload).
  useSettings()
  // The four nav destinations are top level: no Back arrow (it would only leave the app),
  // and the bottom nav (a sidebar from 1024px) is shown.
  const tab = useRouterState({ select: (st) => tabForPath(st.location.pathname) })
  // From 1024px the four screens get a left sidebar instead of the bottom nav (mounted, not
  // just hidden, so the hidden one is neither focusable nor announced). Read synchronously.
  const desktop = useMediaQuery(LG_UP)
  // A lesson page draws its own slim bar inside its column (LessonLayout), so this one keeps only its safe-area padding.
  const lesson = useRouterState({ select: (st) => /^\/courses\/[^/]+\/lessons\/[^/]+\/?$/.test(st.location.pathname) })
  const side = !!tab && desktop
  const [title, setTitle] = useState('')
  const [fallbackPath, setFallbackPath] = useState('/')
  const [rightSlot, setRightSlot] = useState<HTMLElement | null>(null)
  const value = useMemo(
    () => ({ title, setTitle, fallbackPath, setFallbackPath, rightSlot, setRightSlot }),
    [title, fallbackPath, rightSlot],
  )

  function goBack() {
    // A deep link (opened by URL, or the app's first screen) has no in-app
    // history to go back to; the router's own index knows, window.history doesn't.
    if (router.history.canGoBack()) router.history.back()
    else router.history.push(fallbackPath)
  }

  // Once per mount of the student shell: covers both "just logged in" (this
  // layout mounts fresh on the redirect in) and "app started with an
  // existing session" (a direct load of a kid route). Native only, no-op on
  // web, best-effort inside (never throws here).
  useEffect(() => {
    void registerPushNotifications()
  }, [])

  return (
    <KidHeaderContext.Provider value={value}>
      <div
        className="kid-app"
        data-nav={tab ? 'true' : undefined}
        data-home={tab?.to === '/' ? 'true' : undefined}
        data-lesson={lesson ? 'true' : undefined}
        data-shell={side ? 'side' : undefined}
        data-own-header={side && tab?.ownsDesktopHeader ? 'true' : undefined}
      >
        {/* First in the DOM so keyboard order is sidebar, then the page; it is fixed-position, so this moves nothing on screen. */}
        {tab && side ? <KidSidebar activeTo={tab.to} /> : null}
        <header className="kid-topbar">
          <div className="kid-topbar-row">
            {tab ? (
              <span className="kid-back-spacer" aria-hidden="true" />
            ) : (
              <button type="button" className="kid-back kid-tap" onClick={goBack} aria-label="Back">
                <ArrowLeft className="size-6" aria-hidden />
              </button>
            )}
            <p className="kid-topbar-title" data-testid="kid-title">
              {title}
            </p>
            <div className="kid-topbar-right" ref={setRightSlot} />
          </div>
        </header>
        <main className="kid-main">{children ?? <Outlet />}</main>
        {tab && !side ? <KidNav activeTo={tab.to} /> : null}
        <OfflineBanner />
      </div>
    </KidHeaderContext.Provider>
  )
}
