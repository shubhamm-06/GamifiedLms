import type { ComponentType, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { useCountUp } from '@/hooks/useCountUp'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { playerCopy } from '@/lib/playerCopy'
import { Confetti } from './Confetti'

type TextSlot = ComponentType<{ className?: string; children?: ReactNode }>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  /** XP awarded by THIS completion, from the server reply. 0 means none (a replay, or a course that awards no XP). */
  xpAwarded: number
  /** True when this call found the lesson already completed (a race, or a repeat): no XP line, no confetti. */
  alreadyDone: boolean
  /** The next lesson, only if the server says it is open. */
  nextLessonId: string | null
}

const TITLE_CLASS = 'mt-4 text-center kid-text-display text-ink [font-family:var(--font-kid)]!'

function Body({
  courseId,
  xpAwarded,
  alreadyDone,
  nextLessonId,
  open,
  Title,
  Description,
}: Omit<Props, 'onOpenChange'> & { Title: TextSlot; Description: TextSlot }) {
  const xp = useCountUp(xpAwarded, 600, open && xpAwarded > 0)
  return (
    <div className="px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center" data-testid="complete-sheet">
      <div className="relative">
        {xpAwarded > 0 && !alreadyDone ? <Confetti /> : null}
        <div className="lp-medallion" aria-hidden="true">
          <Check className="size-9" strokeWidth={3.5} />
        </div>
      </div>
      <Title className={TITLE_CLASS}>{playerCopy.complete.headline}</Title>
      <Description className="mt-2 kid-text-body text-ink">
        {alreadyDone ? playerCopy.complete.alreadyDone : playerCopy.complete.encouragement}
      </Description>
      {xpAwarded > 0 && !alreadyDone ? (
        <p className="lp-xp kid-num" data-testid="xp-earned">
          <Sparkles className="size-5" aria-hidden />
          {playerCopy.complete.xp(xp)}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        {nextLessonId ? (
          <>
            <Link
              to="/courses/$courseId/lessons/$lessonId"
              params={{ courseId, lessonId: nextLessonId }}
              replace
              className="lp-primary kid-tap w-full"
              data-variant="candy"
              data-testid="next-lesson"
            >
              {playerCopy.button.nextLesson}
            </Link>
            <Link to="/courses/$courseId" params={{ courseId }} className="candy-btn-quiet kid-tap w-full" data-testid="back-to-path">
              {playerCopy.button.backToRoadmap}
            </Link>
          </>
        ) : (
          <Link
            to="/courses/$courseId"
            params={{ courseId }}
            className="lp-primary kid-tap w-full"
            data-variant="candy"
            data-testid="back-to-path"
          >
            {playerCopy.button.backToRoadmap}
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * The moment after a lesson is completed, shown only from the server's reply
 * (spec Part B8): a teal check medallion (not gold — gold is the XP/primary
 * colour, teal is success), a confetti burst, an XP count-up shown only when
 * this call awarded some, and Next lesson (only once the refreshed states
 * show it open) or Back to roadmap otherwise. A repeat or racing call that
 * finds the lesson already done shows neither XP nor confetti, just a plain
 * "you already finished this one." The star pop is switched off under
 * `prefers-reduced-motion`; the title and description are read out when the
 * sheet opens, which is the announcement.
 */
export function LessonCompleteSheet({ open, onOpenChange, courseId, xpAwarded, alreadyDone, nextLessonId }: Props) {
  const isMdUp = useMediaQuery(MD_UP)
  const focusPrimary = {
    onOpenAutoFocus: (e: Event) => {
      e.preventDefault()
      const container = e.target as HTMLElement
      ;(container.querySelector<HTMLElement>('a[href]') ?? container).focus()
    },
  }
  const common = { courseId, xpAwarded, alreadyDone, nextLessonId, open }

  if (isMdUp) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          {...focusPrimary}
          className="kid-card kid-font max-w-[calc(100%-2rem)] gap-0 rounded-[26px] bg-surface p-0 text-ink ring-0 sm:max-w-md"
        >
          <Body {...common} Title={DialogTitle} Description={DialogDescription} />
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent {...focusPrimary} className="kid-font rounded-t-[26px] border-0 bg-surface text-ink">
        <Body {...common} Title={DrawerTitle} Description={DrawerDescription} />
      </DrawerContent>
    </Drawer>
  )
}
