import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useLessonMutations,
  useLessons,
  useModuleMutations,
  useModules,
  type Lesson,
  type LessonFormValues,
  type Module,
} from '@/hooks/admin/useCurriculum'
import { ContentTypeBadge, LessonStatusBadge } from './ContentTypeBadge'
import { LessonDialog } from './LessonDialog'

/** Where a new/edited lesson belongs. `null` moduleId means Ungrouped. */
interface LessonTarget {
  moduleId: string | null
  lesson: Lesson | null
  position: number
}

/**
 * A drop can move an item past several siblings in one go — dragging item 0
 * to the end shifts every item in between — so every row whose position
 * actually changed is collected and written together, not just the two
 * endpoints of the drag.
 */
function computeChangedPositions<T extends { id: string; position: number }>(
  items: T[],
  activeId: string,
  overId: string,
): T[] {
  const oldIndex = items.findIndex((item) => item.id === activeId)
  const newIndex = items.findIndex((item) => item.id === overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return []

  return arrayMove(items, oldIndex, newIndex)
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => item.position !== index)
    .map(({ item, index }) => ({ ...item, position: index }))
}

/**
 * Pointer needs a small activation distance so a click (rename, expand,
 * edit) doesn't get mistaken for the start of a drag. Keyboard is a second,
 * independent sensor — the button-based version this replaces was
 * accidentally more accessible than plain pointer drag would be, and
 * dnd-kit's KeyboardSensor is how that isn't lost.
 */
function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

/**
 * The only draggable surface on a row — dragging must not conflict with
 * clicking the title to rename it, the chevron to expand it, or the
 * edit/delete buttons, so listeners live here alone, not on the row.
 */
function DragHandle({
  attributes,
  listeners,
  label,
}: SortableHandleProps & { label: string }) {
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground flex shrink-0 touch-none items-center justify-center rounded p-1 active:cursor-grabbing"
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  )
}

function LessonRow({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: Lesson
  onEdit: (lesson: Lesson) => void
  onDelete: (lesson: Lesson) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    // Zero animation is a deliberate product decision, not an oversight —
    // see rules.md. `transition: null` makes dnd-kit's own getTransition()
    // return `undefined` instead of an eased `transform 200ms ease`, so a
    // displaced sibling's position updates on the same frame the pointer
    // crosses it, not over an interpolated slide.
    transition: null,
    // Without this, dnd-kit injects its own FLIP-style reflow transition
    // whenever the sortable array's order changes (including right after
    // drop) — the one case `transition: null` alone doesn't cover.
    animateLayoutChanges: () => false,
  })

  return (
    <li
      ref={setNodeRef}
      // The item being dragged is represented by <DragOverlay> instead, so
      // it renders here as a static placeholder rather than also chasing
      // the pointer via its own transform — applying both at once is what
      // let it drift outside the list's bounds. Non-dragged siblings still
      // need their transform to reflect the live order; `transition` is
      // included for correctness but will be `undefined` in effect.
      style={{ transform: isDragging ? undefined : CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-background flex items-center gap-2 rounded-md border px-2.5 py-2',
        isDragging && 'opacity-40',
      )}
    >
      <DragHandle attributes={attributes} listeners={listeners} label={`Reorder ${lesson.title}`} />
      <span className="min-w-0 flex-1 truncate text-sm">{lesson.title}</span>
      <ContentTypeBadge contentType={lesson.content_type} />
      <LessonStatusBadge status={lesson.status} />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${lesson.title}`}
        onClick={() => onEdit(lesson)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${lesson.title}`}
        onClick={() => onDelete(lesson)}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

/**
 * The actual floating, pointer-following visual during a drag — rendered
 * inside <DragOverlay>, a portal that isn't constrained by the list's
 * layout, unlike the in-place `transform` approach this replaces. Static:
 * no handlers, since DragOverlay content isn't the thing being interacted
 * with.
 */
function LessonRowPreview({ lesson }: { lesson: Lesson }) {
  return (
    <div className="bg-background flex items-center gap-2 rounded-md border px-2.5 py-2 shadow-lg">
      <span className="text-muted-foreground flex shrink-0 items-center justify-center rounded p-1">
        <GripVertical className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{lesson.title}</span>
      <ContentTypeBadge contentType={lesson.content_type} />
      <LessonStatusBadge status={lesson.status} />
    </div>
  )
}

