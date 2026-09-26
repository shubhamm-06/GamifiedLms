import { Lock } from 'lucide-react'
import type { RoadmapSection } from '@/lib/roadmap'

/**
 * The slim sticky bar that replaces the boxed module headers: it names whichever
 * module's lessons are in view (scroll-spy, see `useModuleSpy`) and nothing
 * else, so a child always knows where on the path they are. Teal for a module
 * they can work in, a dimmer neutral with a lock when every lesson in it is
 * still locked. Gold stays reserved for the next-up node and Continue, so this
 * bar never uses it. Not interactive; it announces changes politely.
 */
export function ModuleBar({ section }: { section: RoadmapSection }) {
  return (
    <div className="rm-modbar" data-module-bar data-locked={section.allLocked} data-testid="module-bar">
      <h2 className="rm-modbar-title" aria-live="polite" data-testid="module-bar-title">
        {section.title}
      </h2>
      {section.allLocked ? <Lock className="size-5 flex-none" aria-label="Locked" role="img" /> : null}
    </div>
  )
}
