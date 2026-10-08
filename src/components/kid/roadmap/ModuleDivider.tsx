import type { RoadmapSection } from '@/lib/roadmap'
import { getTerms as t } from '@/lib/settings/terms'

/**
 * A quiet break in the path where it crosses into the next module: a short rule,
 * the module's name (the same `section.title` the sticky `ModuleBar` shows) and a
 * second short rule. Muted ink on the plain page background, a fixed height
 * (`--rm-div-h`, which the path's decoration counts), not a tap target and not
 * focusable. Shown before every module after the first, including one that is
 * still fully locked.
 */
export function ModuleDivider({ title }: { title: RoadmapSection['title'] }) {
  return (
    <div className="rm-divider" role="separator" aria-label={`Next ${t().lower('module')}: ${title}`} data-testid="module-divider">
      <span className="rm-divider-rule" aria-hidden />
      <span className="rm-divider-label" aria-hidden>
        {title}
      </span>
      <span className="rm-divider-rule" aria-hidden />
    </div>
  )
}
