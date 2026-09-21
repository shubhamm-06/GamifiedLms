import type { ComponentType, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Sparkles, Star } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'

type TextSlot = ComponentType<{ className?: string; children?: ReactNode }>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  /** XP awarded by THIS completion, from the server reply. 0 means none (a replay, or a course that awards no XP). */
  xpAwarded: number
  /** The next lesson, only if the server says it is open. */
  nextLessonId: string | null
}

const TITLE_CLASS =
  'mt-4 text-center text-2xl leading-tight font-extrabold text-ink [font-family:var(--font-kid)]!'

function Body({
  courseId,
  xpAwarded,
  nextLessonId,
  Title,
  Description,
}: Omit<Props, 'open' | 'onOpenChange'> & { Title: TextSlot; Description: TextSlot }) {
  return (
    <div
      className="px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center"
      data-testid="complete-sheet"
    >
      <div className="lp-star" aria-hidden="true">
        <span className="lp-star-burst" />
        <Star className="size-12" fill="currentColor" strokeWidth={2} />
      </div>
      <Title className={TITLE_CLASS}>Lesson complete!</Title>
      <Description className="mt-2 text-lg font-medium text-ink">
        {xpAwarded > 0 ? `Well done! You earned ${xpAwarded} XP.` : 'Well done! Great job finishing this one.'}
      </Description>
      {xpAwarded > 0 ? (
        <p className="lp-xp" data-testid="xp-earned">
          <Sparkles className="size-5" aria-hidden />+{xpAwarded} XP
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        {nextLessonId ? (
          <>
            <Link
              to="/courses/$courseId/lessons/$lessonId"
              params={{ courseId, lessonId: nextLessonId }}
              replace
              className="candy-btn kid-tap w-full"
              data-testid="next-lesson"
            >
              Next lesson
            </Link>
            <Link
              to="/courses/$courseId"
              params={{ courseId }}
              className="candy-btn-quiet kid-tap w-full"
              data-testid="back-to-path"
            >
              Back to my path
            </Link>
          </>
        ) : (
          <Link
            to="/courses/$courseId"
            params={{ courseId }}
            className="candy-btn kid-tap w-full"
            data-testid="back-to-path"
          >
            Back to my path
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * The moment after a lesson is completed, shown only from the server's reply.
 * XP is what THIS completion awarded (so it appears once, never in replay); the
 * star pop is CSS and is switched off under prefers-reduced-motion. The title and
 * description are read out when the sheet opens, which is the announcement.
 * "Next lesson" appears only when the refreshed lesson states show the next one open.
 */
export function LessonCompleteSheet({ open, onOpenChange, courseId, xpAwarded, nextLessonId }: Props) {
  const isMdUp = useMediaQuery(MD_UP)
  const focusPrimary = {
    onOpenAutoFocus: (e: Event) => {
      e.preventDefault()
      const container = e.target as HTMLElement
      ;(container.querySelector<HTMLElement>('a[href]') ?? container).focus()
    },
  }
  const common = { courseId, xpAwarded, nextLessonId }

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
