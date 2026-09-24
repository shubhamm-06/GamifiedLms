import { useState, type ReactNode } from 'react'
import { Navigate, useParams } from '@tanstack/react-router'
import { DocLesson } from '@/components/kid/player/DocLesson'
import { GameLesson } from '@/components/kid/player/GameLesson'
import { LessonCompleteSheet } from '@/components/kid/player/LessonCompleteSheet'
import { LessonPlayerShell, type PlayerMode } from '@/components/kid/player/LessonPlayerShell'
import { PlayerBar } from '@/components/kid/player/PlayerBar'
import { PrimaryButton, PrimaryLink } from '@/components/kid/player/PrimaryButton'
import {
  EnrollmentExpiredScreen,
  LessonRetryScreen,
  LessonUnavailableScreen,
  PlayerFrame,
} from '@/components/kid/player/PlayerScreens'
import { PlayerSkeleton } from '@/components/kid/player/PlayerSkeleton'
import { QuizLesson } from '@/components/kid/player/QuizLesson'
import { VideoLesson } from '@/components/kid/player/VideoLesson'
import { NotEnrolledScreen } from '@/components/kid/roadmap/StateScreens'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { useCompleteLesson, useCourseLessonStates } from '@/hooks/useLessonEngine'
import { useLessonClock } from '@/hooks/useLessonClock'
import { useEnrollmentStatus, useLessonContent, type LoadedLesson } from '@/hooks/useLessonContent'
import {
  LessonEngineError,
  describeEngineError,
  type LessonEngineErrorCode,
  type LessonStateRow,
} from '@/lib/lessonEngine'
import { clockText, nextOpenLesson } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'

/**
 * /courses/$courseId/lessons/$lessonId, the lesson player. It decides which screen
 * to show from the server's own answers (`fn_course_lesson_states`, then the lesson
 * row) and never from anything the client could forge: a locked lesson is sent back
 * to the path before its content is even requested; not enrolled, expired or
 * unpublished lessons get a plain screen. The lesson itself lives in PlayerLesson,
 * keyed by lesson id so "Next lesson" starts with a clean slate.
 */
export function LessonPlayerPage() {
  const { courseId, lessonId } = useParams({ strict: false }) as { courseId: string; lessonId: string }
  const states = useCourseLessonStates(courseId)
  const row = states.data?.find((r) => r.lessonId === lessonId) ?? null
  // Locked lessons' content is never requested: RLS would allow it, the player does not need it.
  const content = useLessonContent(lessonId, !!row && row.state !== 'locked')
  const notEnrolled = states.error?.code === 'not_enrolled'
  const enrollment = useEnrollmentStatus(courseId, notEnrolled)
  // A?loading skeleton only after 200ms, so a fast load never flashes one (spec Part A7).
  const showSkeleton = useDelayedFlag(!states.data || content.isPending, 200)

  const frame = (child: ReactNode) => <PlayerFrame courseId={courseId}>{child}</PlayerFrame>

  // The engine's refusal wins, including one that arrives while a lesson is open.
  if (notEnrolled) {
    if (enrollment.data === 'expired') return frame(<EnrollmentExpiredScreen />)
    return frame(<NotEnrolledScreen />)
  }
  if (states.error?.code === 'lesson_unavailable') return frame(<LessonUnavailableScreen courseId={courseId} />)
  // A failed background refetch must not tear down a lesson that is already on screen.
  if ((states.isError && !states.data) || (content.isError && !content.data)) {
    return frame(
      <LessonRetryScreen
        onRetry={() => {
          void states.refetch()
          void content.refetch()
        }}
      />,
    )
  }
  if (!states.data) return frame(showSkeleton ? <PlayerSkeleton /> : null)
  if (!row) return frame(<LessonUnavailableScreen courseId={courseId} />)
  if (row.state === 'locked') {
    return <Navigate to="/courses/$courseId" params={{ courseId }} search={{ open: lessonId }} replace />
  }
  if (content.isPending) return frame(showSkeleton ? <PlayerSkeleton /> : null)
  if (!content.data || content.data.lesson.courseId !== courseId) {
    return frame(<LessonUnavailableScreen courseId={courseId} />)
  }

  return (
    <PlayerLesson
      key={lessonId}
      courseId={courseId}
      loaded={content.data}
      row={row}
      states={states.data}
      statesRefreshing={states.isFetching}
    />
  )
}

const REFUSALS: ReadonlySet<LessonEngineErrorCode> = new Set<LessonEngineErrorCode>([
  'locked',
  'not_enrolled',
  'lesson_unavailable',
])

