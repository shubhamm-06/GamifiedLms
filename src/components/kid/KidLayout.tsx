import { useMemo, useState, type ReactNode } from 'react'
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { KidHeaderContext } from './kidHeader'
import { KidNav } from './KidNav'
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
  // The four nav destinations are top level: no Back arrow (it would only leave the app),
  // and the bottom nav is shown.
  const tab = useRouterState({ select: (st) => tabForPath(st.location.pathname) })
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

  return (
    <KidHeaderContext.Provider value={value}>
      <div className="kid-app" data-nav={tab ? 'true' : undefined} data-home={tab?.to === '/' ? 'true' : undefined}>
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
        {tab ? <KidNav activeTo={tab.to} /> : null}
      </div>
    </KidHeaderContext.Provider>
  )
}
