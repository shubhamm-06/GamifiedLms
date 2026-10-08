/**
 * All player-facing copy in one place, per the UI/UX spec (Part A8): short
 * sentences, simple words, second person, encouraging, no blame for a wrong
 * answer, no em dashes, at most one exclamation mark per screen. Kept as
 * plain strings (not JSX) so this file can be reviewed or translated without
 * touching a component. Term words (lesson, course, XP, ...) come from the
 * terminology settings through getters, so they are read when shown.
 */
import { getTerms as t } from '@/lib/settings/terms'

export const playerCopy = {
  button: {
    keepLearning: (clock: string) => `Keep learning, ${clock} left`,
    get finishLesson() { return `Finish ${t().lower('lesson')}` },
    check: 'Check',
    continueReview: 'Continue',
    tryAgain: 'Try again',
    backToRoadmap: 'Back to roadmap',
    get nextLesson() { return `Continue to next ${t().lower('lesson')}` },
    get nextLessonShort() { return `Next ${t().lower('lesson')}` },
    previous: 'Previous',
    markComplete: 'Mark as complete',
    finishing: 'Finishing',
    checking: 'Checking',
    back: 'Back',
    next: 'Next',
  },
  ring: {
    label: 'Learning time',
    popover: (elapsed: string, min: string) => `Learning time: ${elapsed} of ${min}`,
    get doneLabel() { return `Time is up. You can finish the ${t().lower('lesson')}.` },
  },
  page: {
    get complete() { return `${t().term('lesson')} complete` },
    context: (module: string, n: number, total: number) => `${module} · ${t().term('lesson')} ${n} of ${total}`,
  },
  offline: 'You are offline. We will save your progress when you are back.',
  reconnecting: "We can't reach the server right now. We'll keep trying.",
  get loading() { return `Getting your ${t().lower('lesson')} ready.` },
  error: {
    heading: 'Oops, something slipped',
    body: 'Check your internet and try again.',
    tryAgain: 'Try again',
  },
  video: {
    unavailable: "This video can't be shown right now",
    get watchToEnd() { return `Watch the whole video to finish this ${t().lower('lesson')}.` },
    get watchAgain() { return `Watch it once more to finish this ${t().lower('lesson')}.` },
    manualHint: 'Watch the video, then mark it as complete.',
  },
  doc: {
    get keepReading() { return `Take your time. This ${t().lower('lesson')} finishes on its own.` },
    empty: {
      heading: "There's nothing to read yet",
      body: 'Please check back soon.',
    },
  },
  game: {
    loading: 'Getting your game ready.',
    get replayAck() { return `Nice replay! No ${t().lower('xp', true)} this time.` },
    unavailable: {
      heading: "This game isn't ready",
      body: 'Please check back soon.',
    },
    failed: {
      heading: "This game won't load",
      body: 'Check your internet and try again.',
    },
    rotateSideways: 'This game is more fun sideways. Turn your phone.',
    rotateUpright: 'This game is best played with your phone upright.',
  },
  quiz: {
    questionCount: (i: number, total: number) => `Question ${i} of ${total}`,
    feedbackCorrect: 'Nice one!',
    feedbackWrong: 'Almost',
    spokenCorrect: 'Correct',
    spokenWrong: 'Not quite',
    spokenRightAnswer: 'The right answer',
    progressLabel: 'Quiz progress',
    xpEarned: (n: number) => `+${n} ${t().term('xp')} earned`,
    empty: {
      heading: "This quiz isn't ready yet",
      body: 'Please check back soon.',
    },
    loadFailed: {
      heading: "This quiz won't load",
      body: 'Check your internet and try again.',
    },
    resultsPassedHeading: 'You did it!',
    resultsFailedHeading: 'So close!',
    scoreLine: (score: number, max: number) => `${score} of ${max}`,
    passMark: (need: number, max: number) => `You need ${need} of ${max} to pass`,
    practiceRound: 'Practice round',
    practiceScore: (score: number, max: number) => `You got ${score} of ${max} right`,
  },
  complete: {
    get headline() { return `${t().term('lesson')} done!` },
    encouragement: 'Great job. Keep it up!',
    alreadyDone: "You already finished this one",
    xp: (n: number) => `+${n} ${t().term('xp')}`,
  },
  replay: {
    quizPracticeNote: 'You can practice this quiz again. It will not change your score.',
  },
  edge: {
    notEnrolled: {
      get heading() { return `This ${t().lower('course')} isn't on your list yet` },
      body: 'Ask a grown up to help you get started.',
    },
    expired: {
      get heading() { return `Your ${t().lower('course')} time is over` },
      body: 'Ask a grown up if you would like more time.',
      button: 'Back to home',
    },
    unavailableInitial: {
      get heading() { return `This ${t().lower('lesson')} hasn't launched yet` },
      body: 'Something fun is on its way. Your path is waiting for you!',
    },
    unavailableMidSession: {
      get heading() { return `This ${t().lower('lesson')} is being updated` },
      body: 'Please check back soon.',
    },
    locked: {
      heading: 'Not yet',
    },
  },
} as const
