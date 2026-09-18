import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BASE_LEVEL,
  useCreateLevelThreshold,
  useDeleteLevelThreshold,
  useLevelThresholds,
  useUpdateLevelThreshold,
  validateThreshold,
  type LevelThreshold,
} from '@/hooks/admin/useLevelThresholds'

/**
 * Local draft state per row. The parent keys this by `level:xp_required`,
 * so once a save lands and the list refetches, the row remounts with its
 * draft equal to the saved value — no effect resetting state (the
 * `react-hooks/set-state-in-effect` rule would reject one anyway).
 *
 * Save stays an explicit button rather than saving on blur/change: typing a
 * number has a real "still typing" state (`2` on the way to `2700`) that
 * would be a wrong intermediate write, unlike a discrete Select/Switch.
 */
function ThresholdRow({
  threshold,
  thresholds,
  isSaving,
  onSave,
  onDelete,
}: {
  threshold: LevelThreshold
  thresholds: LevelThreshold[]
  isSaving: boolean
  onSave: (row: LevelThreshold) => void
  onDelete: (level: number) => void
}) {
  const [draft, setDraft] = useState(String(threshold.xp_required))
  const isBase = threshold.level === BASE_LEVEL
  const parsed = Number(draft)
  const isDirty = draft.trim() !== String(threshold.xp_required)
  // Client-side rule check is fast feedback only; the DB trigger
  // (fn_validate_level_threshold) is what actually enforces it.
  const error = isDirty
    ? draft.trim() === ''
      ? 'Enter a whole number, 0 or more.'
      : validateThreshold(thresholds, threshold.level, parsed)
    : null

  return (
    <li className="px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm font-medium">Level {threshold.level}</span>
        <Input
          type="number"
          min={0}
          className="w-32"
          aria-label={`XP required for level ${threshold.level}`}
          aria-invalid={!!error}
          // Level 1 must always exist and stay at 0 — protected here in the
          // UI rather than special-cased in the DB trigger (see rules.md).
          disabled={isBase}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <span className="text-muted-foreground text-xs">XP</span>
        <div className="ml-auto flex items-center gap-2">
          {isDirty ? (
            <Button
              size="sm"
              disabled={!!error || isSaving}
              onClick={() => onSave({ level: threshold.level, xp_required: parsed })}
            >
              Save
            </Button>
          ) : null}
          {isBase ? (
            <span className="text-muted-foreground w-8 text-center text-xs">Base</span>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete level ${threshold.level}`}
              onClick={() => onDelete(threshold.level)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {error ? <p className="text-coral-d mt-1 pl-[5.75rem] text-sm">{error}</p> : null}
    </li>
  )
}

export function LevelThresholdsSection() {
  const { data: thresholds, isPending, isError } = useLevelThresholds()
  const createLevel = useCreateLevelThreshold()
  const updateLevel = useUpdateLevelThreshold()
  const deleteLevel = useDeleteLevelThreshold()
  const [newXp, setNewXp] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [levelToDelete, setLevelToDelete] = useState<number | null>(null)

  const list = thresholds ?? []
  const nextLevel = list.length === 0 ? BASE_LEVEL : Math.max(...list.map((t) => t.level)) + 1
  // The very first level (only possible if the table were somehow empty) is
  // pinned to 0, same rule as the list rows.
  const addingBase = nextLevel === BASE_LEVEL

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    const xp = addingBase ? 0 : Number(newXp)
    if (!addingBase && newXp.trim() === '') {
      setAddError('Enter a whole number, 0 or more.')
      return
    }
    const message = validateThreshold(list, nextLevel, xp)
    if (message) {
      setAddError(message)
      return
    }
    setAddError(null)
    createLevel.mutate({ level: nextLevel, xp_required: xp }, { onSuccess: () => setNewXp('') })
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-tight">Level Thresholds</h2>
        <p className="text-muted-foreground text-xs">
          XP needed to reach each level. Every level must need strictly more XP than the one below
          it. Students above the highest level stay at it until you add more. Changes apply to a
          student&rsquo;s stored level the next time they earn XP — existing levels aren&rsquo;t
          recomputed when you edit this list.
        </p>
      </div>

      <form className="mb-3 flex items-end gap-2" onSubmit={handleAdd} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="new-level-xp">Add level {nextLevel}</Label>
          <Input
            id="new-level-xp"
            type="number"
            min={0}
            className="w-40"
            placeholder="XP required"
            aria-invalid={!!addError}
            disabled={addingBase}
            value={addingBase ? '0' : newXp}
            onChange={(e) => {
              setNewXp(e.target.value)
              setAddError(null)
            }}
          />
        </div>
        <Button type="submit" disabled={createLevel.isPending || isPending}>
          <Plus />
          Add
        </Button>
      </form>
      {addError ? <p className="text-coral-d -mt-1 mb-3 text-sm">{addError}</p> : null}

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : isError ? (
        <p className="text-coral-d text-sm">Couldn&rsquo;t load level thresholds.</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No levels yet — add level 1 above.</p>
      ) : (
        <ul className="max-h-96 divide-y overflow-y-auto rounded-md border">
          {list.map((threshold) => (
            <ThresholdRow
              key={`${threshold.level}:${threshold.xp_required}`}
              threshold={threshold}
              thresholds={list}
              isSaving={updateLevel.isPending}
              onSave={(row) => updateLevel.mutate(row)}
              onDelete={setLevelToDelete}
            />
          ))}
        </ul>
      )}

      <AlertDialog
        open={levelToDelete !== null}
        onOpenChange={(open) => !open && setLevelToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete level {levelToDelete}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the level for good. Levels above it keep their numbers, so the list will
              skip {levelToDelete}. Students&rsquo; stored levels aren&rsquo;t recomputed until
              their next XP event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteLevel.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (levelToDelete !== null) {
                  deleteLevel.mutate(levelToDelete, {
                    onSuccess: () => setLevelToDelete(null),
                    onError: () => setLevelToDelete(null),
                  })
                }
              }}
            >
              {deleteLevel.isPending ? 'Deleting…' : 'Delete level'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
