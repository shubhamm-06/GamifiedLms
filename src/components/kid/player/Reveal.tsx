import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * A subtle rise-and-fade the first time a block scrolls into view. Under
 * `prefers-reduced-motion` it renders a plain element (no transform, no
 * fade). No parallax anywhere on this page.
 */
export function Reveal({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      className={className}
      data-testid={testId}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
