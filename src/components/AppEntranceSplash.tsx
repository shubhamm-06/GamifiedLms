import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AnimatePresence, motion } from 'framer-motion'
import { REDUCED_MOTION, useMediaQuery } from '@/hooks/useMediaQuery'

const ENTRANCE_MS = 950
const FADE_OUT_MS = 150

/**
 * A one-shot entrance for the owl mark, played once per cold start right after
 * the native splash (`android/.../values/styles.xml`) hands off to the webview,
 * so there is no color or asset jump between the two. Native only
 * (`Capacitor.isNativePlatform()`); the web renders `children` immediately, exactly
 * as before this component existed.
 *
 * It does NOT gate navigation: it is an overlay on top of `children` (already
 * mounted and resolving auth/routing underneath), removed after its own fixed
 * timer. Whatever the router lands on (Home, login, a loading state) is already
 * there, or still resolving on its own, when the owl fades out.
 *
 * The owl's brand colors (teal #18B6C9, light teal #6FE0EC, ink #231F20, gold
 * #FFC83D) are hardcoded here on purpose: they are the brand mark's own
 * colors, not the app's locked design tokens, and must not be added to them
 * (`docs/ui.md` "Splash and entrance owl").
 */
export function AppEntranceSplash({ children }: { children: React.ReactNode }) {
  const native = Capacitor.isNativePlatform()
  const [showing, setShowing] = useState(native)
  const reduced = useMediaQuery(REDUCED_MOTION)

  useEffect(() => {
    if (!native) return
    const t = window.setTimeout(() => setShowing(false), ENTRANCE_MS)
    return () => window.clearTimeout(t)
  }, [native])

  return (
    <>
      {children}
      {native ? (
        <AnimatePresence>
          {showing ? (
            <motion.div
              className="app-entrance-splash"
              data-testid="app-entrance-splash"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: FADE_OUT_MS / 1000, ease: 'easeOut' }}
            >
              {reduced ? (
                <OwlMark />
              ) : (
                <>
                  <motion.div
                    className="app-entrance-glow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.9, 0] }}
                    transition={{ duration: ENTRANCE_MS / 1000, ease: 'easeInOut', times: [0, 0.45, 1] }}
                  />
                  <motion.div
                    initial={{ scale: 0.3, rotate: -8, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ duration: ENTRANCE_MS / 1000, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <OwlMark blink />
                  </motion.div>
                </>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}
    </>
  )
}

/**
 * The Wisdom Hatch Kids owl mark: the exact finalized SVG, inline (not `<img>`)
 * so the pupil group can be targeted for the one-shot blink. Do not redesign
 * or recolor it.
 */
function OwlMark({ blink = false }: { blink?: boolean }) {
  return (
    <svg
      viewBox="390 120 420 420"
      width="200"
      height="200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Wisdom Hatch Kids"
    >
      <circle cx="600" cy="330" r="190" fill="#ffffff" />
      <ellipse cx="600" cy="345" rx="120" ry="124" fill="#18B6C9" />
      <ellipse cx="600" cy="372" rx="66" ry="76" fill="#6FE0EC" />
      <circle cx="552" cy="318" r="48" fill="#ffffff" />
      <circle cx="648" cy="318" r="48" fill="#ffffff" />
      <circle cx="552" cy="318" r="48" fill="none" stroke="#231F20" strokeWidth="9" />
      <circle cx="648" cy="318" r="48" fill="none" stroke="#231F20" strokeWidth="9" />
      <motion.g
        initial={false}
        animate={blink ? { scaleY: [1, 0.12, 1] } : { scaleY: 1 }}
        transition={blink ? { duration: 0.22, delay: (ENTRANCE_MS - 260) / 1000, times: [0, 0.5, 1], ease: 'easeInOut' } : undefined}
        style={{ originX: 0.5, originY: 0.5 }}
      >
        <circle cx="560" cy="312" r="20" fill="#231F20" />
        <circle cx="640" cy="312" r="20" fill="#231F20" />
      </motion.g>
      <polygon points="600,150 710,192 600,234 490,192" fill="#231F20" />
      <circle cx="600" cy="192" r="9" fill="#FFC83D" />
    </svg>
  )
}
