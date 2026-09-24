import { playerCopy } from '@/lib/playerCopy'

/**
 * The lesson page's hero: a soft cream-to-gold wash with a curved bottom edge,
 * an episode eyebrow pill, the lesson title and the course name. The lanterns
 * and squiggles are decoration, shown from md up only (CSS), and none of it
 * moves: no parallax. The age band from the mock is not shown because the
 * schema has no such field.
 */
export function LessonHero({ number, total, title, courseTitle }: { number: number; total: number; title: string; courseTitle: string | null }) {
  return (
    <header className="lp-hero" data-testid="lesson-hero">
      <span className="lp-lantern lp-lantern-a" aria-hidden="true" />
      <span className="lp-lantern lp-lantern-b" aria-hidden="true" />
      <span className="lp-squiggle lp-squiggle-a" aria-hidden="true" />
      <span className="lp-squiggle lp-squiggle-b" aria-hidden="true" />
      <div className="lp-hero-copy">
        <span className="lp-eyebrow kid-num" data-testid="episode-eyebrow">
          <span className="lp-eyebrow-dot" aria-hidden="true" />
          {playerCopy.page.episodeOf(number, total)}
        </span>
        <h1 className="lp-hero-title">{title}</h1>
        {/* Reserve the line so the hero does not grow when the course name arrives. */}
        <p className="lp-hero-sub">{courseTitle ?? ' '}</p>
      </div>
    </header>
  )
}
