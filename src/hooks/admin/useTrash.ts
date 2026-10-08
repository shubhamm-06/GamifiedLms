import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TrashEntity } from '@/lib/trash'
import { getTerms as tw } from '@/lib/settings/terms'

/**
 * Trash page data. Every key starts with `['admin', 'trash']`, so the
 * invalidation in `useTrashActions` (which refreshes everything under
 * `['admin']`) also refreshes the sidebar badge and every tab.
 */
const trashKeys = {
  counts: ['admin', 'trash', 'counts'] as const,
  rows: (entity: TrashEntity) => ['admin', 'trash', 'rows', entity] as const,
  moduleLessons: (ids: string[]) => ['admin', 'trash', 'moduleLessons', [...ids].sort().join(',')] as const,
}

export const TRASH_ENTITIES: TrashEntity[] = ['courses', 'modules', 'lessons', 'games', 'badges', 'users']

type TrashCounts = Record<TrashEntity, number> & { total: number }

const TABLE_OF: Record<TrashEntity, 'courses' | 'modules' | 'lessons' | 'games' | 'badges' | 'profiles'> = {
  courses: 'courses',
  modules: 'modules',
  lessons: 'lessons',
  games: 'games',
  badges: 'badges',
  users: 'profiles',
}

/** How many rows are in the trash, per tab and in total (the sidebar badge). Rows hidden only through a trashed parent are not counted — they were never trashed themselves. */
export function useTrashCounts() {
  return useQuery({
    queryKey: trashKeys.counts,
    queryFn: async (): Promise<TrashCounts> => {
      const entries = await Promise.all(
        TRASH_ENTITIES.map(async (entity) => {
          const { count, error } = await supabase
            .from(TABLE_OF[entity])
            .select('*', { count: 'exact', head: true })
            .not('deleted_at', 'is', null)
          if (error) throw new Error(error.message)
          return [entity, count ?? 0] as const
        }),
      )
      const counts = Object.fromEntries(entries) as Record<TrashEntity, number>
      return { ...counts, total: entries.reduce((sum, [, n]) => sum + n, 0) }
    },
  })
}

/** A trashed row, normalised so one table component serves all six tabs. */
export interface TrashRow {
  id: string
  name: string
  /** Secondary line under the name (slug, email …). */
  detail: string | null
  slug?: string
  /** The short "was in" context: the parent course for a module, course › topic for a lesson. */
  wasIn: string
  deletedAt: string
  /** Resolved display name; null when the admin who trashed it has since been deleted. */
  deletedBy: string | null
  /** A trashed parent that makes Restore pointless until it is restored first. */
  restoreBlockedBy: { type: 'course' | 'module'; title: string } | null
}

interface Deleter {
  deleter: { display_name: string } | null
}
interface CourseParent {
  id: string
  title: string
  deleted_at: string | null
}

const NOT_TRASHED_YET = { ascending: false } as const

function deleterName(row: Deleter): string | null {
  return row.deleter?.display_name ?? null
}

