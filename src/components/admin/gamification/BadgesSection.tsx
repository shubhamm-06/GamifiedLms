import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
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
import { useTableSelection } from '@/components/admin/selection/useTableSelection'
import { BadgeDialog } from '@/components/admin/gamification/BadgeDialog'
import { BadgeTable } from '@/components/admin/gamification/BadgeTable'
import {
  SLUG_TAKEN,
  useBadges,
  useCreateBadge,
  useSetBadgeActive,
  useUpdateBadge,
  type Badge,
  type BadgeFormValues,
} from '@/hooks/admin/useBadges'
import { useTrashActions } from '@/hooks/admin/useTrashActions'

/**
 * A flat record, so a Dialog rather than a route — same convention as
 * Games (`GamesPage.tsx`), which this mirrors closely.
 */
export function BadgesSection() {
  const [search, setSearch] = useState('')
  const { data, isPending, isError } = useBadges()

  const [dialogTarget, setDialogTarget] = useState<Badge | null>(null)
  // Distinguishes "create dialog open, no badge" from "dialog closed" — the
  // dialog's `badge` prop being null means create mode.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  // Unlike Games/Courses (immediate trash + Undo toast), archiving a badge
  // asks first — a badge can already be earned by real students, and while
  // archiving never touches their user_badges row (verified: it only sets
  // deleted_at/deleted_by on badges itself, no cascade), it does stop the
  // badge from ever being shown or awarded again, worth one more click to
  // confirm. Holds the whole batch pending confirmation, single or bulk.
  const [archiveBatch, setArchiveBatch] = useState<Badge[] | null>(null)

  const createBadge = useCreateBadge()
  const updateBadge = useUpdateBadge()
  const setActive = useSetBadgeActive()
  const { trash, isPending: trashPending } = useTrashActions()
  const selection = useTableSelection([search])
  const selectedBadges = (data ?? []).filter((b) => selection.rowSelection[b.id])

  const toItem = (badge: Badge) => ({ id: badge.id, name: badge.name, slug: badge.slug })

  async function confirmArchive() {
    if (!archiveBatch) return
    const result = await trash([{ entity: 'badges', items: archiveBatch.map(toItem) }])
    selection.removeIds(result.succeeded.map((item) => item.id))
    setArchiveBatch(null)
  }

  function openCreate() {
    setDialogTarget(null)
    setSlugError(null)
    setDialogOpen(true)
  }

  function openEdit(badge: Badge) {
    setDialogTarget(badge)
    setSlugError(null)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setSlugError(null)
  }

  function handleSubmit(values: BadgeFormValues) {
    setSlugError(null)
    const onError = (error: Error) => {
      if (error.message === SLUG_TAKEN) {
        setSlugError('This slug is already in use.')
        return
      }
      toast.error(error.message)
    }

    if (dialogTarget) {
      updateBadge.mutate(
        { id: dialogTarget.id, values },
        { onSuccess: () => setDialogOpen(false), onError },
      )
    } else {
      createBadge.mutate(values, { onSuccess: () => setDialogOpen(false), onError })
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Badges</h2>
          <p className="text-muted-foreground text-sm">
            {data?.length ?? 0} {(data?.length ?? 0) === 1 ? 'badge' : 'badges'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          New badge
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          className="pl-8"
          placeholder="Search by name…"
          aria-label="Search badges"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <BadgeTable
        badges={data ?? []}
        isPending={isPending}
        isError={isError}
        search={search}
        onEdit={openEdit}
        onToggleActive={(badge) => setActive.mutate({ id: badge.id, isActive: !badge.is_active })}
        onTrash={(badge) => setArchiveBatch([badge])}
        selection={selection}
        bulkActions={
          <Button
            variant="outline"
            size="sm"
            disabled={trashPending}
            onClick={() => setArchiveBatch(selectedBadges)}
          >
            Move to trash
          </Button>
        }
      />

      <AlertDialog open={!!archiveBatch} onOpenChange={(open) => !open && setArchiveBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveBatch?.length === 1
                ? `Archive "${archiveBatch[0].name}"?`
                : `Archive ${archiveBatch?.length ?? 0} badges?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              It stops appearing here and is never awarded again. Anyone who already earned it
              keeps it — this can&rsquo;t remove an earned badge. You can restore it from Trash later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trashPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={trashPending}
              onClick={(event) => {
                event.preventDefault()
                void confirmArchive()
              }}
            >
              {trashPending ? 'Archiving…' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BadgeDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        badge={dialogTarget}
        isSubmitting={createBadge.isPending || updateBadge.isPending}
        slugError={slugError}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
