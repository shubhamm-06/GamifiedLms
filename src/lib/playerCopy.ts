/**
 * All player-facing copy in one place, per the UI/UX spec (Part A8): short
 * sentences, simple words, second person, encouraging, no blame for a wrong
 * answer, no em dashes, at most one exclamation mark per screen. Kept as
 * plain strings (not JSX) so this file can be reviewed or translated without
 * touching a component.
 */
export const playerCopy = {
  button: {
    keepLearning: (clock: string) => `Keep learning, ${clock} left`,
    finishLesson: 'Finish lesson',
    startQuiz: 'Start quiz',
    check: 'Check',
    continueReview: 'Continue',
    tryAgain: 'Try again',
    backToRoadmap: 'Back to roadmap',
    nextLesson: 'Continue to next lesson',
    finishing: 'Finishing',
    checking: 'Checking',
    back: 'Back',
    next: 'Next',
    playGame: 'Play',
    playVideo: 'Play video',
    openFullScreen: 'Open full screen',
  },
  ring: {
    label: 'Learning time',
    popover: (elapsed: string, min: string) => `Learning time: ${elapsed} of ${min}`,
    doneLabel: 'Time is up. You can finish the lesson.',
  },
  page: {
    countOf: (done: number, total: number) => `${done} of ${total}`,
    lessonsInModule: 'Lessons',
    nextTag: 'Next',
    done: 'Done',
    play: 'Play',
    playAgain: 'Play again',
    nextLesson: (title: string) => `Next: ${title}`,
    describe: {
      video: 'Watch the story.',
      game: 'Play the game.',
      text: 'Read the story.',
      quiz: 'Answer the questions.',
    },
    rowState: {
      done: 'done',
      current: 'you are here',
      next: 'up next',
      locked: 'locked',
      open: 'ready',
    },
  },
  offline: 'You are offline. We will save your progress when you are back.',
  reconnecting: "We can't reach the server right now. We'll keep trying.",
  loading: 'Getting your lesson ready.',
  error: {
    heading: 'Oops, something slipped',
    body: 'Check your internet and try again.',
    tryAgain: 'Try again',
  },
  video: {
    controls: {
      group: 'Video controls',
      play: 'Play',
      pause: 'Pause',
      replay: 'Replay from the start',
      seek: 'Seek',
      mute: 'Mute',
      unmute: 'Unmute',
      volume: 'Volume',
      fullscreen: 'Full screen',
      exitFullscreen: 'Exit full screen',
    },
    watchTime: (elapsed: string, min: string) => `Watch time ${elapsed} of ${min}`,
    unavailable: {
      heading: "This video isn't ready",
      body: "We can't play this video right now. Please check back soon.",
    },
    failed: {
      heading: "This video won't load",
      body: 'Check your internet and try again.',
    },
  },
  doc: {
    empty: {
      heading: "There's nothing to read yet",
      body: 'Please check back soon.',
    },
  },
  game: {
    playHint: 'Tap play to start the game.',
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
    headline: 'Lesson done!',
    encouragement: 'Great job. Keep it up!',
    alreadyDone: "You already finished this one",
    xp: (n: number) => `+${n} XP`,
  },
  replay: {
    chip: 'Completed',
    quizPracticeNote: 'You can practice this quiz again. It will not change your score.',
  },
  edge: {
    notEnrolled: {
      heading: "This course isn't on your list yet",
      body: 'Ask a grown up to help you get started.',
    },
    expired: {
      heading: 'Your course time is over',
      body: 'Ask a grown up if you would like more time.',
      button: 'Back to home',
    },
    unavailableInitial: {
      heading: "This lesson isn't ready",
      body: "Please check back soon. Your path is waiting for you.",
    },
    unavailableMidSession: {
      heading: 'This lesson is being updated',
      body: 'Please check back soon.',
    },
    locked: {
      heading: 'Not yet',
    },
  },
} as const
