import { Link } from '@tanstack/react-router'
import { Check, Lock, Play } from 'lucide-react'
import { LESSON_TYPE_META } from '@/components/kid/roadmap/lessonTypeMeta'
import { StatTiles } from '@/components/kid/StatTiles'
import { useTerms } from '@/hooks/useSettings'
import type { RailRowState } from '@/hooks/useModulePath'
import type { LessonType } from '@/lib/roadmap'

export interface LessonRailRow {
  id: string
  title: string
  type: LessonType
  state: RailRowState
}

export interface LessonRailInfo {
  sectionNumber: number
  moduleTitle: string
  position: number
  total: number
  done: number
  percent: number
  rows: LessonRailRow[]
  gamified: boolean
}

const ROW_WORD: Record<RailRowState, string> = {
  current: 'You are here',
  completed: 'Completed',
  next: 'Next up',
  locked: 'Locked',
}

function RowIcon({ state }: { state: RailRowState }) {
  if (state === 'completed') return <Check className="size-4" strokeWidth={3} aria-hidden />
  if (state === 'locked') return <Lock className="size-4" aria-hidden />
  return <Play className="size-4" fill={state === 'next' ? 'currentColor' : 'none'} aria-hidden />
}

function RailRowView({ courseId, row }: { courseId: string; row: LessonRailRow }) {
  const { label: typeLabel, Icon: TypeIcon } = LESSON_TYPE_META[row.type]
  const content = (
    <>
      <span className="khd-status" aria-hidden>
        <RowIcon state={row.state} />
      </span>
      <span className="khd-row-main">
        <span className="khd-row-title">{row.title}</span>
        <span className="khd-row-meta">
          <span className="khd-type">
            <TypeIcon aria-hidden />
            {typeLabel}
          </span>
          <span aria-hidden>·</span>
          {ROW_WORD[row.state]}
        </span>
      </span>
    </>
  )
  // Current: you are already here, so it is shown, not a link. Locked: not interactive.
  if (row.state === 'current' || row.state === 'locked') {
    return (
      <div
        className="khd-row"
        data-state={row.state}
        aria-current={row.state === 'current' ? 'true' : undefined}
        aria-disabled={row.state === 'locked' ? 'true' : undefined}
        data-testid="rail-row"
      >
        {content}
      </div>
    )
  }
  return (
    <Link
      to="/courses/$courseId/lessons/$lessonId"
      params={{ courseId, lessonId: row.id }}
      replace
      className="khd-row kid-tap"
      data-state={row.state}
      data-testid="rail-row"
    >
      {content}
    </Link>
  )
}

/**
 * The desktop lesson shell's right rail (ui.md "Lesson pages redesign"): the same
 * stat tiles as Home's rail, then one static card for the CURRENT module only — a
 * teal-d header band (reusing Home's `.khd-band`/`.khd-list`/`.khd-row` classes, kid.css
 * "desktop Home") and its lessons, so nothing here needed new row-state CSS beyond the
 * one `current` variant Home's own rows don't have (there is no "the lesson I'm on
 * right now" concept on Home).
 */
export function LessonRail({ courseId, rail }: { courseId: string; rail: LessonRailInfo }) {
  const { lower } = useTerms()
  return (
    <aside className="khd-rail" aria-label="Your progress and this module" data-testid="lesson-rail">
      <StatTiles gamified={rail.gamified} />
      {/* No extra card chrome here: the band's own fill and the list's own row shadows
          already read as "a card", the same way Home's own un-wrapped `.khd-section` does. */}
      <section className="khd-section" data-testid="lesson-rail-module">
        <div className="khd-band" data-static="true">
          <span className="khd-band-text">
            <span className="khd-band-caption">Section {rail.sectionNumber}</span>
            <span className="khd-band-title">{rail.moduleTitle}</span>
          </span>
          <span className="khd-band-side">
            <span className="khd-band-count kid-num">
              {rail.done} of {rail.total} {lower('lesson', rail.total !== 1)}
            </span>
          </span>
          <span className="khd-band-bar" aria-hidden>
            <span className="khd-band-bar-fill" style={{ width: `${rail.percent}%` }} />
          </span>
        </div>
        <ul className="khd-list">
          {rail.rows.map((row) => (
            <li key={row.id}>
              <RailRowView courseId={courseId} row={row} />
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
