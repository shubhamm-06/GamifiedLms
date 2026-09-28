import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

/**
 * One-time native setup, called from main.tsx before the first render. On the
 * web it does nothing at all.
 *  - `html[data-native]` switches on the native-only CSS (safe areas on the
 *    auth pages and admin shell, the kid "app feel" rules in kid.css).
 *  - The soft keyboard: while it is open `html[data-keyboard="open"]` hides the
 *    kid bottom nav (kid.css), and once it is up the focused field is scrolled
 *    into view. The WebView itself is resized by the activity's `adjustResize`
 *    plus Capacitor 8's SystemBars IME padding, so a field is never under it.
 */
export function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return
  const root = document.documentElement
  root.dataset.native = 'true'

  void Keyboard.addListener('keyboardWillShow', () => {
    root.dataset.keyboard = 'open'
  })
  void Keyboard.addListener('keyboardDidShow', () => {
    const el = document.activeElement
    if (el instanceof HTMLElement && el.matches('input, textarea, select, [contenteditable="true"]')) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })
  void Keyboard.addListener('keyboardWillHide', () => {
    delete root.dataset.keyboard
  })
}
