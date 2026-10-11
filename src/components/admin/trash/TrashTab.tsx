import { useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTableSelection } from '@/components/admin/selection/useTableSelection'
import { PermanentDeleteDialog } from '@/components/admin/trash/PermanentDeleteDialog'
import { RestoreConfirmDialog } from '@/components/admin/trash/RestoreConfirmDialog'
import { TrashTable } from '@/components/admin/trash/TrashTable'
import { useTrashedRows, type TrashRow } from '@/hooks/admin/useTrash'
import { describeFailures, useTrashActions } from '@/hooks/admin/useTrashActions'
import { ENTITY_NOUN, type TrashEntity, type TrashItem } from '@/lib/trash'
import { getTerms as tw } from '@/lib/settings/terms'

const NAME_HEADER: Record<TrashEntity, string> = {
  courses: `${tw().term('course')}`,
  modules: `${tw().term('module')}`,
  lessons: `${tw().term('lesson')}`,
  games: 'Game',
  badges: `${tw().term('badge')}`,
  users: 'User',
  notifications: 'Notification',
}

const toItem = (row: TrashRow): TrashItem => ({ id: row.id, name: row.name, slug: row.slug })

/**
 * One Trash tab: search, the table, and every action — Restore, Delete
 * permanently, and Empty trash — each usable on one row or a multi-select.
 */
export function TrashTab({ entity }: { entity: TrashEntity }) {
  const { data, isPending, isError } = useTrashedRows(entity)
  const rows = data ?? []
  const noun = ENTITY_NOUN[entity]

  const [search, setSearch] = useState('')
  const selection = useTableSelection([search])
  const { restore, isPending: restoring } = useTrashActions()

  // Restoring a course/module asks first (it reveals children); the rest restore at once.
  const [restoreTargets, setRestoreTargets] = useState<TrashRow[]>([])
  const [deleteRequest, setDeleteRequest] = useState<{ rows: TrashRow[]; mode: 'delete' | 'empty' } | null>(
    null,
  )

  const selectedRows = rows.filter((r) => selection.rowSelection[r.id])

  async function doRestore(target: TrashRow[]) {
    // Notifications get their own toast wording ("visible in student inboxes
    // again" — the consequence that matters here, not a generic item count):
    // announce: false suppresses the shared hook's own toast so this one
    // doesn't double up.
    if (entity === 'notifications') {
      const result = await restore([{ entity, items: target.map(toItem) }], { announce: false })
      selection.removeIds(result.succeeded.map((item) => item.id))
      setRestoreTargets([])
      const n = result.succeeded.length
      const f = result.failed.length
      if (n > 0 && f === 0) {
        toast.success(
          n === 1
            ? 'Restored. It is visible in student inboxes again.'
            : `Restored ${n} notifications. They are visible in student inboxes again.`,
        )
      } else if (n > 0) {
        toast.warning(`${n} restored, ${f} failed`, { description: describeFailures(result.failed) })
      } else if (f > 0) {
        toast.error(f === 1 ? result.failed[0].reason : `${f} could not be restored`, {
          description: f === 1 ? undefined : describeFailures(result.failed),
        })
      }
      return
    }
    const result = await restore([{ entity, items: target.map(toItem) }])
    selection.removeIds(result.succeeded.map((item) => item.id))
    setRestoreTargets([])
  }

  function requestRestore(target: TrashRow[]) {
    if (target.length === 0) return
    if (entity === 'courses' || entity === 'modules') setRestoreTargets(target)
    else void doRestore(target)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            className="pl-8"
            placeholder={`Search ${noun.many} in trash…`}
            aria-label={`Search ${noun.many} in trash`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="text-destructive"
          disabled={rows.length === 0}
          onClick={() => setDeleteRequest({ rows, mode: 'empty' })}
        >
          Empty trash
        </Button>
      </div>

      <TrashTable
        rows={rows}
        isPending={isPending}
        isError={isError}
        noun={noun.one}
        nounMany={noun.many}
        nameHeader={NAME_HEADER[entity]}
        search={search}
        onRestore={(row) => requestRestore([row])}
        onDeletePermanently={(row) => setDeleteRequest({ rows: [row], mode: 'delete' })}
        selection={selection}
        bulkActions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={restoring}
              onClick={() => requestRestore(selectedRows)}
            >
              Restore
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteRequest({ rows: selectedRows, mode: 'delete' })}
            >
              Delete permanently
            </Button>
          </>
        }
      />

      {entity === 'courses' || entity === 'modules' ? (
        <RestoreConfirmDialog
          entity={entity}
          count={restoreTargets.length}
          open={restoreTargets.length > 0}
          pending={restoring}
          onOpenChange={(open) => !open && setRestoreTargets([])}
          onConfirm={() => void doRestore(restoreTargets)}
        />
      ) : null}

      <PermanentDeleteDialog
        entity={entity}
        items={(deleteRequest?.rows ?? []).map(toItem)}
        mode={deleteRequest?.mode ?? 'delete'}
        open={deleteRequest !== null}
        onOpenChange={(open) => !open && setDeleteRequest(null)}
        onFinished={(outcome) => selection.removeIds(outcome.deleted.map((item) => item.id))}
      />
    </div>
  )
}
