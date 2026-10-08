import { AdminActionError, restoreUser, trashUser } from '@/lib/adminUserApi'
import { supabase } from '@/lib/supabase'
import { UNIQUE_VIOLATION, FK_VIOLATION, INSUFFICIENT_PRIVILEGE } from '@/lib/adminConstants'
import { getTerms as tw } from '@/lib/settings/terms'

/**
 * Trash / restore for the six trash-first entities (migration 013). Every
 * "delete" in the admin panel is `trashItems` — a soft delete — and the only
 * way back is `restoreItems`. Real deletion lives in `permanentDelete.ts` and
 * is only reachable from the Trash page.
 *
 * Everything here runs PER ITEM and returns which items worked and which did
 * not, so one failure never aborts the rest ("8 moved, 2 failed").
 */

export type TrashEntity = 'courses' | 'modules' | 'lessons' | 'games' | 'badges' | 'users'

export interface TrashItem {
  id: string
  /** What the admin sees in toasts and failure lists. */
  name: string
  /** Only needed to word a restore-time slug collision. */
  slug?: string
}

export interface ItemFailure {
  item: TrashItem
  reason: string
}

export interface BulkResult {
  succeeded: TrashItem[]
  failed: ItemFailure[]
}

export const ENTITY_NOUN: Record<TrashEntity, { one: string; many: string }> = {
  // Getters: the words follow the terminology settings (display only; the entity keys stay).
  courses: { get one() { return tw().lower('course') }, get many() { return tw().lower('course', true) } },
  modules: { get one() { return tw().lower('module') }, get many() { return tw().lower('module', true) } },
  lessons: { get one() { return tw().lower('lesson') }, get many() { return tw().lower('lesson', true) } },
  games: { one: 'game', many: 'games' },
  badges: { get one() { return tw().lower('badge') }, get many() { return tw().lower('badge', true) } },
  users: { one: 'user', many: 'users' },
}

/** Parents before children, so restoring a mixed set never trips over its own parent. */
export const RESTORE_RANK: Record<TrashEntity, number> = {
  courses: 0,
  games: 0,
  badges: 0,
  users: 0,
  modules: 1,
  lessons: 2,
}

type ContentTable = Exclude<TrashEntity, 'users'>

/** Runs `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Never leaks a raw Postgres message: known codes get a sentence, the rest a generic one. */
function reasonFromError(
  error: { code?: string; message?: string },
  entity: TrashEntity,
  item: TrashItem,
  action: 'trash' | 'restore',
): string {
  if (error.code === UNIQUE_VIOLATION && action === 'restore') {
    const noun = ENTITY_NOUN[entity].one
    return item.slug
      ? `Another live ${noun} already uses the slug “${item.slug}”. Rename that ${noun}, or move it to trash, then restore this one.`
      : `Another live ${noun} already uses the same slug. Rename it, or move it to trash, then restore this one.`
  }
  if (error.code === FK_VIOLATION) return 'Something still references this item.'
  if (error.code === INSUFFICIENT_PRIVILEGE) return "You don't have permission to do that."
  console.error(`[trash] ${action} ${entity} ${item.id}:`, error)
  return 'Something went wrong. Please try again.'
}

function reasonFromThrown(e: unknown, entity: TrashEntity, item: TrashItem, action: 'trash' | 'restore') {
  // Edge Function refusals (self / primary admin / last admin / already trashed …)
  // already carry a readable message.
  if (e instanceof AdminActionError) return e.message
  return reasonFromError({ message: e instanceof Error ? e.message : String(e) }, entity, item, action)
}

async function trashOne(entity: TrashEntity, item: TrashItem): Promise<string | null> {
  if (entity === 'users') {
    try {
      await trashUser(item.id)
      return null
    } catch (e) {
      return reasonFromThrown(e, entity, item, 'trash')
    }
  }

  // `.select('id')` + the row-count check is the point: a write that RLS
  // filters to zero rows returns NO error, and the old delete hooks that only
  // looked at `error` reported success for a delete that never happened.
  const { data, error } = await supabase
    .from(entity as ContentTable as 'courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', item.id)
    .is('deleted_at', null)
    .select('id')

  if (error) return reasonFromError(error, entity, item, 'trash')
  if (!data || data.length !== 1) {
    return 'It was not moved — it may already be in the trash, or you may not have permission.'
  }
  return null
}

/** Moves each item to the trash. Users run one at a time so the last-admin guard sees a consistent count. */
export async function trashItems(entity: TrashEntity, items: TrashItem[]): Promise<BulkResult> {
  const reasons = await mapLimit(items, entity === 'users' ? 1 : 4, (item) => trashOne(entity, item))
  return collect(items, reasons)
}

async function restoreBlocker(entity: TrashEntity, item: TrashItem): Promise<string | null> {
  if (entity !== 'modules' && entity !== 'lessons') return null
  const { data, error } = await supabase.rpc('fn_restore_blockers', {
    p_type: entity === 'modules' ? 'module' : 'lesson',
    p_id: item.id,
  })
  if (error) return reasonFromError(error, entity, item, 'restore')
  const blocker = data?.[0]
  if (!blocker) return null
  return `Its ${blocker.blocking_type} “${blocker.blocking_title}” is in the trash. Restore that first.`
}

async function restoreOne(entity: TrashEntity, item: TrashItem): Promise<string | null> {
  if (entity === 'users') {
    try {
      await restoreUser(item.id)
      return null
    } catch (e) {
      return reasonFromThrown(e, entity, item, 'restore')
    }
  }

  const blocked = await restoreBlocker(entity, item)
  if (blocked) return blocked

  const { data, error } = await supabase
    .from(entity as ContentTable as 'courses')
    .update({ deleted_at: null })
    .eq('id', item.id)
    .not('deleted_at', 'is', null)
    .select('id')

  if (error) return reasonFromError(error, entity, item, 'restore')
  if (!data || data.length !== 1) {
    return 'It was not restored — it may already be back, or you may not have permission.'
  }
  return null
}

export async function restoreItems(entity: TrashEntity, items: TrashItem[]): Promise<BulkResult> {
  const reasons = await mapLimit(items, entity === 'users' ? 1 : 4, (item) => restoreOne(entity, item))
  return collect(items, reasons)
}

function collect(items: TrashItem[], reasons: (string | null)[]): BulkResult {
  const result: BulkResult = { succeeded: [], failed: [] }
  items.forEach((item, i) => {
    const reason = reasons[i]
    if (reason === null) result.succeeded.push(item)
    else result.failed.push({ item, reason })
  })
  return result
}
