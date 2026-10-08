import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { DocLesson } from '@/components/kid/player/DocLesson'
import { GameLesson } from '@/components/kid/player/GameLesson'
import { LessonCompleteSheet } from '@/components/kid/player/LessonCompleteSheet'
import { LessonLayout, type LessonWidth } from '@/components/kid/player/LessonLayout'
import { PausedNotice } from '@/components/kid/player/PausedNotice'
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
import { VideoPlayer } from '@/components/kid/player/VideoPlayer'
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
import { nextOpenLesson, type PlayerMode } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { rememberLessonLeft } from '@/lib/roadmapReturn'
import { parseVideoSource, tracksPlayback } from '@/lib/video'

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
  const [xpAwarded, setXpAwarded] = useState(0)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [refusal, setRefusal] = useState<LessonEngineErrorCode | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const complete = useCompleteLesson(courseId)
  const completeGame = useCompleteGame(courseId)
  const path = useModulePath(courseId, states, lesson.id)

  // Back brings the child to this lesson's node on the roadmap (`roadmapReturn`).
  useEffect(() => rememberLessonLeft(lesson.id), [lesson.id])
  const isVideo = lesson.type === 'video'
  // A doc lesson with content blocks (migration 023) shows its blocks; one without keeps the
  // older sandboxed HTML frame. A failed blocks fetch counts as no blocks.
  const isDoc = lesson.type === 'text'
  const blocks = useLessonBlocks(lesson.id, isDoc)
  const blocksPending = isDoc && blocks.isPending
  const hasBlocks = isDoc && (blocks.data?.length ?? 0) > 0
  const isQuiz = lesson.type === 'quiz'
  const isGame = lesson.type === 'game'
  // A game lesson completes through the game: its first valid completion message (the score) is
  // held here, sent to the server once the minimum time is met, and the server decides the XP.
  const [gameScore, setGameScore] = useState<number | null>(null)
  const [replayAck, setReplayAck] = useState<string | null>(null)
  const ackTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(ackTimer.current), [])

  // VIDEO. The source is parsed at render time (stored URLs and older raw values alike).
  // A file, YouTube or Vimeo reports play and end: active time counts only while it plays
  // (a stop is reported after 1 s so a buffering blip does not stop the clock), and the
  // lesson completes once the server says the time is met AND it has played to its end.
  // Loom and Wistia report nothing, so time counts while the page is open and the child
  // taps "Mark as complete" (the server still checks the time). No source: time only.
  const parsed = isVideo ? parseVideoSource(lesson.videoUrl, { allowHttp: import.meta.env.DEV }) : null
  const videoSource = parsed?.ok ? parsed.source : null
  const tracked = !!videoSource && tracksPlayback(videoSource)
  const manualVideo = !!videoSource && !tracked
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const stopTimer = useRef<number | undefined>(undefined)
  const onPlayingChange = useCallback((playing: boolean) => {
    window.clearTimeout(stopTimer.current)
    if (playing) setVideoPlaying(true)
    else stopTimer.current = window.setTimeout(() => setVideoPlaying(false), 1000)
  }, [])
  useEffect(() => () => window.clearTimeout(stopTimer.current), [])
  const onVideoEnded = useCallback(() => setVideoEnded(true), [])

  const clock = useLessonClock({
    lessonId: lesson.id,
    enabled: mode === 'play' && !refusal,
    initialSeconds: row.activeSeconds,
    minTimeSeconds: row.minTimeSeconds,
    active: tracked ? videoPlaying : true,
  })
  // Completed somewhere else (another tab): show it as a replay, with no XP promised.
  const shownMode: PlayerMode = mode === 'play' && clock.completedRemotely ? 'replay' : mode
  const fatal = refusal ?? clock.fatal
  const nextLessonId = nextOpenLesson(states, lesson.id)?.lessonId ?? null
  // A game in play: Android Back asks "Leave this lesson?" first (video and doc lessons do not).
  useLeaveGuard(isGame && shownMode === 'play' && !fatal)

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

  // AUTO-FINISH (decided 2026-09-24). Once the server says the minimum time is met, and for
  // a tracked video once it has also played to its end, the page itself asks the existing
  // fn_complete_lesson. The server still checks enrollment, unlock and time. Quizzes keep
  // their own flow; a Loom or Wistia video finishes from its button. One automatic attempt
  // per open; a failure shows a Try again button, so a refused call is never retried in a loop.
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
    !isQuiz &&
    !isGame &&
    !manualVideo &&
    clock.timeMet &&
    (tracked ? videoEnded : true)
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

  // The blocks decide the content, so nothing shows (and nothing can complete) until they arrive.
  if (blocksPending) {
    return (
      <PlayerFrame courseId={courseId}>
        <PlayerSkeleton />
      </PlayerFrame>
    )
  }

  let media: ReactNode
  let width: LessonWidth
  switch (lesson.type) {
    case 'video':
      width = 'video'
      media = (
        <VideoPlayer
          source={videoSource}
          title={lesson.title}
          onPlayingChange={tracked ? onPlayingChange : undefined}
          onEnded={tracked ? onVideoEnded : undefined}
        />
      )
      break
    case 'game':
      width = 'game'
      media = <GameLesson game={game} courseId={courseId} onComplete={onGameComplete} ack={replayAck} />
      break
    case 'quiz':
      width = 'quiz'
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
      width = 'doc'
      media = hasBlocks ? (
        <DocBlocks blocks={blocks.data ?? []} />
      ) : (
        <DocLesson html={lesson.contentHtml} title={lesson.title} courseId={courseId} />
      )
  }

  const lessonDone = shownMode !== 'play'
  // The action area: one gold action per state, "Previous" as a quiet link. A quiz runs its
  // own buttons, so it gets none here.
  const following = path.following
  const followingOpen = !!following && states.find((s) => s.lessonId === following.id)?.state !== 'locked'
  let primary: ReactNode = null
  let hint: string | null = null
  if (lessonDone) {
    primary =
      following && followingOpen ? (
        <PrimaryLink
          variant="candy"
          to="/courses/$courseId/lessons/$lessonId"
          params={{ courseId, lessonId: following.id }}
          replace
          testId="next-lesson"
        >
          {playerCopy.button.nextLessonShort}
        </PrimaryLink>
      ) : (
        <PrimaryLink variant="candy" to="/courses/$courseId" params={{ courseId }} replace testId="back-to-path">
          {playerCopy.button.backToRoadmap}
        </PrimaryLink>
      )
  } else if (finishError) {
    hint = finishError
    primary = (
      <PrimaryButton
        variant="candy"
        // A game lesson finishes through completeGame, not complete: both, or a game retry stays tappable mid-request.
        loading={complete.isPending || completeGame.isPending}
        onClick={() => void finish()}
        testId="finish-retry"
      >
        {playerCopy.button.tryAgain}
      </PrimaryButton>
    )
  } else if (manualVideo) {
    hint = clock.timeMet ? null : playerCopy.video.manualHint
    primary = (
      <PrimaryButton
        variant={clock.timeMet ? 'candy' : 'muted'}
        loading={complete.isPending}
        onClick={() => void finish()}
        testId="mark-complete"
      >
        {playerCopy.button.markComplete}
      </PrimaryButton>
    )
  } else if (tracked) {
    // Played to the end but the server's minimum time is longer than one viewing.
    hint = videoEnded && !clock.timeMet ? playerCopy.video.watchAgain : playerCopy.video.watchToEnd
  } else if (isDoc && !clock.timeMet && clock.minTimeSeconds > 0) {
    hint = playerCopy.doc.keepReading
  }

  const previous = path.previous
  const actions = isQuiz ? null : (
    <>
      {lessonDone ? (
        <p className="flex items-center gap-2 font-bold text-teal-d" data-testid="lesson-complete">
          <Check className="size-5" strokeWidth={3} aria-hidden />
          {playerCopy.page.complete}
        </p>
      ) : null}
      {hint ? (
        <p className="text-base text-ink/80" data-testid="lesson-hint">
          {hint}
        </p>
      ) : null}
      {primary}
      {previous ? (
        <Link
          to="/courses/$courseId/lessons/$lessonId"
          params={{ courseId, lessonId: previous.id }}
          replace
          className="kid-tap inline-flex min-h-11 items-center text-base text-ink/70 underline underline-offset-4"
          data-testid="previous-lesson"
        >
          {playerCopy.button.previous}
        </Link>
      ) : null}
    </>
  )

  const context = path.moduleTitle && path.position > 0 ? playerCopy.page.context(path.moduleTitle, path.position, path.total) : null

  return (
    <>
      <LessonLayout
        courseId={courseId}
        width={width}
        context={context}
        title={lesson.title}
        description={lesson.summary?.trim() || null}
        notice={<PausedNotice reason={shownMode === 'play' ? clock.pause : null} />}
        actions={actions}
      >
        <div className="contents" data-testid="lesson-player" data-mode={shownMode} data-type={lesson.type}>
          {media}
        </div>
      </LessonLayout>
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
