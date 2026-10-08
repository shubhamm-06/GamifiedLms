import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PartyPopper } from 'lucide-react'
import type { Roadmap } from '@/lib/roadmap'
import { useModuleSpy } from '@/hooks/useModuleSpy'
import { prefersReducedMotion } from '@/hooks/useMediaQuery'
import { useNodeCenters } from '@/hooks/useNodeCenters'
import { clearLessonLeft, peekLessonLeft } from '@/lib/roadmapReturn'
import { useBackClosable } from '@/hooks/useBackClosable'
import { LessonPopover } from './LessonPopover'
import { ModuleBar } from './ModuleBar'
import { ModuleDivider } from './ModuleDivider'
import { PathDecor } from './PathDecor'
import { RoadmapConnector } from './RoadmapConnector'
import { RoadmapNode } from './RoadmapNode'
import { getTerms as t } from '@/lib/settings/terms'
import { getTerms as tw } from '@/lib/settings/terms'

/**
 * The learning path: ONE continuous winding road through every lesson in the
 * states function's order, with no per-module boxes and no header above it.
 * The slim sticky `ModuleBar` names whichever module is in view.
 *
 * On every visit (every mount) it scrolls the next-up node to the middle of
 * the screen and opens that node's popover, so the child's next step is
 * already on screen with no tap. Fallbacks: a finished course scrolls to a
 * small "course complete" note at the end with no popover; a locked lesson the
 * player sent back here (`focusLessonId`) is scrolled to and wiggled instead.
 * One popover at a time: tapping another node switches, tapping the open node
 * or anywhere else closes it.
 */
