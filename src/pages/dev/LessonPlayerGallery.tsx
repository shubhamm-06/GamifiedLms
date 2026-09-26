import { useState, type ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'
import { ActiveTimeRing } from '@/components/kid/player/ActiveTimeRing'
import { LessonCompleteSheet } from '@/components/kid/player/LessonCompleteSheet'
import { PausedNotice } from '@/components/kid/player/PausedNotice'
import { PlayerError } from '@/components/kid/player/PlayerError'
import { PrimaryButton, PrimaryLink } from '@/components/kid/player/PrimaryButton'
import { EnrollmentExpiredScreen, LessonRetryScreen, LessonUnavailableScreen } from '@/components/kid/player/PlayerScreens'
import { QuizQuestion } from '@/components/kid/player/QuizQuestion'
import { QuizResultView } from '@/components/kid/player/QuizResultView'
import { QuizProgress } from '@/components/kid/player/QuizProgress'
import { NotEnrolledScreen } from '@/components/kid/roadmap/StateScreens'
import { playerCopy } from '@/lib/playerCopy'
import type { QuizQuestionView } from '@/lib/lessonPlayer'

/**
 * DEV ONLY. Every state from the UI/UX spec's Parts B3, B7, B8, B9, B10 and
 * A7 with fixture data, so each can be screenshotted without a live database
 * or real progress. Never registered as a route outside `import.meta.env.DEV`
 * (see router.tsx) and never linked from anywhere a child could reach.
 */

const FIXTURE_QUESTION: QuizQuestionView = {
  id: 'q1',
  prompt: 'Which number comes after 9?',
  options: [
    { id: 'a', text: '8' },
    { id: 'b', text: '10' },
    { id: 'c', text: '11' },
  ],
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kid-card mb-6 p-5" style={{ maxWidth: 480 }}>
      <h2 className="kid-text-heading mb-4">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="kid-text-caption mb-1 opacity-70">{label}</p>
      {children}
    </div>
  )
}

export function LessonPlayerGallery() {
  const [selected, setSelected] = useState('b')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetVariant, setSheetVariant] = useState<'xp' | 'noxp' | 'already' | 'next'>('xp')

  return (
    <div className="kid-app kid-font mx-auto max-w-2xl p-6" data-testid="dev-gallery">
      <h1 className="kid-text-display mb-6">Lesson player gallery (dev only)</h1>

      <Section title="B3: primary button states">
        <Row label="time not met, muted">
          <PrimaryButton variant="muted">{playerCopy.button.keepLearning('0:42')}</PrimaryButton>
        </Row>
        <Row label="time met, candy">
          <PrimaryButton variant="candy">{playerCopy.button.finishLesson}</PrimaryButton>
        </Row>
        <Row label="finishing, spinner">
          <PrimaryButton variant="candy" loading>
            {playerCopy.button.finishing}
          </PrimaryButton>
        </Row>
        <Row label="secondary">
          <PrimaryButton variant="secondary">{playerCopy.button.tryAgain}</PrimaryButton>
        </Row>
        <Row label="as a link">
          <PrimaryLink variant="candy" to="/">
            {playerCopy.button.nextLesson}
          </PrimaryLink>
        </Row>
      </Section>

      <Section title="B2: active time ring">
        <Row label="counting, 40%">
          <ActiveTimeRing seconds={40} minSeconds={100} timeMet={false} pause={null} />
        </Row>
        <Row label="paused (dimmed)">
          <ActiveTimeRing seconds={40} minSeconds={100} timeMet={false} pause="hidden" />
        </Row>
        <Row label="time met (check, pop)">
          <ActiveTimeRing seconds={100} minSeconds={100} timeMet pause={null} />
        </Row>
        <Row label="offline banner">
          <PausedNotice reason="offline" />
        </Row>
        <Row label="reconnecting banner">
          <PausedNotice reason="connection" />
        </Row>
      </Section>

      <Section title="A7: error and empty states">
        <Row label="error, with retry">
          <PlayerError heading={playerCopy.error.heading} body={playerCopy.error.body} action={{ kind: 'retry', onRetry: () => {} }} />
        </Row>
        <Row label="empty, with back link">
          <PlayerError
            heading={playerCopy.quiz.empty.heading}
            body={playerCopy.quiz.empty.body}
            icon={<ClipboardList className="size-7" />}
            action={{ kind: 'back', courseId: 'demo' }}
          />
        </Row>
      </Section>

      <Section title="B7: quiz question (one at a time, feedback on the buttons)">
        <Row label="progress bar (2 of 5 answered)">
          <QuizProgress done={2} total={5} />
        </Row>
        <Row label="unanswered">
          <QuizQuestion question={FIXTURE_QUESTION} index={0} total={3} selected={selected} checking={false} correctOption={null} onSelect={setSelected} />
        </Row>
        <Row label="answered right (teal, check)">
          <QuizQuestion question={FIXTURE_QUESTION} index={0} total={3} selected="b" checking={false} correctOption="b" onSelect={() => {}} />
        </Row>
        <Row label="answered wrong (coral X, the right one teal)">
          <QuizQuestion question={FIXTURE_QUESTION} index={0} total={3} selected="a" checking={false} correctOption="b" onSelect={() => {}} />
        </Row>
      </Section>

      <Section title="B7: results screen">
        <Row label="passed">
          <QuizResultView score={4} maxScore={5} passed passPercentage={60} practice={false} />
        </Row>
        <Row label="failed (so close)">
          <QuizResultView score={2} maxScore={5} passed={false} passPercentage={60} practice={false} />
        </Row>
        <Row label="practice round (replay)">
          <QuizResultView score={3} maxScore={5} passed={false} passPercentage={60} practice />
        </Row>
      </Section>

      <Section title="B8: completion sheet">
        <Row label="open the sheet">
          <div className="flex flex-wrap gap-2">
            <button className="candy-btn-quiet kid-tap" onClick={() => (setSheetVariant('xp'), setSheetOpen(true))}>
              XP awarded
            </button>
            <button className="candy-btn-quiet kid-tap" onClick={() => (setSheetVariant('noxp'), setSheetOpen(true))}>
              No XP (gamification off)
            </button>
            <button className="candy-btn-quiet kid-tap" onClick={() => (setSheetVariant('already'), setSheetOpen(true))}>
              Already done (repeat)
            </button>
            <button className="candy-btn-quiet kid-tap" onClick={() => (setSheetVariant('next'), setSheetOpen(true))}>
              With Next lesson
            </button>
          </div>
        </Row>
      </Section>

      <Section title="B9 and B10: edge screens">
        <Row label="not enrolled">
          <NotEnrolledScreen />
        </Row>
        <Row label="enrollment expired">
          <EnrollmentExpiredScreen />
        </Row>
        <Row label="lesson unavailable (initial)">
          <LessonUnavailableScreen courseId="demo" variant="initial" />
        </Row>
        <Row label="lesson unavailable (mid-session / unpublished)">
          <LessonUnavailableScreen courseId="demo" variant="mid-session" />
        </Row>
        <Row label="retry (network)">
          <LessonRetryScreen onRetry={() => {}} />
        </Row>
      </Section>

      <LessonCompleteSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        courseId="demo"
        xpAwarded={sheetVariant === 'noxp' || sheetVariant === 'already' ? 0 : 15}
        alreadyDone={sheetVariant === 'already'}
        nextLessonId={sheetVariant === 'next' ? 'next-lesson' : null}
      />
    </div>
  )
}
