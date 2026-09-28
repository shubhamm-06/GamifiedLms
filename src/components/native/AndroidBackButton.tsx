import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useBackClosable } from '@/hooks/useBackClosable'
import {
  EXIT_WINDOW_MS,
  closeTopOverlay,
  decideBackAction,
  fallbackFor,
  hasLeaveGuard,
  hasOverlay,
} from '@/lib/backButton'
import { router } from '@/router'

/**
 * Safety net for overlays that were never wired into the registry (admin
 * dialogs, dropdown menus, selects, tooltips): any open Radix layer closes the
 * same way its own Escape key does. Returns whether it found one.
 */
function closeUnregisteredRadixLayer(): boolean {
  const open = document.querySelector(
    '[data-radix-popper-content-wrapper], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
  )
  if (!open) return false
  const target = document.activeElement ?? document.body
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
  return true
}

function goBackOrUp(pathname: string) {
  if (router.history.canGoBack()) router.history.back()
  else router.history.replace(fallbackFor(pathname))
}

/**
 * Android hardware Back, mounted once at the app root. Native only: on the web
 * it registers nothing and renders nothing, so browser Back is untouched. The
 * decision itself is `decideBackAction` (lib/backButton.ts); this component only
 * carries it out, owns the "Leave this lesson?" dialog and the exit window.
 */
export function AndroidBackButton() {
  const [confirming, setConfirming] = useState(false)
  const exitArmedUntil = useRef(0)
  const native = Capacitor.isNativePlatform()

  useBackClosable(confirming, () => setConfirming(false))

  useEffect(() => {
    if (!native) return
    const handle = App.addListener('backButton', () => {
      const pathname = router.state.location.pathname
      const action = decideBackAction({
        pathname,
        hasOverlay: hasOverlay(),
        hasLeaveGuard: hasLeaveGuard(),
        canGoBack: router.history.canGoBack(),
        exitArmed: Date.now() < exitArmedUntil.current,
      })
      // An unregistered open layer counts as an overlay too: never leave the app under one.
      if (action.kind !== 'close-overlay' && closeUnregisteredRadixLayer()) return
      switch (action.kind) {
        case 'close-overlay':
          closeTopOverlay()
          return
        case 'confirm-leave':
          setConfirming(true)
          return
        case 'home':
          void router.navigate({ to: '/', replace: true })
          return
        case 'arm-exit':
          exitArmedUntil.current = Date.now() + EXIT_WINDOW_MS
          toast('Press back again to exit', { id: 'back-exit', duration: EXIT_WINDOW_MS, className: 'kid-font' })
          return
        case 'exit':
          exitArmedUntil.current = 0
          toast.dismiss('back-exit')
          void App.exitApp()
          return
        case 'back':
          router.history.back()
          return
        case 'navigate':
          router.history.replace(action.to)
          return
      }
    })
    return () => {
      void handle.then((h) => h.remove())
    }
  }, [native])

  if (!native) return null

  function leave() {
    setConfirming(false)
    goBackOrUp(router.state.location.pathname)
  }

  return (
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <DialogContent
        showCloseButton={false}
        className="kid-card kid-font max-w-[calc(100%-2rem)] gap-0 rounded-[26px] bg-surface p-6 text-center text-ink ring-0 sm:max-w-sm"
        data-testid="leave-lesson-dialog"
      >
        <div className="lp-callout-icon mx-auto" data-color="coral" aria-hidden="true">
          <LogOut className="size-6" strokeWidth={2.75} />
        </div>
        <DialogTitle className="mt-4 kid-text-heading text-ink [font-family:var(--font-kid)]!">Leave this lesson?</DialogTitle>
        <DialogDescription className="mt-2 kid-text-body text-ink">
          If you leave now, you will start this one again next time.
        </DialogDescription>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" className="candy-btn kid-tap w-full" onClick={() => setConfirming(false)} data-testid="leave-stay">
            Keep going
          </button>
          <button type="button" className="candy-btn-quiet kid-tap w-full" onClick={leave} data-testid="leave-confirm">
            Leave
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
