import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
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
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { BulkActionBar } from '@/components/admin/selection/BulkActionBar'
import { useTableSelection } from '@/components/admin/selection/useTableSelection'
import { useTrashActions } from '@/hooks/admin/useTrashActions'
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
 * Lessons live in one container per `module_id`; `null` (a lesson whose topic
 * was deleted, since the FK is SET NULL) is its own container rather than an
 * absence of one, so it drags exactly like any topic.
 */
const UNGROUPED = '__ungrouped__'

const containerOf = (lesson: Lesson) => lesson.module_id ?? UNGROUPED

/**
 * Modules are sortable *and* droppable under the same id, so a container's
 * own drop target has to be namespaced or it collides with the module card's
 * — one shared DndContext means one shared id space.
 */
const DROPZONE_PREFIX = 'dropzone:'
const dropZoneId = (container: string) => `${DROPZONE_PREFIX}${container}`

type DragKind = 'module' | 'lesson' | 'container'

const kindOf = (data: Record<string, unknown> | undefined) => data?.type as DragKind | undefined

/**
 * `lessons.position` is scoped **per container**, not per course — verified
 * against the live database, where two lessons in different topics both sit
 * at position 0. Nothing in Postgres enforces that (no unique constraint, no
 * trigger); it is purely a convention this code maintains, which is exactly
 * why every recompute below renumbers a whole container from 0 rather than
 * nudging individual values.
 */
function lessonsIn(items: Lesson[], container: string) {
  return items.filter((lesson) => containerOf(lesson) === container)
}

/**
 * Places `activeId` in `container`, immediately before or after `anchorId`.
 * `arrangeLessons` decides which; this only moves the row.
 *
 * A null `anchorId` means the drag is over the container itself rather than
 * any row (an empty topic), so the lesson goes to that container's end.
 *
 * Only the dragged row moves — every other row keeps its relative order —
 * which is what lets the live preview and the drop run this independently and
 * still agree.
 */
function placeLesson(
  items: Lesson[],
  activeId: string,
  container: string,
  anchorId: string | null,
  after: boolean,
): Lesson[] {
  const lesson = items.find((item) => item.id === activeId)
  if (!lesson) return items

  const next = items.filter((item) => item.id !== activeId)
  const moved: Lesson = { ...lesson, module_id: container === UNGROUPED ? null : container }

  const anchor = anchorId ? next.findIndex((item) => item.id === anchorId) : -1
  if (anchor !== -1) {
    next.splice(anchor + (after ? 1 : 0), 0, moved)
    return next
  }

  let insertAt = next.length
  for (let i = next.length - 1; i >= 0; i--) {
    if (containerOf(next[i]) === container) {
      insertAt = i + 1
      break
    }
  }
  next.splice(insertAt, 0, moved)
  return next
}

/** Identical container+order, so re-rendering the lists would change nothing. */
function sameArrangement(a: Lesson[], b: Lesson[]) {
  return (
    a.length === b.length &&
    a.every((lesson, i) => lesson.id === b[i].id && containerOf(lesson) === containerOf(b[i]))
  )
}

/**
 * What the drag is currently over: a lesson row, or a container's own drop
 * zone (an empty topic, or the padding past the last row).
 */
function resolveLessonTarget(items: Lesson[], overId: string) {
  const overLesson = items.find((lesson) => lesson.id === overId)
  if (overLesson) return { container: containerOf(overLesson), anchorId: overId }
  if (overId.startsWith(DROPZONE_PREFIX)) {
    return { container: overId.slice(DROPZONE_PREFIX.length), anchorId: null }
  }
  return null
}

/**
 * The whole placement decision in one place, so the live preview and the drop
 * can never disagree — they call this with the same arguments and it is
 * idempotent, since `placeLesson` only ever moves the dragged row and leaves
 * the relative order of everything else alone.
 */
