import { Lock } from 'lucide-react'
import type { RoadmapSection } from '@/lib/roadmap'

/**
 * The slim sticky bar that replaces the boxed module headers: it names whichever
 * module's lessons are in view (scroll-spy, see `useModuleSpy`) and nothing
 * else, so a child always knows where on the path they are. Teal for a module
 * they can work in, a dimmer neutral with a lock when every lesson in it is
 * still locked. Gold stays reserved for the next-up node and its popover, so
 * this bar never uses it. Above the title sits a small caption, "Section N, Unit
 * M": our module is the Section (its place among the course's modules) and our
 * lesson is the Unit (its place within that module, restarting at 1 in every
 * module). Not interactive; the title announces changes politely, the caption
 * (which changes lesson by lesson) does not.
 */
export function ModuleBar({
  section,
  sectionNumber,
  unit,
}: {
  section: RoadmapSection
  sectionNumber: number
  unit: number
}) {
  return (
    <div className="rm-modbar" data-module-bar data-locked={section.allLocked} data-testid="module-bar">
      <div className="rm-modbar-text">
        <p className="rm-modbar-caption" data-testid="module-bar-caption">
          Section {sectionNumber}, Unit {unit}
        </p>
        <h2 className="rm-modbar-title" aria-live="polite" data-testid="module-bar-title">
          {section.title}
        </h2>
      </div>
      {section.allLocked ? <Lock className="size-5 flex-none" aria-label="Locked" role="img" /> : null}
    </div>
  )
}
