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
import { BadgeDialog } from '@/components/admin/gamification/BadgeDialog'
import { BadgeTable } from '@/components/admin/gamification/BadgeTable'
import {
  SLUG_TAKEN,
  useBadges,
  useCreateBadge,
  useDeleteBadge,
  useSetBadgeActive,
  useUpdateBadge,
  type Badge,
  type BadgeFormValues,
} from '@/hooks/admin/useBadges'

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
  const [badgeToDelete, setBadgeToDelete] = useState<Badge | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)

  const createBadge = useCreateBadge()
  const updateBadge = useUpdateBadge()
  const setActive = useSetBadgeActive()
  const deleteBadge = useDeleteBadge()

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
        onDelete={setBadgeToDelete}
      />

      <BadgeDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        badge={dialogTarget}
        isSubmitting={createBadge.isPending || updateBadge.isPending}
        slugError={slugError}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!badgeToDelete} onOpenChange={(open) => !open && setBadgeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{badgeToDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&rsquo;t be undone. If any student has already unlocked this badge, the delete
              will be refused instead — deactivate it to stop awarding it without touching anyone
              who already has it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteBadge.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (badgeToDelete) {
                  deleteBadge.mutate(badgeToDelete, {
                    onSuccess: () => setBadgeToDelete(null),
                    onError: () => setBadgeToDelete(null),
                  })
                }
              }}
            >
              {deleteBadge.isPending ? 'Deleting…' : 'Delete badge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