function arrangeLessons(
  items: Lesson[],
  activeId: string,
  overId: string,
  enteringBelow: boolean,
): Lesson[] {
  const target = resolveLessonTarget(items, overId)
  if (!target) return items

  let after = enteringBelow
  if (target.anchorId) {
    const activeIndex = items.findIndex((lesson) => lesson.id === activeId)
    const anchorIndex = items.findIndex((lesson) => lesson.id === target.anchorId)
    // Already in this topic: step over the anchor in the direction of travel,
    // the same "move into that slot" rule a plain sorted list uses. Midpoints
    // are only consulted when entering a topic the row isn't in yet, where
    // there is no existing index to compare against.
    if (activeIndex !== -1 && containerOf(items[activeIndex]) === target.container) {
      after = activeIndex < anchorIndex
    }
  }
  return placeLesson(items, activeId, target.container, target.anchorId, after)
}

/**
 * Keyboard drags take their coordinates from the layout itself, so reordering
 * the list under them feeds straight back into the sensor: one ArrowDown
 * moved the row, the move shifted the rows, and the shifted rows moved it
 * again — two slots per keypress. Pointer drags have no such loop, since the
 * physical pointer doesn't move when the list does. So the live preview is
 * pointer-only, and keyboard drags keep dnd-kit's own transform preview and
 * resolve their placement once, on drop.
 */
const isKeyboardDrag = (event: { activatorEvent: Event }) =>
  typeof KeyboardEvent !== 'undefined' && event.activatorEvent instanceof KeyboardEvent

/** Whether the dragged row's own box has passed the hovered row's midpoint. */
function isEnteringBelow(event: DragOverEvent | DragEndEvent) {
  const rect = event.active.rect.current.translated
  if (!rect || !event.over) return false
  return rect.top + rect.height / 2 > event.over.rect.top + event.over.rect.height / 2
}

/**
 * The cross-container sibling of `computeChangedPositions`, which stays as-is
 * for modules. It deliberately isn't extended to cover this case: its
 * `(items, activeId, overId)` signature describes one array being permuted,
 * and a cross-container move is a different computation — two containers
 * renumbered independently, plus a `module_id` change on the moved row.
 * Folding that in would leave a helper whose name and shape no longer
 * describe what it does.
 *
 * Only `affected` containers are renumbered, so a drag never rewrites
 * positions in topics it didn't touch (some may hold gappy values from
 * earlier hand-editing; silently "repairing" them would be a write nobody
 * asked for).
 */
function computeLessonMoves(
  original: Lesson[],
  arranged: Lesson[],
  affected: Set<string>,
): Lesson[] {
  const before = new Map(original.map((lesson) => [lesson.id, lesson]))
  const changed: Lesson[] = []

  for (const container of affected) {
    lessonsIn(arranged, container).forEach((lesson, position) => {
      const previous = before.get(lesson.id)
      if (!previous) return
      if (previous.position !== position || previous.module_id !== lesson.module_id) {
        changed.push({ ...lesson, position })
      }
    })
  }
  return changed
}

/**
 * One DndContext now carries both modules and lessons (lesson rows render
 * inside module cards, so any context spanning every module's lessons is
 * also the nearest context for the module cards themselves — nesting two
 * can't separate them). Collisions are therefore scoped by what's being
 * dragged, or a module would try to drop into a lesson list.
 *
 * For lessons, `pointerWithin` is preferred over `closestCenter` so the drop
 * lands where the pointer actually is: a row the pointer is literally inside
 * always wins over the container enclosing it, which is what makes dropping
 * at an exact mid-list position work. Falling through to the container is
 * what makes an *empty* topic droppable at all. Keyboard drags report no
 * pointer, so they keep the original `closestCenter` behaviour.
 */
