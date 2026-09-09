import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
import { LessonSheet } from './LessonSheet'

/** Where a new/edited lesson belongs. `null` moduleId means Ungrouped. */
interface LessonTarget {
  moduleId: string | null
  lesson: Lesson | null
  position: number
}

function LessonRow({
  lesson,
  index,
  siblings,
  onEdit,
  onDelete,
  onSwap,
  swapPending,
}: {
  lesson: Lesson
  index: number
  siblings: Lesson[]
  onEdit: (lesson: Lesson) => void
  onDelete: (lesson: Lesson) => void
  onSwap: (a: Lesson, b: Lesson) => void
  swapPending: boolean
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border px-2.5 py-2">
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Move ${lesson.title} up`}
          disabled={index === 0 || swapPending}
          onClick={() => onSwap(lesson, siblings[index - 1])}
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Move ${lesson.title} down`}
          disabled={index === siblings.length - 1 || swapPending}
          onClick={() => onSwap(lesson, siblings[index + 1])}
        >
          <ChevronDown />
        </Button>
      </div>
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

export function CurriculumTab({ courseId }: { courseId: string }) {
  const modulesQuery = useModules(courseId)
  const lessonsQuery = useLessons(courseId)
  const moduleMutations = useModuleMutations(courseId)
  const lessonMutations = useLessonMutations(courseId)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null)
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null)
  const [lessonTarget, setLessonTarget] = useState<LessonTarget | null>(null)

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

      <ul className="space-y-3">
        {modules.map((module, index) => {
          const moduleLessons = lessonsByModule.get(module.id) ?? []
          const open = isExpanded(module.id)
          return (
            <li key={module.id} className="rounded-lg border">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${module.title} up`}
                    disabled={index === 0 || moduleMutations.swap.isPending}
                    onClick={() =>
                      moduleMutations.swap.mutate({ a: module, b: modules[index - 1] })
                    }
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${module.title} down`}
                    disabled={index === modules.length - 1 || moduleMutations.swap.isPending}
                    onClick={() =>
                      moduleMutations.swap.mutate({ a: module, b: modules[index + 1] })
                    }
                  >
                    <ChevronDown />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={open ? `Collapse ${module.title}` : `Expand ${module.title}`}
                  onClick={() => setExpanded((prev) => ({ ...prev, [module.id]: !open }))}
                >
                  {open ? <ChevronDown /> : <ChevronRight />}
                </Button>

                {renamingId === module.id ? (
                  <Input
                    autoFocus
                    className="h-8 flex-1"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => commitRename(module)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(module)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="hover:bg-muted min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-sm font-medium transition-colors"
                    onClick={() => {
                      setRenameDraft(module.title)
                      setRenamingId(module.id)
                    }}
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
                  onClick={() => setModuleToDelete(module)}
                >
                  <Trash2 />
                </Button>
              </div>

              {open ? (
                <div className="space-y-2 border-t px-3 py-3">
                  {moduleLessons.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No lessons in this topic yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {moduleLessons.map((lesson, lessonIndex) => (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          index={lessonIndex}
                          siblings={moduleLessons}
                          swapPending={lessonMutations.swap.isPending}
                          onEdit={(l) =>
                            setLessonTarget({ moduleId: module.id, lesson: l, position: 0 })
                          }
                          onDelete={setLessonToDelete}
                          onSwap={(a, b) => lessonMutations.swap.mutate({ a, b })}
                        />
                      ))}
                    </ul>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLessonTarget({
                        moduleId: module.id,
                        lesson: null,
                        position: moduleLessons.length,
                      })
                    }
                  >
                    <Plus />
                    Add lesson
                  </Button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

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
          <ul className="space-y-2 p-3">
            {ungrouped.map((lesson, lessonIndex) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={lessonIndex}
                siblings={ungrouped}
                swapPending={lessonMutations.swap.isPending}
                onEdit={(l) => setLessonTarget({ moduleId: null, lesson: l, position: 0 })}
                onDelete={setLessonToDelete}
                onSwap={(a, b) => lessonMutations.swap.mutate({ a, b })}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <LessonSheet
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
