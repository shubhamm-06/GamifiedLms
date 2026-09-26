import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import type { RoadmapLesson } from '@/lib/roadmap'

/** Gap between the node and the card, which the tail spans. */
const GAP = 14
/** The tail never sits closer than this to the card's rounded corners. */
const TAIL_INSET = 26
/** Room the card keeps from the viewport's bottom edge before it flips above the node. */
const EDGE = 12

/** The label the old lesson sheet used for each state, with the XP still to earn inline. */
function ctaLabel(lesson: RoadmapLesson): string {
  const verb = lesson.state === 'completed' ? 'Review' : lesson.state === 'in_progress' ? 'Keep going' : 'Start'
  const xp = lesson.state !== 'completed' && lesson.xp !== null && lesson.xp > 0 ? ` +${lesson.xp} XP` : ''
  return verb + xp
}

/**
 * The small card anchored to a tapped node (replaces the bottom sheet): no
 * backdrop, no dimming, the path stays visible. Gold for the next-up node
 * only; every other unlocked node gets `--teal-d` with cream text (6.2:1, where
 * cream on plain `--teal` would be 2.88:1). It holds the title, the lesson's
 * place in its module and one pill button whose label carries the XP.
 *
 * Positioning writes straight to the element (no React state, so no extra
 * render): horizontally centred on the node's actual centre, then clamped to
 * the path's width so it never leaves a 360-430px screen, with the tail kept on
 * the node's centre; vertically below the node, flipped above (tail pointing
 * down) when there is not enough room under it in the viewport. It re-measures
 * on resize and once scrolling settles, so an auto-opened card is placed where
 * the smooth scroll ends.
 */
export function LessonPopover({
  lesson,
  courseId,
  current,
  subtitle,
  rootRef,
  focusOnOpen,
  onClose,
}: {
  lesson: RoadmapLesson
  courseId: string
  /** The next-up node: the only gold card. */
  current: boolean
  subtitle: string
  rootRef: RefObject<HTMLElement | null>
  /** Move focus to the button (a child or keyboard opened it; not on the automatic open). */
  focusOnOpen: boolean
  onClose: (returnFocus: boolean) => void
}) {
  const card = useRef<HTMLDivElement>(null)
  const cta = useRef<HTMLAnchorElement>(null)

  const place = useCallback(() => {
    const root = rootRef.current
    const el = card.current
    const anchor = root?.querySelector<HTMLElement>(`[data-anchor-for="${lesson.id}"]`)
    if (!root || !el || !anchor) return
    const box = root.getBoundingClientRect()
    const a = anchor.getBoundingClientRect()
    const width = Math.min(320, box.width)
    el.style.width = `${width}px`
    const height = el.offsetHeight

    const centreX = a.left + a.width / 2 - box.left
    const left = Math.min(Math.max(centreX - width / 2, 0), box.width - width)
    const tailX = Math.min(Math.max(centreX - left, TAIL_INSET), width - TAIL_INSET)

    // What covers the top of the viewport: the top bar and the sticky module bar.
    const bar = root.querySelector<HTMLElement>('[data-module-bar]')
    const topLimit = (document.querySelector('.kid-topbar')?.getBoundingClientRect().bottom ?? 0) + (bar?.offsetHeight ?? 0)
    // The bottom nav (when shown) covers the bottom of the viewport too.
    const navTop = document.querySelector('.kid-nav')?.getBoundingClientRect().top ?? window.innerHeight
    const below = Math.min(window.innerHeight, navTop) - a.bottom - EDGE
    const above = a.top - topLimit - EDGE
    const flip = below < height + GAP && above > below

    el.style.left = `${left}px`
    el.style.top = `${flip ? a.top - box.top - GAP - height : a.bottom - box.top + GAP}px`
    el.style.setProperty('--tail-x', `${tailX}px`)
    el.dataset.placement = flip ? 'above' : 'below'
    el.style.visibility = 'visible'
  }, [lesson.id, rootRef])

  useLayoutEffect(() => {
    place()
  }, [place])

  useEffect(() => {
    let settle = 0
    const onScroll = () => {
      window.clearTimeout(settle)
      settle = window.setTimeout(place, 120)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('keydown', onKey)
    const observer = new ResizeObserver(() => place())
    if (rootRef.current) observer.observe(rootRef.current)
    return () => {
      window.clearTimeout(settle)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('keydown', onKey)
      observer.disconnect()
    }
  }, [place, onClose, rootRef])

  useEffect(() => {
    if (focusOnOpen) cta.current?.focus({ preventScroll: true })
  }, [focusOnOpen])

  const titleId = `rm-pop-title-${lesson.id}`
  return (
    <div
      ref={card}
      className="rm-pop kid-font"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-tone={current ? 'gold' : 'teal'}
      data-testid="lesson-popover"
      style={{ visibility: 'hidden' }}
    >
      <p id={titleId} className="rm-pop-title">
        {lesson.title}
      </p>
      <p className="rm-pop-sub">{subtitle}</p>
      <Link
        ref={cta}
        to="/courses/$courseId/lessons/$lessonId"
        params={{ courseId, lessonId: lesson.id }}
        className="rm-pop-cta kid-tap"
        data-testid="popover-cta"
      >
        {lesson.state !== 'completed' && lesson.xp !== null && lesson.xp > 0 ? (
          <Sparkles className="size-5 flex-none" aria-hidden />
        ) : null}
        {ctaLabel(lesson)}
      </Link>
    </div>
  )
}