async function fetchRows(entity: TrashEntity): Promise<TrashRow[]> {
  switch (entity) {
    case 'courses': {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, slug, status, deleted_at, deleter:profiles!courses_deleted_by_fkey(display_name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', NOT_TRASHED_YET)
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as (Deleter & { id: string; title: string; slug: string; status: string; deleted_at: string })[]).map((r) => ({
        id: r.id,
        name: r.title,
        detail: r.slug,
        slug: r.slug,
        wasIn: `${r.status.charAt(0).toUpperCase()}${r.status.slice(1)} ${tw().lower('course')}`,
        deletedAt: r.deleted_at,
        deletedBy: deleterName(r),
        restoreBlockedBy: null,
      }))
    }
    case 'modules': {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title, deleted_at, course:courses!modules_course_id_fkey(id, title, deleted_at), deleter:profiles!modules_deleted_by_fkey(display_name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', NOT_TRASHED_YET)
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as (Deleter & { id: string; title: string; deleted_at: string; course: CourseParent | null })[]).map((r) => ({
        id: r.id,
        name: r.title,
        detail: null,
        wasIn: r.course?.title ?? '—',
        deletedAt: r.deleted_at,
        deletedBy: deleterName(r),
        restoreBlockedBy: r.course?.deleted_at ? { type: 'course' as const, title: r.course.title } : null,
      }))
    }
    case 'lessons': {
      const { data, error } = await supabase
        .from('lessons')
        .select(
          'id, title, deleted_at, course:courses!lessons_course_id_fkey(id, title, deleted_at), module:modules!lessons_module_id_fkey(id, title, deleted_at), deleter:profiles!lessons_deleted_by_fkey(display_name)',
        )
        .not('deleted_at', 'is', null)
        .order('deleted_at', NOT_TRASHED_YET)
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as (Deleter & { id: string; title: string; deleted_at: string; course: CourseParent | null; module: CourseParent | null })[]).map((r) => ({
        id: r.id,
        name: r.title,
        detail: null,
        wasIn: `${r.course?.title ?? '—'} › ${r.module?.title ?? 'Ungrouped'}`,
        deletedAt: r.deleted_at,
        deletedBy: deleterName(r),
        // Course first: if both are trashed, restoring the course alone is not enough, but it is the first step.
        restoreBlockedBy: r.course?.deleted_at
          ? { type: 'course' as const, title: r.course.title }
          : r.module?.deleted_at
            ? { type: 'module' as const, title: r.module.title }
            : null,
      }))
    }
    case 'games': {
      const { data, error } = await supabase
        .from('games')
        .select('id, title, slug, deleted_at, deleter:profiles!games_deleted_by_fkey(display_name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', NOT_TRASHED_YET)
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as (Deleter & { id: string; title: string; slug: string; deleted_at: string })[]).map((r) => ({
        id: r.id,
        name: r.title,
        detail: r.slug,
        slug: r.slug,
        wasIn: '—',
        deletedAt: r.deleted_at,
        deletedBy: deleterName(r),
        restoreBlockedBy: null,
      }))
    }
    case 'badges': {
      const { data, error } = await supabase
        .from('badges')
        .select('id, name, slug, deleted_at, deleter:profiles!badges_deleted_by_fkey(display_name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', NOT_TRASHED_YET)
      if (error) throw new Error(error.message)
      return ((data ?? []) as unknown as (Deleter & { id: string; name: string; slug: string; deleted_at: string })[]).map((r) => ({
        id: r.id,
        name: r.name,
        detail: r.slug,
        slug: r.slug,
        wasIn: '—',
        deletedAt: r.deleted_at,
        deletedBy: deleterName(r),
        restoreBlockedBy: null,
      }))
    }
    case 'users': {
      // No embed for "deleted by": profiles -> profiles is a self-join, and
      // PostgREST resolves `profiles!deleted_by(...)` in the CHILD direction
      // (the users this user trashed), which silently yields "Unknown". Look the
      // names up by id instead.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, role, deleted_at, deleted_by')
        .not('deleted_at', 'is', null)
        .order('deleted_at', NOT_TRASHED_YET)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as {
        id: string
        display_name: string
        email: string
        role: string
        deleted_at: string
        deleted_by: string | null
      }[]

      const deleterIds = [...new Set(rows.map((r) => r.deleted_by).filter((id): id is string => !!id))]
      const names = new Map<string, string>()
      if (deleterIds.length > 0) {
        const { data: deleters, error: deletersError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', deleterIds)
        if (deletersError) throw new Error(deletersError.message)
        for (const d of deleters ?? []) names.set(d.id, d.display_name)
      }

      return rows.map((r) => ({
        id: r.id,
        name: r.display_name,
        detail: r.email,
        wasIn: r.role === 'admin' ? 'Admin' : 'Student',
        deletedAt: r.deleted_at,
        deletedBy: r.deleted_by ? (names.get(r.deleted_by) ?? null) : null,
        restoreBlockedBy: null,
      }))
    }
  }
}

export function useTrashedRows(entity: TrashEntity) {
  return useQuery({
    queryKey: trashKeys.rows(entity),
    queryFn: () => fetchRows(entity),
  })
}

/**
 * How many still-live lessons each trashed module holds — the number the
 * permanent-delete dialog quotes ("N lessons will move to trash") because
 * `fn_delete_module_permanently` trashes them first. Lessons already trashed on
 * their own are not counted (they are already in Trash).
 */
export function useModuleLiveLessonCount(moduleIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: trashKeys.moduleLessons(moduleIds),
    enabled: enabled && moduleIds.length > 0,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .in('module_id', moduleIds)
        .is('deleted_at', null)
      if (error) throw new Error(error.message)
      return count ?? 0
    },
  })
}
