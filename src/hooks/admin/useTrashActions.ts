import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateAdminData } from '@/lib/queryClient'
import {
  RESTORE_RANK,
  restoreItems,
  trashItems,
  type BulkResult,
  type ItemFailure,
  type TrashEntity,
  type TrashItem,
} from '@/lib/trash'

export interface TrashGroup {
  entity: TrashEntity
  items: TrashItem[]
}

const EMPTY: BulkResult = { succeeded: [], failed: [] }

function merge(results: BulkResult[]): BulkResult {
  return {
    succeeded: results.flatMap((r) => r.succeeded),
    failed: results.flatMap((r) => r.failed),
  }
}

/** "Name — reason" for the first few failures, so a partial failure explains itself. */
export function describeFailures(failed: ItemFailure[]): string {
  const shown = failed.slice(0, 3).map((f) => `${f.item.name} — ${f.reason}`)
  const more = failed.length - shown.length
  return shown.join('\n') + (more > 0 ? `\n+${more} more` : '')
}

/**
 * The one place that turns a trash/restore into UI: runs the per-item
 * operation, refreshes every admin query (lists, counts, the Trash badge),
 * and shows the toast — with an Undo that restores exactly the items that
 * were moved.
 */
export function useTrashActions() {
  const queryClient = useQueryClient()
  const [pendingCount, setPendingCount] = useState(0)

  function refresh() {
    return invalidateAdminData(queryClient)
  }

  async function track<T>(work: () => Promise<T>): Promise<T> {
    setPendingCount((n) => n + 1)
    try {
      return await work()
    } finally {
      setPendingCount((n) => n - 1)
    }
  }

  /** Restore, parents first. `announce: false` is for callers that show their own toast. */
  async function restore(groups: TrashGroup[], options?: { announce?: boolean }): Promise<BulkResult> {
    const ordered = [...groups].sort((a, b) => RESTORE_RANK[a.entity] - RESTORE_RANK[b.entity])
    const result = await track(async () => {
      const results: BulkResult[] = []
      for (const group of ordered) {
        if (group.items.length > 0) results.push(await restoreItems(group.entity, group.items))
      }
      return merge(results)
    })
    await refresh()

    if (options?.announce !== false) {
      const n = result.succeeded.length
      const f = result.failed.length
      if (n > 0 && f === 0) {
        toast.success(n === 1 ? `Restored ${result.succeeded[0].name}` : `Restored ${n} items`)
      } else if (n > 0) {
        toast.warning(`${n} restored, ${f} failed`, { description: describeFailures(result.failed) })
      } else if (f > 0) {
        toast.error(f === 1 ? result.failed[0].reason : `${f} could not be restored`, {
          description: f === 1 ? undefined : describeFailures(result.failed),
        })
      }
    }
    return result
  }

  /** Move to trash. Shows "Moved N items to trash" with Undo, or a partial-failure summary. */
  async function trash(groups: TrashGroup[]): Promise<BulkResult> {
    const perGroup = await track(async () => {
      const done: { entity: TrashEntity; result: BulkResult }[] = []
      for (const group of groups) {
        if (group.items.length > 0) {
          done.push({ entity: group.entity, result: await trashItems(group.entity, group.items) })
        }
      }
      return done
    })
    await refresh()

    const result = merge(perGroup.map((g) => g.result))
    const n = result.succeeded.length
    const f = result.failed.length
    const undo = {
      label: 'Undo',
      onClick: () => {
        void restore(
          perGroup.map((g) => ({ entity: g.entity, items: g.result.succeeded })),
          { announce: false },
        ).then((undone) => {
          if (undone.failed.length === 0) {
            toast.success(
              undone.succeeded.length === 1 ? `Restored ${undone.succeeded[0].name}` : `Restored ${undone.succeeded.length} items`,
            )
          } else {
            toast.warning(`${undone.succeeded.length} restored, ${undone.failed.length} failed`, {
              description: describeFailures(undone.failed),
            })
          }
        })
      },
    }

    if (n > 0 && f === 0) {
      toast.success(n === 1 ? `Moved ${result.succeeded[0].name} to trash` : `Moved ${n} items to trash`, {
        action: undo,
        duration: 10_000,
      })
    } else if (n > 0) {
      toast.warning(`${n} moved, ${f} failed`, {
        description: describeFailures(result.failed),
        action: undo,
        duration: 12_000,
      })
    } else if (f > 0) {
      toast.error(f === 1 ? result.failed[0].reason : `${f} could not be moved to trash`, {
        description: f === 1 ? undefined : describeFailures(result.failed),
      })
    }
    return n + f === 0 ? EMPTY : result
  }

  return {
    trash,
    restore,
    /** True while any trash/restore is in flight. */
    isPending: pendingCount > 0,
  }
}
