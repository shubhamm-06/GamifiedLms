import { useState, type CSSProperties } from 'react'
import { ChevronUp } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { CoursePath } from '@/hooks/useCoursePath'
import { playerCopy } from '@/lib/playerCopy'
import { CoursePathList } from './CoursePathList'

/** Progress as a ring: teal fill, the percentage inside. Custom CSS only because a conic-gradient ring has no Tailwind equivalent. */
function ProgressRing({ percent }: { percent: number }) {
  return (
    <span className="lp-path-ring" style={{ '--p': percent } as CSSProperties} aria-hidden="true">
      <span>{percent}%</span>
    </span>
  )
}

/**
 * Below lg: a compact strip (ring and "X of N episodes") that opens a bottom
 * Sheet holding the same episode list the sidebar shows. The Sheet renders in
 * a portal outside `.kid-app`, so its content carries `.kid-font` (Baloo 2).
 */
export function CoursePathStrip({ path, courseId, lessonId }: { path: CoursePath; courseId: string; lessonId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="lp-path-strip kid-tap lg:hidden"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="path-strip"
      >
        <ProgressRing percent={path.percent} />
        <span className="lp-path-strip-text">
          <b className="kid-num">{playerCopy.page.episodesDone(path.done, path.total)}</b>
          <span>{playerCopy.page.keepExploring}</span>
        </span>
        <ChevronUp className="size-6 flex-none" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="kid-font max-h-[85dvh] gap-0 rounded-t-[26px] bg-surface p-0 text-ink">
          <SheetHeader className="p-5 pb-3">
            <SheetTitle className="text-2xl font-extrabold [font-family:var(--font-kid)]!">
              {playerCopy.page.coursePathTitle}
            </SheetTitle>
            <SheetDescription className="text-base text-ink">{playerCopy.page.coursePathHint}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <CoursePathList items={path.items} currentLessonId={lessonId} courseId={courseId} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** From lg up: a sticky 252px card with a teal header, progress and the same list. */
export function CoursePathSidebar({ path, courseId, lessonId }: { path: CoursePath; courseId: string; lessonId: string }) {
  return (
    <aside className="lp-sidebar kid-card hidden lg:block" aria-label={playerCopy.page.coursePath} data-testid="path-sidebar">
      <div className="lp-sidebar-head">
        <span>{playerCopy.page.coursePath}</span>
        <strong>{path.courseTitle ?? ' '}</strong>
      </div>
      <div className="lp-sidebar-progress">
        <ProgressRing percent={path.percent} />
        <span className="lp-path-strip-text">
          <b className="kid-num">{playerCopy.page.episodesDone(path.done, path.total)}</b>
          <span>{playerCopy.page.keepExploring}</span>
        </span>
      </div>
      <CoursePathList items={path.items} currentLessonId={lessonId} courseId={courseId} />
    </aside>
  )
}