function PlayerLesson({
  courseId,
  loaded,
  row,
  states,
  statesRefreshing,
}: {
  courseId: string
  loaded: LoadedLesson
  row: LessonStateRow
  states: LessonStateRow[]
  /** True while the lesson states are refetching; the completion sheet waits so "Next lesson" is right the first time it shows. */
  statesRefreshing: boolean
}) {
  const { lesson, game } = loaded
  // Latched when the lesson opens: finishing it flips the refreshed state to
  // "completed", which must not turn the play screen into a replay under the child.
  const [mode, setMode] = useState<PlayerMode>(() => (row.state === 'completed' ? 'replay' : 'play'))
  const [xpAwarded, setXpAwarded] = useState(0)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [refusal, setRefusal] = useState<LessonEngineErrorCode | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const complete = useCompleteLesson(courseId)

  const clock = useLessonClock({
    lessonId: lesson.id,
    enabled: mode === 'play' && !refusal,
    initialSeconds: row.activeSeconds,
    minTimeSeconds: row.minTimeSeconds,
  })
  // Completed somewhere else (another tab): show it as a replay, with no XP promised.
  const shownMode: PlayerMode = mode === 'play' && clock.completedRemotely ? 'replay' : mode
  const fatal = refusal ?? clock.fatal

  const nextLessonId = nextOpenLesson(states, lesson.id)?.lessonId ?? null

  function celebrate(xp: number, already: boolean) {
    setXpAwarded(xp)
    setAlreadyDone(already)
    setMode('done')
    setSheetOpen(true)
  }

  function refuse(code: LessonEngineErrorCode) {
    if (REFUSALS.has(code)) setRefusal(code)
  }

  async function finish() {
    setFinishError(null)
    try {
      const r = await complete.mutateAsync(lesson.id)
      celebrate(r.xpAwarded, r.alreadyCompleted)
    } catch (e) {
      const code = e instanceof LessonEngineError ? e.code : 'unknown'
      if (REFUSALS.has(code)) refuse(code)
      else if (code === 'too_early') setFinishError('Almost there. Keep going for a few more seconds.')
      else if (code === 'quiz_not_passed') setFinishError('Pass the quiz first, then you can finish.')
      else setFinishError(describeEngineError(code))
    }
  }

  if (fatal === 'locked') {
    return <Navigate to="/courses/$courseId" params={{ courseId }} search={{ open: lesson.id }} replace />
  }
  if (fatal === 'not_enrolled') {
    return (
      <PlayerFrame courseId={courseId}>
        <NotEnrolledScreen />
      </PlayerFrame>
    )
  }
  if (fatal) {
    return (
      <PlayerFrame courseId={courseId}>
        <LessonUnavailableScreen courseId={courseId} variant="mid-session" />
      </PlayerFrame>
    )
  }

  const secondsLeft = Math.max(0, clock.minTimeSeconds - clock.displaySeconds)

  let body: ReactNode
  switch (lesson.type) {
    case 'video':
      body = <VideoLesson url={lesson.videoUrl} title={lesson.title} courseId={courseId} />
      break
    case 'game':
      body = <GameLesson game={game} courseId={courseId} />
      break
    case 'quiz':
      body = (
        <QuizLesson
          lesson={lesson}
          courseId={courseId}
          mode={shownMode}
          clock={clock}
          onFinish={() => void finish()}
          finishing={complete.isPending}
          finishError={finishError}
          onCompleted={(xp) => celebrate(xp, false)}
          onRefused={refuse}
        />
      )
      break
    default:
      body = <DocLesson html={lesson.contentHtml} title={lesson.title} courseId={courseId} />
  }

  // The quiz owns its own bar while it is being played; every other lesson type,
  // and every finished lesson, uses this one.
  let bar: ReactNode = null
  if (shownMode === 'done') {
    bar = (
      <PlayerBar>
        {nextLessonId ? (
          <PrimaryLink
            variant="candy"
            to="/courses/$courseId/lessons/$lessonId"
            params={{ courseId, lessonId: nextLessonId }}
            replace
            testId="next-lesson-bar"
          >
            {playerCopy.button.nextLesson}
          </PrimaryLink>
        ) : (
          <PrimaryLink variant="candy" to="/courses/$courseId" params={{ courseId }}>
            {playerCopy.button.backToRoadmap}
          </PrimaryLink>
        )}
      </PlayerBar>
    )
  } else if (lesson.type !== 'quiz') {
    bar =
      shownMode === 'replay' ? (
        <PlayerBar>
          <PrimaryLink variant="candy" to="/courses/$courseId" params={{ courseId }} testId="back-to-path">
            {playerCopy.button.backToRoadmap}
          </PrimaryLink>
        </PlayerBar>
      ) : (
        <PlayerBar hint={finishError ?? undefined}>
          <PrimaryButton
            variant={clock.timeMet ? 'candy' : 'muted'}
            loading={complete.isPending}
            onClick={() => void finish()}
            testId="finish-lesson"
          >
            {complete.isPending
              ? playerCopy.button.finishing
              : clock.timeMet
                ? playerCopy.button.finishLesson
                : playerCopy.button.keepLearning(clockText(secondsLeft))}
          </PrimaryButton>
        </PlayerBar>
      )
  }

  return (
    <>
      <p role="status" className="sr-only" data-testid="time-announce">
        {shownMode === 'play' && clock.timeMet && clock.minTimeSeconds > 0 ? playerCopy.ring.doneLabel : ''}
      </p>
      <LessonPlayerShell lesson={lesson} courseId={courseId} states={states} mode={shownMode} clock={clock} bar={bar}>
        {body}
      </LessonPlayerShell>
      <LessonCompleteSheet
        open={sheetOpen && !statesRefreshing}
        onOpenChange={setSheetOpen}
        courseId={courseId}
        xpAwarded={xpAwarded}
        alreadyDone={alreadyDone}
        nextLessonId={nextLessonId}
      />
    </>
  )
}