const curriculumCollisionDetection: CollisionDetection = (args) => {
  const activeKind = kindOf(args.active.data.current)
  const droppableContainers = args.droppableContainers.filter((candidate) => {
    const kind = kindOf(candidate.data.current)
    return activeKind === 'module' ? kind === 'module' : kind === 'lesson' || kind === 'container'
  })
  const scoped = { ...args, droppableContainers }

  if (activeKind === 'module') return closestCenter(scoped)

  const dataFor = (id: UniqueIdentifier) =>
    droppableContainers.find((candidate) => candidate.id === id)?.data.current

  const withinPointer = pointerWithin(scoped)
  if (withinPointer.length > 0) {
    const rows = withinPointer.filter((collision) => kindOf(dataFor(collision.id)) === 'lesson')
    if (rows.length > 0) return rows

    // The pointer is inside a container but not inside any row — the gap
    // between two rows, or the padding around them. Answering with the
    // container means "append to the end", which made the dragged row flick
    // to the bottom of the list every time the pointer crossed a gap. Snap to
    // the nearest row in that container instead; only a container with no
    // rows at all answers as itself.
    const hovered = new Set(withinPointer.map((collision) => String(collision.id)))
    const rowsInside = droppableContainers.filter((candidate) => {
      const data = candidate.data.current
      return (
        kindOf(data) === 'lesson' && hovered.has(dropZoneId(String(data?.container)))
      )
    })
    if (rowsInside.length > 0) {
      return closestCenter({ ...scoped, droppableContainers: rowsInside })
    }
    return withinPointer
  }
  return closestCenter(scoped)
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

/**
 * The selection checkbox is a sibling of the drag handle, never inside it:
 * dnd-kit's listeners live on the handle alone, so ticking a box can't start a
 * drag and dragging can't toggle a box.
 */
function RowCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={label} />
}

