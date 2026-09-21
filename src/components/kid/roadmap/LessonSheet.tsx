import type { ComponentType, ReactNode, RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { MD_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { formatClock } from '@/lib/lessonSettings'
import { blockingLesson, type Roadmap, type RoadmapLesson } from '@/lib/roadmap'
import { LESSON_TYPE_META } from './lessonTypeMeta'

type TextSlot = ComponentType<{ className?: string; children?: ReactNode }>

interface Props {
  courseId: string
  roadmap: Roadmap
  /** The lesson to show. Kept while the sheet animates closed, hence separate from `open`. */
  lesson: RoadmapLesson | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The node that opened the sheet; focus goes back to it on close (there is no Radix trigger to do it). */
  returnFocusRef: RefObject<HTMLElement | null>
}

/** The line under the title. Names the lesson to finish first when locked. */
function statusLine(lesson: RoadmapLesson, roadmap: Roadmap): string {
  switch (lesson.state) {
    case 'completed':
      return lesson.xp !== null && lesson.xp > 0 ? `Done! You earned ${lesson.xp} XP` : 'Done!'
    case 'in_progress':
      return lesson.minTimeSeconds > 0
        ? `You've spent ${formatClock(Math.min(lesson.activeSeconds, lesson.minTimeSeconds))} of ${formatClock(lesson.minTimeSeconds)}. Keep going!`
        : 'You started this one. Pick up where you left off!'
    case 'available':
      return 'Ready when you are!'
    case 'locked': {
      const first = blockingLesson(roadmap, lesson.id)
      return first ? `Finish “${first.title}” first to open this one.` : 'Finish the lessons before it to open this one.'
    }
  }
}

function SheetBody({
  courseId,
  roadmap,
  lesson,
  Title,
  Description,
}: {
  courseId: string
  roadmap: Roadmap
  lesson: RoadmapLesson
  Title: TextSlot
  Description: TextSlot
}) {
  const { label, Icon } = LESSON_TYPE_META[lesson.type]
  const showXp = lesson.xp !== null && lesson.xp > 0
  const target = { courseId, lessonId: lesson.id }
  return (
    <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]" data-testid="lesson-sheet" data-state={lesson.state}>
      <div className="flex items-center gap-2 text-base font-bold">
        <span className="rm-chip">
          <Icon className="size-4" aria-hidden />
          {label}
        </span>
        {showXp ? (
          <span className="rm-chip">
            <Sparkles className="size-3.5" aria-hidden />+{lesson.xp} XP
          </span>
        ) : null}
        {lesson.minTimeSeconds > 0 ? (
          <span className="rm-chip">
            <Clock className="size-3.5" aria-hidden />
            At least {formatClock(lesson.minTimeSeconds)}
          </span>
        ) : null}
      </div>
      <Title className="mt-3 text-2xl leading-tight font-extrabold [overflow-wrap:anywhere]">{lesson.title}</Title>
      <Description className="mt-2 text-base font-medium text-ink">
        <span data-testid="sheet-status">{statusLine(lesson, roadmap)}</span>
      </Description>
      {lesson.state === 'available' || lesson.state === 'in_progress' ? (
        <div className="mt-5 flex">
          <Link to="/courses/$courseId/lessons/$lessonId" params={target} className="candy-btn kid-tap w-full">
            {lesson.state === 'in_progress' ? 'Keep going' : 'Start'}
          </Link>
        </div>
      ) : null}
      {lesson.state === 'completed' ? (
        <div className="mt-5 flex">
          <Link to="/courses/$courseId/lessons/$lessonId" params={target} className="candy-btn-quiet kid-tap w-full">
            Review
          </Link>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The tap-a-node sheet: a bottom drawer on phones, a centred dialog from md up.
 * Both are Radix dialogs underneath, so focus is trapped while open and
 * restored to the tapped node on close.
 */
export function LessonSheet({ courseId, roadmap, lesson, open, onOpenChange, returnFocusRef }: Props) {
  const isMdUp = useMediaQuery(MD_UP)
  // Focus the primary action (Start / Keep going / Review) when the sheet opens —
  // else the sheet itself, so a locked lesson still moves focus off the page
  // behind it. Radix's default doesn't do this for the drawer, and for both it
  // would send focus to <body> on close because nothing here is a Radix trigger.
  const focusProps = {
    onOpenAutoFocus: (e: Event) => {
      e.preventDefault()
      const container = e.target as HTMLElement
      ;(container.querySelector<HTMLElement>('a[href]') ?? container).focus()
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault()
      returnFocusRef.current?.focus()
    },
  }

  if (isMdUp) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          {...focusProps}
          className="kid-card max-w-[calc(100%-2rem)] gap-0 rounded-[26px] bg-surface p-0 text-ink ring-0 sm:max-w-md"
        >
          {lesson ? (
            <SheetBody
              courseId={courseId}
              roadmap={roadmap}
              lesson={lesson}
              Title={DialogTitle}
              Description={DialogDescription}
            />
          ) : (
            <DialogTitle className="sr-only">Lesson</DialogTitle>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent {...focusProps} className="rounded-t-[26px] border-0 bg-surface text-ink">
        {lesson ? (
          <SheetBody
            courseId={courseId}
            roadmap={roadmap}
            lesson={lesson}
            Title={DrawerTitle}
            Description={DrawerDescription}
          />
        ) : (
          <DrawerTitle className="sr-only">Lesson</DrawerTitle>
        )}
      </DrawerContent>
    </Drawer>
  )
}
