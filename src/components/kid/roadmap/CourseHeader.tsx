import { PartyPopper } from 'lucide-react'
import type { Roadmap } from '@/lib/roadmap'
import { CourseArt } from './CourseArt'
import { KidProgress } from './KidProgress'

/** Phone/tablet header: scrolls with the page (the lg summary card replaces it). */
export function CourseHeader({
  title,
  thumbnailUrl,
  roadmap,
}: {
  title: string
  thumbnailUrl: string | null
  roadmap: Roadmap
}) {
  return (
    <div className="mb-5" data-testid="course-header">
      <CourseArt url={thumbnailUrl} />
      <h1 className="mt-4 text-2xl leading-tight font-extrabold [overflow-wrap:anywhere]">{title}</h1>
      <div className="mt-3">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-base font-bold">
          <span data-testid="progress-text">
            {roadmap.doneLessons} of {roadmap.totalLessons} lessons
          </span>
          <span data-testid="progress-percent">{roadmap.percent}%</span>
        </div>
        <KidProgress percent={roadmap.percent} label="Course progress" />
      </div>
      {roadmap.courseComplete ? <CourseCompleteCard /> : null}
    </div>
  )
}

export function CourseCompleteCard() {
  return (
    <div className="kid-card mt-4 flex items-center gap-3 p-4" data-testid="course-complete">
      <span className="grid size-12 flex-none place-items-center rounded-full bg-gold text-ink shadow-[0_4px_0_var(--gold-d)]">
        <PartyPopper className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-extrabold">Course complete!</p>
        <p className="text-base">You finished every lesson. Amazing work!</p>
      </div>
    </div>
  )
}
