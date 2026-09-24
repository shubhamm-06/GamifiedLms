/**
 * The lesson title, large and bold, with the module name under it in regular
 * weight. Nothing else: no eyebrow, no counts, no course name. The shapes are
 * decoration, shown from md up only (CSS), and nothing moves.
 */
export function LessonHero({ title, moduleTitle }: { title: string; moduleTitle: string | null }) {
  return (
    <header className="lp-hero" data-testid="lesson-hero">
      <span className="lp-shape lp-shape-a" aria-hidden="true" />
      <span className="lp-shape lp-shape-b" aria-hidden="true" />
      <div className="lp-hero-copy">
        <h1 className="lp-hero-title">{title}</h1>
        {/* The line is reserved so the hero does not grow when the module name arrives. */}
        <p className="lp-hero-sub">{moduleTitle ?? ' '}</p>
      </div>
    </header>
  )
}
