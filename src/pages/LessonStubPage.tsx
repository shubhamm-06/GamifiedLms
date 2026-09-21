import { Link, useParams } from '@tanstack/react-router'
import { Hammer } from 'lucide-react'
import { useKidHeader } from '@/components/kid/kidHeader'

/**
 * TEMPORARY. /courses/$courseId/lessons/$lessonId exists only so the roadmap's
 * Start / Keep going / Review / Continue have somewhere to land. The real lesson
 * player (video, game, quiz, text) replaces this page's body; the route and its
 * params stay. Delete this comment with the stub.
 */
export function LessonStubPage() {
  const { courseId } = useParams({ strict: false }) as { courseId: string; lessonId: string }
  useKidHeader('Lesson', `/courses/${courseId}`)

  return (
    <div className="kid-card mx-auto mt-6 max-w-md p-6 text-center" data-testid="lesson-stub" role="status">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-teal text-ink shadow-[0_5px_0_var(--teal-d)]">
        <Hammer className="size-8" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl leading-tight font-extrabold">Lesson player coming soon</h1>
      <p className="mt-2 text-base">We&rsquo;re still building this part. Your path is waiting for you!</p>
      <div className="mt-5 flex justify-center">
        <Link to="/courses/$courseId" params={{ courseId }} className="candy-btn kid-tap">
          Back to my path
        </Link>
      </div>
    </div>
  )
}
