import { useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Positioned {
  id: string
  position: number
}

/**
 * Generic version of `CurriculumTab`'s `computeChangedPositions`: every row
 * whose `position` actually changed after the drop, not just the drag's two
 * endpoints — a drop can move an item past several siblings in one go.
 */
// eslint-disable-next-line react-refresh/only-export-components -- co-located dnd-kit helpers, same reasoning as button.tsx's buttonVariants
export function computeChangedPositions<T extends Positioned>(
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

/** Pointer needs a small activation distance so a click doesn't register as a drag start; keyboard is a second, independent sensor (same as `CurriculumTab`). */
// eslint-disable-next-line react-refresh/only-export-components -- co-located dnd-kit helpers, same reasoning as button.tsx's buttonVariants
export function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

type HandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

/** The only draggable surface on a row — listeners live here alone, never the row, so dragging can't conflict with clicking to edit/delete. */
export function DragHandle({ attributes, listeners, label }: HandleProps & { label: string }) {
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
 * One sortable row. The drag handle's `attributes`/`listeners` and whether
 * this row is the one being dragged are handed to the caller via a render
 * prop, so each list's own row layout (a truncated prompt, a block preview,
 * whatever it needs) stays with the caller — this component owns only the
 * drag mechanics. Zero animation, the same deliberate choice `rules.md`
 * documents for `CurriculumTab`: `transition: null` plus
 * `animateLayoutChanges: () => false`, so a displaced sibling moves on the
 * same frame the pointer crosses it, never over an eased slide.
 */
function SortableRow({
  id,
  children,
}: {
  id: string
  children: (handle: HandleProps & { isDragging: boolean }) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: null,
    animateLayoutChanges: () => false,
  })
  return (
    <li
      ref={setNodeRef}
      // The dragged item is represented by <DragOverlay> instead (see below),
      // so it renders here as a static, dimmed placeholder rather than also
      // chasing the pointer via its own transform.
      style={{ transform: isDragging ? undefined : CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
    >
      {children({ attributes, listeners, isDragging })}
    </li>
  )
}

/**
 * A flat, single-container drag-reorderable list — the simple case
 * `CurriculumTab.tsx` doesn't need, since modules and lessons nest across
 * containers. One `DndContext` + one `SortableContext`, a floating
 * `<DragOverlay>` copy that follows the pointer unconstrained by the list's
 * own layout, and an optimistic `onReorder` call the caller wires into its
 * own mutation's `onMutate` (see `useQuestionMutations`/block mutations) —
 * this component only computes *which* rows changed, it does not itself
 * touch a query cache or the network.
 */
export function SimpleSortableList<T extends Positioned>({
  items,
  onReorder,
  renderRow,
  renderOverlay,
  className,
}: {
  items: T[]
  onReorder: (changed: T[]) => void
  renderRow: (item: T, handle: HandleProps & { isDragging: boolean }) => ReactNode
  renderOverlay: (item: T) => ReactNode
  className?: string
}) {
  const sensors = useReorderSensors()
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeItem = items.find((item) => item.id === activeId) ?? null

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const changed = computeChangedPositions(items, String(active.id), String(over.id))
    if (changed.length > 0) onReorder(changed)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className={cn('space-y-2', className)}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderRow(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
      {/* dropAnimation={null} plus transition={() => undefined} — the second
          is needed too, a keyboard-activated pickup gets its own `transform
          250ms ease` otherwise, even with dropAnimation off (rules.md). */}
      <DragOverlay dropAnimation={null} transition={() => undefined}>
        {activeItem ? renderOverlay(activeItem) : null}
      </DragOverlay>
    </DndContext>
  )
}