function LessonRow({
  lesson,
  selected,
  onToggleSelect,
  onEdit,
  onTrash,
}: {
  lesson: Lesson
  selected: boolean
  onToggleSelect: (id: string) => void
  onEdit: (lesson: Lesson) => void
  onTrash: (lesson: Lesson) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    // Identifies both what this is (so a module drag can't target it) and
    // which container it currently sits in, which is how onDragOver knows a
    // pointer has crossed a topic boundary.
    data: { type: 'lesson', container: containerOf(lesson) },
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
      <RowCheckbox
        checked={selected}
        onToggle={() => onToggleSelect(lesson.id)}
        label={`Select ${lesson.title}`}
      />
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
        aria-label={`Move ${lesson.title} to trash`}
        onClick={() => onTrash(lesson)}
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

/**
 * One container's lessons. Drag state lives in the single shared DndContext
 * up in `CurriculumTab`, not here — a per-container context is exactly what
 * made cross-container dragging impossible, since dnd-kit shares no drag
 * state between sibling contexts.
 *
 * The whole area is a drop target via `useDroppable`, not just the rows, so
 * a topic with no lessons left (or none yet) can still be dropped into.
 */
function LessonList({
  lessons,
  container,
  emptyLabel,
  selectedIds,
  onToggleSelect,
  onEdit,
  onTrash,
}: {
  lessons: Lesson[]
  container: string
  emptyLabel: string
  selectedIds: Record<string, boolean>
  onToggleSelect: (id: string) => void
  onEdit: (lesson: Lesson) => void
  onTrash: (lesson: Lesson) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropZoneId(container),
    data: { type: 'container', container },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md',
        lessons.length === 0 && 'border border-dashed px-2.5 py-3',
        // No transition class here on purpose — see rules.md.
        isOver && 'ring-primary/40 ring-2',
      )}
    >
      {lessons.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                selected={!!selectedIds[lesson.id]}
                onToggleSelect={onToggleSelect}
                onEdit={onEdit}
                onTrash={onTrash}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
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
  selected,
  selectedIds,
  onToggleSelect,
  onTrash,
  onAddLesson,
  onEditLesson,
  onTrashLesson,
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
  selected: boolean
  selectedIds: Record<string, boolean>
  onToggleSelect: (id: string) => void
  onTrash: () => void
  onAddLesson: () => void
  onEditLesson: (lesson: Lesson) => void
  onTrashLesson: (lesson: Lesson) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
    // Keeps module drags from ever targeting a lesson row or a lesson
    // container now that both share one DndContext.
    data: { type: 'module' },
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

        <RowCheckbox
          checked={selected}
          onToggle={() => onToggleSelect(module.id)}
          label={`Select ${module.title}`}
        />

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
          aria-label={`Move ${module.title} to trash`}
          onClick={onTrash}
        >
          <Trash2 />
        </Button>
      </div>

      {isOpen ? (
        <div className="space-y-2 border-t px-3 py-3">
          <LessonList
            lessons={moduleLessons}
            container={module.id}
            emptyLabel="No lessons in this topic yet."
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onEdit={onEditLesson}
            onTrash={onTrashLesson}
          />
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
  const sensors = useReorderSensors()
  const { trash, isPending: trashPending } = useTrashActions()
  // Modules and lessons share one selection map — their ids are both UUIDs, so
  // they can't collide.
  const selection = useTableSelection([courseId])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [lessonTarget, setLessonTarget] = useState<LessonTarget | null>(null)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  // Non-null only mid-drag: the lesson arrangement as the pointer currently
  // has it, including a cross-container move that hasn't been dropped yet.
  // Rendering from this is what makes the row appear under the pointer in
  // the destination topic before any write happens.
  const [draftLessons, setDraftLessons] = useState<Lesson[] | null>(null)

  const modules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data])
  const lessons = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data])
  const liveLessons = draftLessons ?? lessons

  // Grouped client-side from two flat queries. Lessons whose module was
  // deleted have module_id = null (ON DELETE SET NULL) and must stay visible,
  // hence the explicit Ungrouped bucket.
  const lessonsByModule = useMemo(() => {
    const map = new Map<string, Lesson[]>()
    for (const lesson of liveLessons) {
      const key = containerOf(lesson)
      map.set(key, [...(map.get(key) ?? []), lesson])
    }
    return map
  }, [liveLessons])

  const ungrouped = lessonsByModule.get(UNGROUPED) ?? []
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

  /**
   * Move to trash, no confirm — the Undo toast is the safety net. Topics and
   * lessons can be trashed together (a bulk selection often holds both); Undo
   * restores topics before lessons. A trashed topic hides its lessons through
   * the parent, so they are not marked themselves.
   */
  async function trashSelected(moduleItems: Module[], lessonItems: Lesson[]) {
    const result = await trash([
      { entity: 'modules', items: moduleItems.map((m) => ({ id: m.id, name: m.title })) },
      { entity: 'lessons', items: lessonItems.map((l) => ({ id: l.id, name: l.title })) },
    ])
    selection.removeIds(result.succeeded.map((item) => item.id))
  }

  const selectedModules = modules.filter((m) => selection.rowSelection[m.id])
  const selectedLessons = lessons.filter((l) => selection.rowSelection[l.id])

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

  function handleDragStart(event: DragStartEvent) {
    if (kindOf(event.active.data.current) === 'module') {
      setActiveModuleId(String(event.active.id))
      return
    }
    setActiveLessonId(String(event.active.id))
    setDraftLessons(lessons)
  }

  /**
   * Maintains the draft for the whole drag — both crossing into another topic
   * and moving within one. Keeping it all here is what lets the drop itself
   * be a pure read of the draft.
   */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || kindOf(active.data.current) !== 'lesson') return
    if (isKeyboardDrag(event)) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (overId === activeId) return

    const enteringBelow = isEnteringBelow(event)
    setDraftLessons((prev) => {
      if (!prev) return prev
      const next = arrangeLessons(prev, activeId, overId, enteringBelow)
      return sameArrangement(prev, next) ? prev : next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const activeId = String(active.id)

    if (kindOf(active.data.current) === 'module') {
      setActiveModuleId(null)
      if (!over || active.id === over.id) return
      const changed = computeChangedPositions(modules, activeId, String(over.id))
      if (changed.length > 0) moduleMutations.reorder.mutate(changed)
      return
    }

    const draft = draftLessons
    setActiveLessonId(null)
    setDraftLessons(null)
    if (!over) return

    // Pointer drags have been maintaining the draft all along, so it already
    // is the answer. Keyboard drags deliberately left it alone, so resolve
    // the whole placement here in one step.
    const arranged = isKeyboardDrag(event)
      ? arrangeLessons(lessons, activeId, String(over.id), isEnteringBelow(event))
      : draft
    if (!arranged) return

    const from = lessons.find((lesson) => lesson.id === activeId)
    const to = arranged.find((lesson) => lesson.id === activeId)
    if (!from || !to) return

    const changed = computeLessonMoves(
      lessons,
      arranged,
      new Set([containerOf(from), containerOf(to)]),
    )
    if (changed.length > 0) lessonMutations.reorder.mutate(changed)
  }

  function handleDragCancel() {
    setActiveModuleId(null)
    setActiveLessonId(null)
    setDraftLessons(null)
  }

  const activeModule = activeModuleId ? (modules.find((m) => m.id === activeModuleId) ?? null) : null
  const activeLesson = activeLessonId
    ? (liveLessons.find((l) => l.id === activeLessonId) ?? null)
    : null

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

      {/* One context for topics and lessons alike. Lesson rows render inside
          topic cards, so a context spanning every topic's lessons is
          unavoidably the nearest one for the topic cards too — nesting two
          can't keep them apart. `data.type` is what separates them instead,
          filtered in curriculumCollisionDetection. */}
      <DndContext
        sensors={sensors}
        collisionDetection={curriculumCollisionDetection}
        // Moving a lesson between topics resizes both of them mid-drag (one
        // grows a row, the other shrinks), which shifts everything below.
        // dnd-kit's default only measures droppables when the drag starts,
        // so every rect past the first resize is stale and the pointer ends
        // up testing against where containers *used* to be — dropping into
        // an empty topic silently did nothing.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
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
                  selected={!!selection.rowSelection[module.id]}
                  selectedIds={selection.rowSelection}
                  onToggleSelect={(id) => selection.toggle(id)}
                  onTrash={() => void trashSelected([module], [])}
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
                  onTrashLesson={(l) => void trashSelected([], [l])}
                />
              )
            })}
          </ul>
        </SortableContext>
        <Button
          variant="outline"
          className="mt-4"
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

        {/* Stays mounted while a lesson is in flight even when it holds
            nothing, since an unmounted section can't be dropped into — that
            is the only way a lesson gets out of every topic. */}
        {ungrouped.length > 0 || activeLessonId ? (
          <section className="mt-4 rounded-lg border">
            <header className="border-b px-3 py-2.5">
              <h3 className="text-sm font-medium">Ungrouped</h3>
              <p className="text-muted-foreground text-xs">
                Lessons that aren&rsquo;t in any topic.
              </p>
            </header>
            <div className="p-3">
              <LessonList
                lessons={ungrouped}
                container={UNGROUPED}
                emptyLabel="Drop a lesson here to take it out of its topic."
                selectedIds={selection.rowSelection}
                onToggleSelect={(id) => selection.toggle(id)}
                onEdit={(l) => setLessonTarget({ moduleId: null, lesson: l, position: 0 })}
                onTrash={(l) => void trashSelected([], [l])}
              />
            </div>
          </section>
        ) : null}

        {/* dropAnimation={null} short-circuits dnd-kit's "spring back to
            slot" release animation entirely (verified against the installed
            version: `if (config === null) return;` inside its drop-animation
            hook, with no other side effects). `transition={() => undefined}`
            overrides the one animation that's otherwise on by default even
            without any config: a keyboard-activated pickup gets its own
            `transform 250ms ease` unless explicitly cleared — pointer drags
            already default to no transition here, so this line exists for
            the keyboard case specifically. */}
        <DragOverlay dropAnimation={null} transition={() => undefined}>
          {activeModule ? (
            <ModuleCardPreview
              module={activeModule}
              lessonCount={lessonsByModule.get(activeModule.id)?.length ?? 0}
            />
          ) : activeLesson ? (
            <LessonRowPreview lesson={activeLesson} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <LessonDialog
        open={!!lessonTarget}
        onOpenChange={(open) => !open && setLessonTarget(null)}
        lesson={lessonTarget?.lesson ?? null}
        isSubmitting={lessonMutations.create.isPending || lessonMutations.update.isPending}
        onSubmit={handleLessonSubmit}
      />

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="outline"
          size="sm"
          disabled={trashPending}
          onClick={() => void trashSelected(selectedModules, selectedLessons)}
        >
          Move to trash
        </Button>
      </BulkActionBar>
    </div>
  )
}
