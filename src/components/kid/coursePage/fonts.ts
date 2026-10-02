import { useEffect, useState } from 'react'
import type { PageFont } from '@/lib/coursePage'

/**
 * Self-hosted fonts for the parent-facing course page. The @font-face rules live in
 * coursePage.css (latin, woff2, font-display: swap, only the weights the page uses: Inter
 * 400/500/600/700, Source Serif 4 600/700; the "friendly" preset reuses the Nunito declared in
 * styles.css). A face downloads only when asked for, so a student who never opens a course page
 * downloads nothing, and the Capacitor build works offline (the files ship inside the app).
 * Until a file arrives, coursePage.css uses a metric-matched fallback ('Inter Fallback').
 */
const loading = new Map<string, Promise<void>>()

function once(key: string, specs: string[]): Promise<void> {
  let p = loading.get(key)
  if (!p) {
    p = Promise.all(specs.map((s) => document.fonts.load(s))).then(
      () => undefined,
      () => {
        loading.delete(key)
      },
    )
    loading.set(key, p)
  }
  return p
}

/** Fetches the faces the preset uses. Resolves when they are ready (or failed). */
export function loadCoursePageFont(font: PageFont): Promise<void> {
  const jobs: Promise<void>[] = []
  if (font === 'inter' || font === 'classic') jobs.push(once('inter', ['400 1em Inter', '500 1em Inter', '600 1em Inter', '700 1em Inter']))
  if (font === 'classic') jobs.push(once('serif', ["600 1em 'Source Serif 4'", "700 1em 'Source Serif 4'"]))
  if (font === 'friendly') jobs.push(once('nunito', ["400 1em 'Nunito Variable'", "700 1em 'Nunito Variable'"]))
  return Promise.all(jobs).then(() => undefined)
}

/**
 * For the page's data gates: starts the default preset's fonts at once (in parallel with the
 * course fetch), then the course's own preset when it is known, and reports ready when that
 * preset's faces have loaded, or after `timeoutMs`, so a slow font never holds the page back
 * for long (the metric-matched fallback covers the rest). `null` = the preset is not known yet.
 */
export function useCoursePageFonts(font: PageFont | null, timeoutMs = 400): boolean {
  const [ready, setReady] = useState<PageFont | null>(null)
  useEffect(() => {
    void loadCoursePageFont('inter')
  }, [])
  useEffect(() => {
    if (!font) return
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        setReady(font)
      }
    }
    void loadCoursePageFont(font).then(finish)
    const t = window.setTimeout(finish, timeoutMs)
    return () => {
      done = true
      window.clearTimeout(t)
    }
  }, [font, timeoutMs])
  return font !== null && ready === font
}

/** The stacks each preset uses, for the admin editor's font cards (the page itself reads them from coursePage.css). */
export const FONT_PRESETS: Record<PageFont, { label: string; description: string; heading: string; body: string }> = {
  inter: {
    label: 'Inter',
    description: 'Clean and modern, one family throughout.',
    heading: "Inter, ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif",
    body: "Inter, ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif",
  },
  classic: {
    label: 'Classic',
    description: 'A serif for headings, Inter for reading.',
    heading: "'Source Serif 4', Georgia, 'Times New Roman', serif",
    body: "Inter, ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif",
  },
  friendly: {
    label: 'Friendly',
    description: 'Soft and rounded, one family throughout.',
    heading: "'Nunito Variable', ui-rounded, system-ui, 'Segoe UI', Arial, sans-serif",
    body: "'Nunito Variable', ui-rounded, system-ui, 'Segoe UI', Arial, sans-serif",
  },
}
