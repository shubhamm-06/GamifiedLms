import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDocSrcDoc, type DocTheme } from '@/lib/lessonPlayer'
import { LessonMessage } from './LessonMessage'

/** Reads the palette from the root CSS tokens at run time, so no colour is hardcoded here. */
function readTheme(): DocTheme {
  const root = getComputedStyle(document.documentElement)
  const token = (name: string) => root.getPropertyValue(name).trim()
  return {
    ink: token('--ink'),
    cream: token('--cream'),
    surface: token('--surface'),
    teal: token('--teal-d'),
    // The frame is its own document, so it does not get the app's Baloo 2.
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  }
}

/**
 * A reading (text) lesson. Its HTML is typed by an admin into a plain textarea
 * and is not sanitized anywhere, so it is never put into the page: it is shown
 * in a sandboxed frame with NO scripts (`sandbox="allow-same-origin"` only, and
 * a Content-Security-Policy inside forbids scripts and connections as well), so
 * pasted script, inline handlers and `javascript:` links cannot run. The
 * same-origin flag is there only so this page can read the frame's height and
 * size it; it cannot help scripts, because none can run. Links inside are inert
 * (no popups are allowed).
 */
export function DocLesson({ html, title }: { html: string | null; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(280)
  const srcDoc = useMemo(() => (html?.trim() ? buildDocSrcDoc(html, readTheme()) : null), [html])

  useEffect(() => {
    const el = frame.current
    if (!el || !srcDoc) return
    let observer: ResizeObserver | undefined
    const measure = () => {
      const doc = el.contentDocument
      if (doc?.documentElement) setHeight(Math.max(160, Math.ceil(doc.documentElement.scrollHeight)))
    }
    const onLoad = () => {
      measure()
      const doc = el.contentDocument
      if (doc?.body) {
        observer = new ResizeObserver(measure)
        observer.observe(doc.body)
      }
    }
    el.addEventListener('load', onLoad)
    if (el.contentDocument?.readyState === 'complete') onLoad()
    return () => {
      el.removeEventListener('load', onLoad)
      observer?.disconnect()
    }
  }, [srcDoc])

  if (!srcDoc) return <LessonMessage testId="doc-empty">There&rsquo;s nothing to read here yet. Please check back soon.</LessonMessage>
  return (
    <iframe
      ref={frame}
      className="lp-doc"
      title={title}
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      style={{ height }}
      data-testid="doc-frame"
    />
  )
}
