import { useMemo, useState, type ReactNode } from 'react'
import { Outlet, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { KidHeaderContext } from './kidHeader'

/**
 * Shell for every kid-facing (student) route: a sticky top bar — Back, the
 * page title (truncated), safe-area padding — over a scrolling page on the
 * cream background. Document scroll, not an inner scroller, so iOS momentum and
 * the sticky roadmap banners behave. `--kid-bottom-inset` (kid.css, default 0)
 * is where a future bottom tab bar reports its height; nothing here builds one.
 */
export function KidLayout({ children }: { children?: ReactNode }) {
  const router = useRouter()
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
      <div className="kid-app">
        <header className="kid-topbar">
          <div className="kid-topbar-row">
            <button type="button" className="kid-back kid-tap" onClick={goBack} aria-label="Back">
              <ArrowLeft className="size-6" aria-hidden />
            </button>
            <p className="kid-topbar-title" data-testid="kid-title">
              {title}
            </p>
            <div className="kid-topbar-right" ref={setRightSlot} />
          </div>
        </header>
        <main className="kid-main">{children ?? <Outlet />}</main>
      </div>
    </KidHeaderContext.Provider>
  )
}
