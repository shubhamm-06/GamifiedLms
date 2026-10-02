import { useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoursePageView } from '@/components/kid/coursePage/CoursePageView'
import type { CoursePageModel } from '@/lib/coursePage'

const WIDTHS = { mobile: 390, desktop: 1080 } as const
type Size = keyof typeof WIDTHS

/**
 * The editor's live preview: the REAL `CoursePageView` (same component the student
 * sees) fed a model built from the unsaved form values, in `embedded` mode (normal
 * flow, Enroll link inert). It is laid out at a true 390px (phone) or 1080px
 * (laptop) width — container queries decide the layout, so it lays out exactly like
 * the page — then scaled down to fit the pane. Page fonts and the page's own styles
 * are scoped under `.cp`, so nothing here leaks into the rest of admin.
 */
export function CoursePagePreview({ model }: { model: CoursePageModel }) {
  const [size, setSize] = useState<Size>('mobile')
  const paneRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [paneW, setPaneW] = useState(0)
  const [innerH, setInnerH] = useState(0)

  useEffect(() => {
    const pane = paneRef.current
    const inner = innerRef.current
    if (!pane || !inner) return
    const measure = () => {
      setPaneW(pane.clientWidth)
      setInnerH(inner.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(pane)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  const base = WIDTHS[size]
  const scale = paneW > 0 ? Math.min(1, paneW / base) : 1

  return (
    <div className="space-y-2" data-testid="course-page-preview">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Live preview</p>
        <div className="flex gap-1" role="group" aria-label="Preview width">
          <Button type="button" size="sm" variant={size === 'mobile' ? 'default' : 'outline'} aria-pressed={size === 'mobile'} onClick={() => setSize('mobile')}>
            <Smartphone />
            Mobile
          </Button>
          <Button type="button" size="sm" variant={size === 'desktop' ? 'default' : 'outline'} aria-pressed={size === 'desktop'} onClick={() => setSize('desktop')}>
            <Monitor />
            Desktop
          </Button>
        </div>
      </div>
      <div ref={paneRef} className="bg-muted/30 overflow-hidden rounded-lg border" style={{ height: innerH * scale || undefined }}>
        <div ref={innerRef} style={{ width: base, transform: `scale(${scale})`, transformOrigin: 'top left' }} data-preview-size={size}>
          <CoursePageView model={model} embedded />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Shows your unsaved changes. The Enroll button does nothing here. Showing the page at {base}px wide{scale < 1 ? `, scaled to ${Math.round(scale * 100)}%` : ''}.
      </p>
    </div>
  )
}