/** A lessons list that can be reordered by drag or keyboard, on its own. */
function LessonList({
  lessons,
  onReorder,
  onEdit,
  onDelete,
}: {
  lessons: Lesson[]
  onReorder: (changed: Lesson[]) => void
  onEdit: (lesson: Lesson) => void
  onDelete: (lesson: Lesson) => void
}) {
  const sensors = useReorderSensors()
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeLesson = activeId ? (lessons.find((l) => l.id === activeId) ?? null) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const changed = computeChangedPositions(lessons, String(active.id), String(over.id))
    if (changed.length > 0) onReorder(changed)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {lessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      </SortableContext>
      {/* dropAnimation={null} short-circuits dnd-kit's "spring back to slot"
          release animation entirely (verified against the installed
          version: `if (config === null) return;` inside its drop-animation
          hook, with no other side effects). `transition={() => undefined}`
          overrides the one animation that's otherwise on by default even
          without any config: a keyboard-activated pickup gets its own
          `transform 250ms ease` unless explicitly cleared — pointer drags
          already default to no transition here, so this line exists for
          the keyboard case specifically. */}
      <DragOverlay dropAnimation={null} transition={() => undefined}>
        {activeLesson ? <LessonRowPreview lesson={activeLesson} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function ModuleCard({
  module,
  moduleLessons,
  isOpen,
  isRenaming,
  renameDraft,
  onRenameDraftChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onToggleExpand,
  onDelete,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onReorderLessons,
}: {
  module: Module
  moduleLessons: Lesson[]
  isOpen: boolean
  isRenaming: boolean
  renameDraft: string
  onRenameDraftChange: (value: string) => void
  onStartRename: () => void
  onCommitRename: () => void
  onCancelRename: () => void
  onToggleExpand: () => void
  onDelete: () => void
  onAddLesson: () => void
  onEditLesson: (lesson: Lesson) => void
  onDeleteLesson: (lesson: Lesson) => void
  onReorderLessons: (changed: Lesson[]) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
    // See LessonRow — zero animation by deliberate decision (rules.md).
    transition: null,
    animateLayoutChanges: () => false,
  })

  return (
    <li
      ref={setNodeRef}
      // See LessonRow — the dragged card is represented by <DragOverlay>
      // instead, so it stays put as a placeholder here rather than also
      // chasing the pointer via its own transform.
      style={{ transform: isDragging ? undefined : CSS.Transform.toString(transform), transition }}
      className={cn('bg-background rounded-lg border', isDragging && 'opacity-40')}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <DragHandle attributes={attributes} listeners={listeners} label={`Reorder ${module.title}`} />

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isOpen ? `Collapse ${module.title}` : `Expand ${module.title}`}
          onClick={onToggleExpand}
        >
          {isOpen ? <ChevronDown /> : <ChevronRight />}
        </Button>

        {isRenaming ? (
          <Input
            autoFocus
            className="h-8 flex-1"
            value={renameDraft}
            onChange={(e) => onRenameDraftChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename()
              if (e.key === 'Escape') onCancelRename()
            }}
          />
        ) : (
          <button
            type="button"
            className="hover:bg-muted min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-sm font-medium transition-colors"
            onClick={onStartRename}
          >
            {module.title}
          </button>
        )}

        <span className="text-muted-foreground shrink-0 text-xs">
          {moduleLessons.length} {moduleLessons.length === 1 ? 'lesson' : 'lessons'}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${module.title}`}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>

      {isOpen ? (
        <div className="space-y-2 border-t px-3 py-3">
          {moduleLessons.length === 0 ? (
            <p className="text-muted-foreground text-sm">No lessons in this topic yet.</p>
          ) : (
            <LessonList
              lessons={moduleLessons}
              onReorder={onReorderLessons}
              onEdit={onEditLesson}
              onDelete={onDeleteLesson}
            />
          )}
          <Button variant="outline" size="sm" onClick={onAddLesson}>
            <Plus />
            Add lesson
          </Button>
        </div>
      ) : null}
    </li>
  )
}

/** DragOverlay content for a topic — see LessonRowPreview for the rationale. */
function ModuleCardPreview({ module, lessonCount }: { module: Module; lessonCount: number }) {
  return (
    <div className="bg-background flex items-center gap-2 rounded-lg border px-3 py-2.5 shadow-lg">
      <span className="text-muted-foreground flex shrink-0 items-center justify-center rounded p-1">
        <GripVertical className="size-4" />
      </span>
      <span className="text-muted-foreground flex items-center justify-center rounded p-1">
        <ChevronDown />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{module.title}</span>
      <span className="text-muted-foreground shrink-0 text-xs">
        {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
      </span>
    </div>
  )
}

export function CurriculumTab({ courseId }: { courseId: string }) {
  const modulesQuery = useModules(courseId)
  const lessonsQuery = useLessons(courseId)
  const moduleMutations = useModuleMutations(courseId)
  const lessonMutations = useLessonMutations(courseId)
  const moduleSensors = useReorderSensors()

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null)
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null)
  const [lessonTarget, setLessonTarget] = useState<LessonTarget | null>(null)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)

  const modules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data])
  const lessons = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data])

  // Grouped client-side from two flat queries. Lessons whose module was
  // deleted have module_id = null (ON DELETE SET NULL) and must stay visible,
  // hence the explicit Ungrouped bucket.
  const lessonsByModule = useMemo(() => {
    const map = new Map<string, Lesson[]>()
    for (const lesson of lessons) {
      const key = lesson.module_id ?? '__ungrouped__'
      map.set(key, [...(map.get(key) ?? []), lesson])
    }
    return map
  }, [lessons])

  const ungrouped = lessonsByModule.get('__ungrouped__') ?? []
  const isPending = modulesQuery.isPending || lessonsQuery.isPending

  function isExpanded(moduleId: string) {
    return expanded[moduleId] ?? true
  }

  function setAllExpanded(value: boolean) {
    setExpanded(Object.fromEntries(modules.map((m) => [m.id, value])))
  }

  function commitRename(module: Module) {
    const title = renameDraft.trim()
    setRenamingId(null)
    if (title && title !== module.title) {
      moduleMutations.rename.mutate({ id: module.id, title })
    }
  }

  function handleLessonSubmit(values: LessonFormValues) {
    if (!lessonTarget) return
    if (lessonTarget.lesson) {
      lessonMutations.update.mutate(
        { id: lessonTarget.lesson.id, values },
        { onSuccess: () => setLessonTarget(null) },
      )
    } else {
      lessonMutations.create.mutate(
        { values, moduleId: lessonTarget.moduleId, position: lessonTarget.position },
        { onSuccess: () => setLessonTarget(null) },
      )
    }
  }

  function handleModuleDragStart(event: DragStartEvent) {
    setActiveModuleId(String(event.active.id))
  }

  function handleModuleDragEnd(event: DragEndEvent) {
    setActiveModuleId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const changed = computeChangedPositions(modules, String(active.id), String(over.id))
    if (changed.length > 0) moduleMutations.reorder.mutate(changed)
  }

  const activeModule = activeModuleId ? (modules.find((m) => m.id === activeModuleId) ?? null) : null

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {modules.length} {modules.length === 1 ? 'topic' : 'topics'} · {lessons.length}{' '}
          {lessons.length === 1 ? 'lesson' : 'lessons'}
        </p>
        {modules.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAllExpanded(true)}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAllExpanded(false)}>
              Collapse all
            </Button>
          </div>
        ) : null}
      </div>

      {modules.length === 0 && ungrouped.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="font-medium">No curriculum yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a topic to start grouping lessons.
          </p>
        </div>
      ) : null}

      <DndContext
        sensors={moduleSensors}
        collisionDetection={closestCenter}
        onDragStart={handleModuleDragStart}
        onDragEnd={handleModuleDragEnd}
        onDragCancel={() => setActiveModuleId(null)}
      >
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {modules.map((module) => {
              const moduleLessons = lessonsByModule.get(module.id) ?? []
              return (
                <ModuleCard
                  key={module.id}
                  module={module}
                  moduleLessons={moduleLessons}
                  isOpen={isExpanded(module.id)}
                  isRenaming={renamingId === module.id}
                  renameDraft={renameDraft}
                  onRenameDraftChange={setRenameDraft}
                  onStartRename={() => {
                    setRenameDraft(module.title)
                    setRenamingId(module.id)
                  }}
                  onCommitRename={() => commitRename(module)}
                  onCancelRename={() => setRenamingId(null)}
                  onToggleExpand={() =>
                    setExpanded((prev) => ({ ...prev, [module.id]: !isExpanded(module.id) }))
                  }
                  onDelete={() => setModuleToDelete(module)}
                  onAddLesson={() =>
                    setLessonTarget({
                      moduleId: module.id,
                      lesson: null,
                      position: moduleLessons.length,
                    })
                  }
                  onEditLesson={(l) =>
                    setLessonTarget({ moduleId: module.id, lesson: l, position: 0 })
                  }
                  onDeleteLesson={setLessonToDelete}
                  onReorderLessons={(changed) => lessonMutations.reorder.mutate(changed)}
                />
              )
            })}
          </ul>
        </SortableContext>
        {/* See the lessons' DragOverlay above for why both props are needed. */}
        <DragOverlay dropAnimation={null} transition={() => undefined}>
          {activeModule ? (
            <ModuleCardPreview
              module={activeModule}
              lessonCount={lessonsByModule.get(activeModule.id)?.length ?? 0}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Button
        variant="outline"
        disabled={moduleMutations.create.isPending}
        onClick={() =>
          moduleMutations.create.mutate({
            title: `Topic ${modules.length + 1}`,
            position: modules.length,
          })
        }
      >
        <Plus />
        Add topic
      </Button>

      {ungrouped.length > 0 ? (
        <section className="rounded-lg border">
          <header className="border-b px-3 py-2.5">
            <h3 className="text-sm font-medium">Ungrouped</h3>
            <p className="text-muted-foreground text-xs">
              Lessons not in any topic — including any left behind by a deleted topic.
            </p>
          </header>
          <div className="p-3">
            <LessonList
              lessons={ungrouped}
              onReorder={(changed) => lessonMutations.reorder.mutate(changed)}
              onEdit={(l) => setLessonTarget({ moduleId: null, lesson: l, position: 0 })}
              onDelete={setLessonToDelete}
            />
          </div>
        </section>
      ) : null}

      <LessonDialog
        open={!!lessonTarget}
        onOpenChange={(open) => !open && setLessonTarget(null)}
        lesson={lessonTarget?.lesson ?? null}
        isSubmitting={lessonMutations.create.isPending || lessonMutations.update.isPending}
        onSubmit={handleLessonSubmit}
      />

      <AlertDialog
        open={!!moduleToDelete}
        onOpenChange={(open) => !open && setModuleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{moduleToDelete?.title}”?</AlertDialogTitle>
            {/* Spelled out because the FK is SET NULL, not CASCADE — the
                lessons genuinely survive, and "are you sure" would imply
                otherwise. */}
            <AlertDialogDescription>
              Its{' '}
              {moduleToDelete ? (lessonsByModule.get(moduleToDelete.id)?.length ?? 0) : 0}{' '}
              lesson(s) will not be deleted — they&rsquo;ll move to Ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                if (moduleToDelete) {
                  moduleMutations.remove.mutate(moduleToDelete.id, {
                    onSuccess: () => setModuleToDelete(null),
                  })
                }
              }}
            >
              Delete topic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!lessonToDelete}
        onOpenChange={(open) => !open && setLessonToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{lessonToDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes its quiz questions. If any student has already started this
              lesson, it can&rsquo;t be deleted — unpublish it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={lessonMutations.remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (lessonToDelete) {
                  lessonMutations.remove.mutate(lessonToDelete.id, {
                    onSuccess: () => setLessonToDelete(null),
                    onError: () => setLessonToDelete(null),
                  })
                }
              }}
            >
              {lessonMutations.remove.isPending ? 'Deleting…' : 'Delete lesson'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
