import type { Roadmap } from '@/lib/roadmap'
import { ContinueButton } from './ContinueButton'
import { CourseArt } from './CourseArt'
import { CourseCompleteCard } from './CourseHeader'
import { KidProgress } from './KidProgress'

/**
 * Desktop (lg) left column: course art, title, progress, lessons done, XP still
 * to earn, and the Continue button (which lives here, not floating, at this width).
 */
export function SummaryCard({
  courseId,
  title,
  thumbnailUrl,
  roadmap,
}: {
  courseId: string
  title: string
  thumbnailUrl: string | null
  roadmap: Roadmap
}) {
  return (
    <div className="kid-card p-5" data-testid="summary-card">
      <CourseArt url={thumbnailUrl} />
      <h1 className="mt-4 text-2xl leading-tight font-extrabold [overflow-wrap:anywhere]">{title}</h1>
      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-base font-bold">
          <span>
            {roadmap.doneLessons} of {roadmap.totalLessons} lessons
          </span>
          <span>{roadmap.percent}%</span>
        </div>
        <KidProgress percent={roadmap.percent} label="Course progress" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-base">
        <div>
          <dt className="font-medium opacity-80">Lessons done</dt>
          <dd className="text-xl font-extrabold">{roadmap.doneLessons}</dd>
        </div>
        {roadmap.xpAvailable !== null ? (
          <div>
            <dt className="font-medium opacity-80">XP to earn</dt>
            <dd className="text-xl font-extrabold">{roadmap.xpAvailable}</dd>
          </div>
        ) : null}
      </dl>
      {roadmap.courseComplete ? (
        <CourseCompleteCard />
      ) : roadmap.currentLessonId ? (
        <div className="mt-5 flex">
          <ContinueButton courseId={courseId} lessonId={roadmap.currentLessonId} className="w-full" />
        </div>
      ) : null}
    </div>
  )
}
