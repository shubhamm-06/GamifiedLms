import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useParams } from '@tanstack/react-router'
import { Check, Clock, Sparkles } from 'lucide-react'
import { LESSON_TYPE_META } from '@/components/kid/roadmap/lessonTypeMeta'
import { DocLesson } from '@/components/kid/player/DocLesson'
import { GameLesson } from '@/components/kid/player/GameLesson'
import { LessonCompleteSheet } from '@/components/kid/player/LessonCompleteSheet'
import { LessonLayout, type LessonNav, type LessonWidth } from '@/components/kid/player/LessonLayout'
import type { LessonRailInfo } from '@/components/kid/player/LessonRail'
import { LessonStatusCard } from '@/components/kid/player/LessonStatusCard'
import { PausedNotice } from '@/components/kid/player/PausedNotice'
import { PrimaryButton } from '@/components/kid/player/PrimaryButton'
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
import { useFeature, useTerms } from '@/hooks/useSettings'
import {
  LessonEngineError,
  describeEngineError,
  type LessonEngineErrorCode,
  type LessonStateRow,
} from '@/lib/lessonEngine'
import type { PlayerMode } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { rememberLessonLeft } from '@/lib/roadmapReturn'
import { parseVideoSource, tracksPlayback } from '@/lib/video'

/**
 * /courses/$courseId/lessons/$lessonId, the lesson player. It decides which screen
 * to show from the server's own answers (`fn_course_lesson_states`, then the lesson
 * row) and never from anything the client could forge: a locked lesson is sent back
 * to the path before its content is even requested; not enrolled, expired or
 * unpublished lessons get a plain screen. The lesson itself lives in PlayerLesson,
 * keyed by lesson id so "Next lesson" starts clean.
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
  if (states.error?.code === 'lesson_unavailable') return frame(<LessonUnavailableScreen />)
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
  if (!row) return frame(<LessonUnavailableScreen />)
  if (row.state === 'locked') {
    // Below 1024px this lands on the mobile roadmap, scrolled to and wiggling the locked
    // node (the search param); at >= 1024px CoursePage itself redirects on to Home instead
    // (ui.md "Lesson pages redesign") — this one target still fits both.
    return <Navigate to="/courses/$courseId" params={{ courseId }} search={{ open: lessonId }} replace />
  }
  if (content.isPending) return frame(showSkeleton ? <PlayerSkeleton /> : null)
  if (!content.data || content.data.lesson.courseId !== courseId) {
    return frame(<LessonUnavailableScreen />)
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
  const xpOn = useFeature('xp')
  const { term } = useTerms()

  // Back brings the child to Home now, on every width (ui.md "Lesson pages redesign");
  // this memory still serves the mobile roadmap, which Home itself renders (see roadmapReturn.ts).
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
        <LessonUnavailableScreen variant="mid-session" />
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
      media = <GameLesson game={game} onComplete={onGameComplete} ack={replayAck} />
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
      media = hasBlocks ? <DocBlocks blocks={blocks.data ?? []} /> : <DocLesson html={lesson.contentHtml} title={lesson.title} />
  }

  const lessonDone = shownMode !== 'play'
  const gamified = lesson.gamificationEnabled && xpOn
  const effectiveXp = gamified ? lesson.xp : null

  // The chip row: type, minimum time (if any), and XP (gated the same way every other
  // reward is — ui.md "Gamification-off courses hide every reward").
  const { label: typeLabel, Icon: TypeIcon } = LESSON_TYPE_META[lesson.type]
  const minutes = Math.round(lesson.minTimeSeconds / 60)
  const chips = (
    <>
      <span className="rm-chip" data-testid="chip-type">
        <TypeIcon className="size-3.5" aria-hidden />
        {typeLabel}
      </span>
      {minutes > 0 ? (
        <span className="rm-chip" data-testid="chip-time">
          <Clock className="size-3.5" aria-hidden />
          {minutes} min
        </span>
      ) : null}
      {effectiveXp && effectiveXp > 0 ? (
        <span className="rm-chip" data-testid="chip-xp">
          <Sparkles className="size-3.5" aria-hidden />+{effectiveXp} {term('xp')}
        </span>
      ) : null}
    </>
  )

  // The status card and the Next/Previous row: one teal Next per state (ui.md "Lesson
  // pages redesign"), never the app-wide gold `candy` button. A quiz runs its own internal
  // flow (its own Continue/Try again/Finish, already inside `media`) and gets neither here.
  let statusCard: ReactNode = null
  let actions: ReactNode = null
  let nav: LessonNav | null = null
  if (!isQuiz) {
    if (lessonDone) {
      const justEarned = shownMode === 'done' && !alreadyDone && gamified && xpAwarded > 0
      statusCard = (
        <LessonStatusCard
          done
          icon={<Check className="size-5" strokeWidth={3} />}
          heading={playerCopy.status.done}
          sub={justEarned ? playerCopy.status.xpEarnedChip(xpAwarded) : null}
        />
      )
      nav = { previous: path.previous, next: path.next }
    } else if (finishError) {
      actions = (
        <div className="flex flex-col items-start gap-2" data-testid="lesson-hint">
          <p className="text-coral-d text-sm font-semibold" role="alert">
            {finishError}
          </p>
          <PrimaryButton
            variant="candy"
            // A game lesson finishes through completeGame, not complete: both, or a game retry stays tappable mid-request.
            loading={complete.isPending || completeGame.isPending}
            onClick={() => void finish()}
            testId="finish-retry"
          >
            {playerCopy.button.tryAgain}
          </PrimaryButton>
        </div>
      )
    } else if (manualVideo) {
      statusCard = (
        <LessonStatusCard
          done={false}
          icon={<TypeIcon className="size-5" />}
          heading={playerCopy.status.notDone.video}
          sub={effectiveXp && effectiveXp > 0 ? playerCopy.status.unlockHint(effectiveXp) : null}
        />
      )
      actions = (
        <PrimaryButton variant={clock.timeMet ? 'candy' : 'muted'} loading={complete.isPending} onClick={() => void finish()} testId="mark-complete">
          {clock.timeMet ? playerCopy.button.markComplete : playerCopy.video.manualHint}
        </PrimaryButton>
      )
    } else {
      const notDoneText = isGame ? playerCopy.status.notDone.game : isDoc ? playerCopy.status.notDone.text : playerCopy.status.notDone.video
      statusCard = (
        <LessonStatusCard
          done={false}
          icon={<TypeIcon className="size-5" />}
          heading={notDoneText}
          sub={effectiveXp && effectiveXp > 0 ? playerCopy.status.unlockHint(effectiveXp) : null}
        />
      )
      nav = { previous: path.previous, next: path.next }
    }
  }

  const rail: LessonRailInfo | null =
    path.moduleTitle && path.rows
      ? {
          sectionNumber: path.sectionNumber,
          moduleTitle: path.moduleTitle,
          position: path.position,
          total: path.total,
          done: path.done,
          percent: path.percent,
          rows: path.rows,
          gamified,
        }
      : null

  return (
    <>
      <LessonLayout
        courseId={courseId}
        courseTitle={path.courseTitle}
        width={width}
        rail={rail}
        title={lesson.title}
        chips={chips}
        description={lesson.summary?.trim() || null}
        notice={<PausedNotice reason={shownMode === 'play' ? clock.pause : null} />}
        statusCard={statusCard}
        nav={nav}
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
        nextLessonId={path.next && !path.next.locked ? path.next.id : null}
      />
    </>
  )
}