export function RoadmapPath({
  roadmap,
  courseId,
  focusLessonId,
}: {
  roadmap: Roadmap
  courseId: string
  /** A locked lesson the lesson player turned away (`?open=`); null normally. */
  focusLessonId: string | null
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(
    () =>
      roadmap.sections.flatMap((s) =>
        s.lessons.map((lesson, i) => ({ lesson, section: s, position: i + 1, of: s.lessons.length })),
      ),
    [roadmap],
  )
  const idKey = rows.map((r) => r.lesson.id).join(',')
  const measure = useNodeCenters(pathRef, idKey)
  // The lesson to bring into view: one the player turned away (`?open=`), else the one the
  // child just came back from (`roadmapReturn`), else none (the next-up lesson, below).
  const [returnedFrom] = useState(peekLessonLeft)
  const focusId = focusLessonId ?? returnedFrom
  const focusRow = focusId ? rows.find((r) => r.lesson.id === focusId) : undefined
  const focusIsLocked = focusRow?.lesson.state === 'locked'
  // A lesson they came back from that is not the next-up one: scroll to it, open nothing.
  const focusIsOther = !!focusRow && !focusIsLocked && focusRow.lesson.id !== roadmap.currentLessonId
  // Where the page is about to scroll to (that lesson, else the next-up lesson, else the last
  // one of a finished course, else the first), so the bar is right before any scrolling happens.
  const startRow =
    focusRow ??
    (roadmap.currentLessonId ? rows.find((r) => r.lesson.id === roadmap.currentLessonId) : undefined) ??
    (roadmap.courseComplete ? rows[rows.length - 1] : rows[0])
  const spy = useModuleSpy(rootRef, { key: startRow?.section.key ?? '', unit: startRow?.position ?? 1 }, idKey)
  const activeIndex = Math.max(0, roadmap.sections.findIndex((s) => s.key === spy.key))
  const active = roadmap.sections[activeIndex]

  // The automatic open happens through the initial state, so no effect has to set it.
  const [open, setOpen] = useState<{ id: string; focus: boolean } | null>(() =>
    !focusIsLocked && !focusIsOther && !roadmap.courseComplete && roadmap.currentLessonId
      ? { id: roadmap.currentLessonId, focus: false }
      : null,
  )

  // Every visit: bring the next step into view (or the fallback target).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const target = focusIsLocked
      ? root.querySelector<HTMLElement>(`.rm-node[data-lesson-id="${focusId}"]`)
      : focusIsOther
        ? root.querySelector<HTMLElement>(`[data-anchor-for="${focusId}"]`)
        : roadmap.courseComplete || !roadmap.currentLessonId
          ? root.querySelector<HTMLElement>('[data-testid="course-complete-note"]')
          : root.querySelector<HTMLElement>(`[data-anchor-for="${roadmap.currentLessonId}"]`)
    target?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    // A locked lesson explains itself the same way a tap on it does: it wiggles.
    if (focusIsLocked) target?.click()
    clearLessonLeft()
    // Runs once per visit on purpose; later state changes must not re-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tapping anywhere that is not a node, the card or the bottom nav closes the card.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (t?.closest('.rm-pop') || t?.closest('.rm-node') || t?.closest('.kid-nav')) return
      setOpen(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const toggle = useCallback((id: string) => {
    setOpen((prev) => (prev?.id === id ? null : { id, focus: true }))
  }, [])

  const openId = open?.id ?? null
  const close = useCallback(
    (returnFocus: boolean) => {
      if (openId && returnFocus) document.querySelector<HTMLElement>(`.rm-node[data-lesson-id="${openId}"]`)?.focus()
      setOpen(null)
    },
    [openId],
  )

  // Completed lessons always form a prefix of the course order.
  let completed = 0
  for (const { lesson } of rows) {
    if (lesson.state !== 'completed') break
    completed += 1
  }
  // Row indices where a new module starts (not the first), which is where a divider sits.
  const breaks = rows.flatMap((r, i) => (r.position === 1 && i > 0 ? [i] : []))
  const openRow = open ? rows.find((r) => r.lesson.id === open.id) : undefined
  // Android Back closes a card the child opened by tapping a node (`focus: true`).
  // The card Home opens by itself on arrival (`focus: false`) is NOT registered, so
  // Back right after arrival goes straight to "Press back again to exit".
  useBackClosable(!!openRow && openRow.lesson.state !== 'locked' && open?.focus === true, () => close(false))

  return (
    <div className="rm" data-testid="roadmap" ref={rootRef}>
      {active ? <ModuleBar section={active} sectionNumber={activeIndex + 1} unit={spy.unit} /> : null}
      <div className="rm-path" ref={pathRef}>
        <PathDecor rows={rows.length} breaks={breaks} />
        <RoadmapConnector measure={measure} completedCount={completed} />
        {rows.map(({ lesson, section, position }, i) => (
          <Fragment key={lesson.id}>
            {/* Where the path crosses into the next module: a plain visual break, never interactive. */}
            {position === 1 && i > 0 ? <ModuleDivider title={section.title} /> : null}
            <RoadmapNode
              lesson={lesson}
              index={i}
              unit={position}
              moduleKey={section.key}
              isCurrent={lesson.id === roadmap.currentLessonId}
              expanded={open?.id === lesson.id}
              onOpen={toggle}
            />
          </Fragment>
        ))}
      </div>
      {roadmap.courseComplete ? (
        <div className="rm-complete" role="status" data-testid="course-complete-note">
          <PartyPopper className="size-6 flex-none" aria-hidden />
          {`You finished every ${tw().lower('lesson')}!`}
        </div>
      ) : null}
      {openRow && openRow.lesson.state !== 'locked' ? (
        <LessonPopover
          key={openRow.lesson.id}
          lesson={openRow.lesson}
          courseId={courseId}
          current={openRow.lesson.id === roadmap.currentLessonId}
          subtitle={`${t().term('lesson')} ${openRow.position} of ${openRow.of}`}
          rootRef={rootRef}
          focusOnOpen={open?.focus ?? false}
          onClose={close}
        />
      ) : null}
    </div>
  )
}
