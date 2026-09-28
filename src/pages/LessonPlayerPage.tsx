import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useParams } from '@tanstack/react-router'
import { ActivityCard } from '@/components/kid/player/ActivityCard'
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
import { DocBlocks } from '@/components/kid/player/DocBlocks'
import { DocInfo } from '@/components/kid/player/LessonStatus'
import { VideoInfo } from '@/components/kid/player/VideoInfo'
import { VideoLesson } from '@/components/kid/player/VideoLesson'
import { NotEnrolledScreen } from '@/components/kid/roadmap/StateScreens'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { useLeaveGuard } from '@/hooks/useBackClosable'
import { useCompleteGame, useCompleteLesson, useCourseLessonStates } from '@/hooks/useLessonEngine'
import { useLessonClock } from '@/hooks/useLessonClock'
import { useEnrollmentStatus, useLessonContent, type LoadedLesson } from '@/hooks/useLessonContent'
import { useLessonBlocks } from '@/hooks/useLessonBlocks'
import { useModulePath } from '@/hooks/useModulePath'
import {
  LessonEngineError,
  describeEngineError,
  type LessonEngineErrorCode,
  type LessonStateRow,
} from '@/lib/lessonEngine'
import { gameIsPlayable, nextOpenLesson, videoIsPlayable } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { rememberLessonLeft } from '@/lib/roadmapReturn'

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
  // A loading skeleton only after 200ms, so a fast load never flashes one.
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
  const [played, setPlayed] = useState(false)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [refusal, setRefusal] = useState<LessonEngineErrorCode | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const complete = useCompleteLesson(courseId)
  const completeGame = useCompleteGame(courseId)
  const path = useModulePath(courseId, states, lesson.id)

  // A video lesson counts active time only while the video is really playing, and
  // completes only once it has also played to its end (the server checks the time).
  // Back brings the child to this lesson's node on the roadmap (`roadmapReturn`).
  useEffect(() => rememberLessonLeft(lesson.id), [lesson.id])
  const isVideo = lesson.type === 'video'
  // A doc lesson with content blocks (migration 023) gets its own single-column page; one
  // without keeps the older HTML frame. A failed blocks fetch counts as no blocks.
  const isDoc = lesson.type === 'text'
  const blocks = useLessonBlocks(lesson.id, isDoc)
  const blocksPending = isDoc && blocks.isPending
  const hasBlocks = isDoc && (blocks.data?.length ?? 0) > 0
  const isQuiz = lesson.type === 'quiz'
  const isGame = lesson.type === 'game'
  const singleColumn = isVideo || hasBlocks || isQuiz || isGame
  // A game lesson completes through the game: its first valid completion message (the score) is
  // held here, sent to the server once the minimum time is met, and the server decides the XP.
  const [gameScore, setGameScore] = useState<number | null>(null)
  const [replayAck, setReplayAck] = useState<string | null>(null)
  const ackTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(ackTimer.current), [])
  const videoPlayable = isVideo && videoIsPlayable(lesson.videoUrl)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const onVideoEnded = useCallback(() => setVideoEnded(true), [])

  const clock = useLessonClock({
    lessonId: lesson.id,
    enabled: mode === 'play' && !refusal,
    initialSeconds: row.activeSeconds,
    minTimeSeconds: row.minTimeSeconds,
    active: videoPlayable ? videoPlaying : true,
  })
  // Completed somewhere else (another tab): show it as a replay, with no XP promised.
  const shownMode: PlayerMode = mode === 'play' && clock.completedRemotely ? 'replay' : mode
  const fatal = refusal ?? clock.fatal
  const nextLessonId = nextOpenLesson(states, lesson.id)?.lessonId ?? null
  // A game in play: Android Back asks "Leave this lesson?" first (video and doc lessons do not).
  useLeaveGuard(isGame && shownMode === 'play' && !fatal)

  // A video or game waits for the child's Play tap. One that cannot load at all
  // shows its error straight away instead of offering a Play that leads nowhere.
  const playable =
    lesson.type === 'video' ? videoIsPlayable(lesson.videoUrl) : lesson.type === 'game' ? gameIsPlayable(game) : false
  const needsPlay = playable && !played && !isVideo && lesson.type !== 'game'

  function celebrate(xp: number, already: boolean) {
    setXpAwarded(xp)
    setAlreadyDone(already)
    setMode('done')
    setSheetOpen(true)
  }

  function refuse(code: LessonEngineErrorCode) {
    if (REFUSALS.has(code)) setRefusal(code)
  }

  function onGameComplete(score: number) {
    if (shownMode === 'play') {
      setGameScore((prev) => prev ?? score)
      return
    }
    // A finished lesson replayed for fun: nothing to send, nothing to award.
    setReplayAck(playerCopy.game.replayAck)
    window.clearTimeout(ackTimer.current)
    ackTimer.current = window.setTimeout(() => setReplayAck(null), 5000)
  }

  async function finish() {
    try {
      const r = isGame
        ? await completeGame.mutateAsync({ lessonId: lesson.id, score: gameScore ?? 0 })
        : await complete.mutateAsync(lesson.id)
      setFinishError(null)
      celebrate(r.xpAwarded, r.alreadyCompleted)
    } catch (e) {
      const code = e instanceof LessonEngineError ? e.code : 'unknown'
      if (REFUSALS.has(code)) refuse(code)
      else setFinishError(describeEngineError(code))
    }
  }

  // AUTO-FINISH (decided 2026-09-24, replacing the Finish button). Once the
  // server says the minimum time is met, and for a video or game once the child
  // has tapped Play, the page itself asks the existing fn_complete_lesson. Only
  // the trigger moved: the server still checks enrollment, unlock and time.
  // Quizzes keep their own flow. One automatic attempt per open; a failure shows
  // a Try again button, so a refused call is never retried in a loop.
  const autoTried = useRef(false)
  const gameReady = isGame && shownMode === 'play' && !fatal && gameScore !== null && clock.timeMet
  useEffect(() => {
    if (!gameReady || autoTried.current) return
    autoTried.current = true
    void finish()
    // Once per visit, like the other lesson types; `finish` is re-created every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameReady])
  const readyToFinish =
    shownMode === 'play' &&
    !fatal &&
    !blocksPending &&
    lesson.type !== 'quiz' &&
    !isGame &&
    clock.timeMet &&
    (videoPlayable ? videoEnded : played || !playable)
  useEffect(() => {
    if (!readyToFinish || autoTried.current) return
    autoTried.current = true
    void finish()
    // `finish` is re-created on every render; the ref makes this fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToFinish])

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

  // The blocks decide the layout, so nothing shows (and nothing can complete) until they arrive.
  if (blocksPending) {
    return (
      <PlayerFrame courseId={courseId}>
        <PlayerSkeleton />
      </PlayerFrame>
    )
  }

  let media: ReactNode
  switch (lesson.type) {
    case 'video':
      media = (
        <VideoLesson
          url={lesson.videoUrl}
          title={lesson.title}
          courseId={courseId}
          onPlayingChange={setVideoPlaying}
          onEnded={onVideoEnded}
        />
      )
      break
    case 'game':
      media = <GameLesson game={game} courseId={courseId} onComplete={onGameComplete} ack={replayAck} />
      break
    case 'quiz':
      media = (
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
      media = hasBlocks ? (
        <DocBlocks blocks={blocks.data ?? []} />
      ) : (
        <DocLesson html={lesson.contentHtml} title={lesson.title} courseId={courseId} />
      )
  }

  const lessonDone = shownMode !== 'play'
  // The one bottom button, only once this lesson is completed: "Next: <title>"
  // for the next lesson in this module, "Back to roadmap" after the module's last.
  // A quiz in replay keeps its own bar, so it gets none here. Otherwise there is
  // no bottom button, except Try again if the automatic finish failed.
  let bar: ReactNode = null
  // A video lesson has no Next / Back bar: the completion sheet's one button is its only
  // next step, and Back in the top bar leaves.
  if (lessonDone && !singleColumn && !(lesson.type === 'quiz' && shownMode === 'replay')) {
    const following = path.following
    bar = (
      <PlayerBar>
        {following && following.state !== 'locked' ? (
          <PrimaryLink
            variant="candy"
            to="/courses/$courseId/lessons/$lessonId"
            params={{ courseId, lessonId: following.id }}
            replace
            testId="next-lesson-bar"
          >
            <span className="truncate px-4">{playerCopy.page.nextLesson(following.title)}</span>
          </PrimaryLink>
        ) : (
          <PrimaryLink variant="candy" to="/courses/$courseId" params={{ courseId }} testId="back-to-path">
            {playerCopy.button.backToRoadmap}
          </PrimaryLink>
        )}
      </PlayerBar>
    )
  } else if (finishError && lesson.type !== 'quiz') {
    bar = (
      <PlayerBar hint={finishError}>
        <PrimaryButton variant="candy" loading={complete.isPending} onClick={() => void finish()} testId="finish-retry">
          {playerCopy.button.tryAgain}
        </PrimaryButton>
      </PlayerBar>
    )
  }

  return (
    <>
      <LessonPlayerShell
        lesson={lesson}
        courseId={courseId}
        path={path}
        mode={shownMode}
        pause={clock.pause}
        bar={bar}
        variant={isVideo ? 'video' : hasBlocks ? 'doc' : isQuiz ? 'quiz' : isGame ? 'game' : undefined}
        info={
          hasBlocks ? (
            <DocInfo
              title={lesson.title}
              xp={shownMode === 'play' && lesson.gamificationEnabled ? lesson.xp : null}
              done={lessonDone}
              seconds={clock.displaySeconds}
              minSeconds={clock.minTimeSeconds}
              timeMet={clock.timeMet}
            />
          ) : isVideo ? (
            <VideoInfo
              title={lesson.title}
              description={lesson.summary?.trim() || null}
              xp={shownMode === 'play' && lesson.gamificationEnabled ? lesson.xp : null}
              done={lessonDone}
              seconds={clock.displaySeconds}
              minSeconds={clock.minTimeSeconds}
              timeMet={clock.timeMet}
            />
          ) : undefined
        }
      >
        {isVideo || hasBlocks || isQuiz || isGame ? (
          media
        ) : (
          <ActivityCard lesson={lesson} done={lessonDone} needsPlay={needsPlay} onPlay={() => setPlayed(true)}>
            {media}
          </ActivityCard>
        )}
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
