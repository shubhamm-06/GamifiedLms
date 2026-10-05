import { AdminActionError, deleteUser } from '@/lib/adminUserApi'
import { supabase } from '@/lib/supabase'
import { mapLimit, type ItemFailure, type TrashEntity, type TrashItem } from '@/lib/trash'
import { FK_VIOLATION } from '@/lib/adminConstants'

/**
 * Permanent deletion — the ONLY place in the admin UI that removes a row for
 * good, and only ever imported by the Trash page. Everything else in the panel
 * moves things to the trash (`lib/trash.ts`).
 *
 * Nothing here shows a raw database error. Each entity has its own "blocked"
 * check with a readable message, and a blocked item simply stays in Trash:
 *   course — anything still referencing it (enrollments, payments, progress,
 *            quiz attempts, lesson XP) blocks it; the DB would only refuse the
 *            first four, so `fn_course_delete_blockers` covers the XP rule too
 *   module — never blocked; its live lessons are moved to the trash first
 *   lesson — student progress or quiz attempts
 *   game   — any lesson (trashed ones included) still uses it
 *   badge  — any student has unlocked it
 *   user   — the Edge Function refuses a user with activity history
 * Cascade behaviour is unchanged from before trash-first.
 */

export interface PermanentDeleteOutcome {
  deleted: TrashItem[]
  /** Refused for a reason the admin can act on; still in Trash. */
  blocked: ItemFailure[]
  /** Something else went wrong; still in Trash. */
  failed: ItemFailure[]
  /** Live lessons moved to trash by permanently deleting modules. */
  lessonsMoved: number
}

type Attempt =
  | { status: 'deleted'; lessonsMoved?: number }
  | { status: 'blocked'; reason: string }
  | { status: 'failed'; reason: string }

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** "2 enrollments, 1 payment" from the blocker counts, skipping zeros. */
function describeCourseBlockers(row: {
  enrollment_count: number
  payment_count: number
  lesson_progress_count: number
  quiz_attempt_count: number
  xp_transaction_count: number
}): string {
  return [
    row.enrollment_count > 0 && plural(row.enrollment_count, 'enrollment', 'enrollments'),
    row.payment_count > 0 && plural(row.payment_count, 'payment', 'payments'),
    row.lesson_progress_count > 0 && plural(row.lesson_progress_count, 'lesson progress record', 'lesson progress records'),
    row.quiz_attempt_count > 0 && plural(row.quiz_attempt_count, 'quiz attempt', 'quiz attempts'),
    row.xp_transaction_count > 0 && plural(row.xp_transaction_count, 'XP transaction', 'XP transactions'),
  ]
    .filter(Boolean)
    .join(', ')
}

/** A DELETE that RLS filtered to zero rows returns no error, so the row count is checked. */
async function deleteRow(table: 'courses' | 'lessons' | 'games' | 'badges', id: string): Promise<Attempt> {
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
  if (error) {
    if (error.code === FK_VIOLATION) {
      return { status: 'blocked', reason: 'Something still references it, so it stays in Trash.' }
    }
    console.error(`[permanentDelete] ${table} ${id}:`, error)
    return { status: 'failed', reason: 'Something went wrong. Please try again.' }
  }
  if (!data || data.length !== 1) {
    return { status: 'failed', reason: 'Nothing was deleted — it may already be gone, or you may not have permission.' }
  }
  return { status: 'deleted' }
}

async function attempt(entity: TrashEntity, item: TrashItem): Promise<Attempt> {
  switch (entity) {
    case 'courses': {
      const { data, error } = await supabase.rpc('fn_course_delete_blockers', { p_course_id: item.id })
      if (error) {
        console.error('[permanentDelete] fn_course_delete_blockers:', error)
        return { status: 'failed', reason: 'Could not check what still uses this course. Please try again.' }
      }
      const summary = data?.[0] ? describeCourseBlockers(data[0]) : ''
      if (summary) {
        return {
          status: 'blocked',
          reason: `It still has ${summary}, so it stays in Trash. Archive it instead if you only want it out of the way.`,
        }
      }
      return deleteRow('courses', item.id)
    }

    case 'modules': {
      const { data, error } = await supabase.rpc('fn_delete_module_permanently', { p_module_id: item.id })
      if (error) {
        console.error('[permanentDelete] fn_delete_module_permanently:', error)
        return { status: 'failed', reason: 'Something went wrong. Please try again.' }
      }
      return { status: 'deleted', lessonsMoved: data ?? 0 }
    }

    case 'lessons': {
      const result = await deleteRow('lessons', item.id)
      if (result.status === 'blocked') {
        return {
          status: 'blocked',
          reason: 'Students have progress or quiz attempts on this lesson, so it stays in Trash.',
        }
      }
      return result
    }

    case 'games': {
      // Counts trashed lessons too: the FK blocks on them, and RLS lets an admin see them.
      const { count, error } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', item.id)
      if (error) return { status: 'failed', reason: 'Could not check which lessons use this game.' }
      if ((count ?? 0) > 0) {
        return {
          status: 'blocked',
          reason: `Used by ${plural(count ?? 0, 'lesson', 'lessons')} (trashed lessons count too). Remove it from them first, or keep it in Trash.`,
        }
      }
      return deleteRow('games', item.id)
    }

    case 'badges': {
      const { count, error } = await supabase
        .from('user_badges')
        .select('id', { count: 'exact', head: true })
        .eq('badge_id', item.id)
      if (error) return { status: 'failed', reason: 'Could not check who unlocked this badge.' }
      if ((count ?? 0) > 0) {
        return {
          status: 'blocked',
          reason: `${plural(count ?? 0, 'student', 'students')} already unlocked it, so it stays in Trash.`,
        }
      }
      return deleteRow('badges', item.id)
    }

    case 'users': {
      try {
        await deleteUser(item.id)
        return { status: 'deleted' }
      } catch (e) {
        if (e instanceof AdminActionError) {
          // has_history and the guards are all "blocked, stays in Trash"; anything else is a failure.
          const blocking = ['has_history', 'self_target', 'primary_admin', 'last_admin', 'not_trashed']
          return e.code && blocking.includes(e.code)
            ? { status: 'blocked', reason: e.message }
            : { status: 'failed', reason: e.message }
        }
        console.error('[permanentDelete] user:', e)
        return { status: 'failed', reason: 'Something went wrong. Please try again.' }
      }
    }
  }
}

/** Runs per item; a blocked or failed one never stops the rest. Users run one at a time. */
export async function permanentlyDeleteItems(
  entity: TrashEntity,
  items: TrashItem[],
): Promise<PermanentDeleteOutcome> {
  const attempts = await mapLimit(items, entity === 'users' ? 1 : 3, (item) => attempt(entity, item))
  const outcome: PermanentDeleteOutcome = { deleted: [], blocked: [], failed: [], lessonsMoved: 0 }
  items.forEach((item, i) => {
    const a = attempts[i]
    if (a.status === 'deleted') {
      outcome.deleted.push(item)
      outcome.lessonsMoved += a.lessonsMoved ?? 0
    } else if (a.status === 'blocked') outcome.blocked.push({ item, reason: a.reason })
    else outcome.failed.push({ item, reason: a.reason })
  })
  return outcome
}

/** Archive is the alternative offered for a course that can't be deleted (a status, independent of trash). */
export async function archiveCourse(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('courses')
    .update({ status: 'archived' })
    .eq('id', id)
    .select('id')
  if (error || !data || data.length !== 1) return 'Could not archive it. Please try again.'
  return null
}
