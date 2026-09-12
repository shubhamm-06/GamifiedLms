import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type Game = Tables<'games'>

export const gamesQueryKey = ['admin', 'games'] as const

/** Postgres unique-violation — surfaced as an inline slug error, not a toast. */
const UNIQUE_VIOLATION = '23505'
export const SLUG_TAKEN = 'SLUG_TAKEN'

/** Postgres FK violation — a game still referenced by a lesson can't be deleted. */
const FK_VIOLATION = '23503'
export const GAME_IN_USE_PREFIX = 'GAME_IN_USE:'

function mapWriteError(error: { code?: string; message: string }): Error {
  if (error.code === UNIQUE_VIOLATION && error.message.includes('slug')) {
    return new Error(SLUG_TAKEN)
  }
  return new Error(error.message)
}

/**
 * Every game in one query — the catalog is small and the list page sorts,
 * filters and paginates client-side, same reasoning as `useCourses`. This is
 * also what the lesson editor's game picker uses (`LessonDialog.tsx`) — one
 * query, one cache entry, so a game renamed here can't show stale in the
 * picker or vice versa.
 */
export function useGames() {
  return useQuery({
    queryKey: gamesQueryKey,
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/**
 * Fields the form owns. `bundle_size_bytes` and `checksum` are optional in
 * the UI even though the columns are NOT NULL — nothing reads or verifies
 * them yet (the game-loading/playing side doesn't exist), so a blank input
 * writes a safe default (0 / '') rather than blocking submit on metadata
 * nobody can usefully provide today.
 */
export interface GameFormValues {
  title: string
  slug: string
  description: string
  thumbnail_url: string
  bundle_url: string
  bundle_version: string
  bundle_size_bytes: string
  checksum: string
  max_xp: string
}

function toRow(values: GameFormValues) {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || null,
    thumbnail_url: values.thumbnail_url.trim() || null,
    bundle_url: values.bundle_url.trim(),
    bundle_version: values.bundle_version.trim(),
    bundle_size_bytes: values.bundle_size_bytes.trim() ? Number(values.bundle_size_bytes) : 0,
    checksum: values.checksum.trim(),
    max_xp: Number(values.max_xp),
  }
}

function useGamesInvalidator() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: gamesQueryKey })
}

export function useCreateGame() {
  const invalidate = useGamesInvalidator()
  return useMutation({
    mutationFn: async (values: GameFormValues): Promise<Game> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('games')
        .insert({ ...toRow(values), created_by: user?.id ?? null })
        .select()
        .single()

      if (error) throw mapWriteError(error)
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Game added.')
    },
  })
}

export function useUpdateGame() {
  const invalidate = useGamesInvalidator()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: GameFormValues }) => {
      const { error } = await supabase.from('games').update(toRow(values)).eq('id', id)
      if (error) throw mapWriteError(error)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Game saved.')
    },
  })
}

export function useDeleteGame() {
  const invalidate = useGamesInvalidator()
  return useMutation({
    mutationFn: async (game: Game) => {
      const { error } = await supabase.from('games').delete().eq('id', game.id)
      if (error?.code === FK_VIOLATION) {
        // lessons.game_id has no ON DELETE action, so the FK violation alone
        // doesn't say how many lessons are blocking it — a second query gets
        // the count for a message worth showing, rather than a raw Postgres
        // error. Only run on the error path since the happy path (no
        // references) never needs it.
        const { count } = await supabase
          .from('lessons')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', game.id)
        throw new Error(`${GAME_IN_USE_PREFIX}${count ?? 0}`)
      }
      if (error) throw new Error(error.message)
    },
    onSuccess: (_result, game) => {
      invalidate()
      toast.success(`“${game.title}” was deleted.`)
    },
    onError: (error: Error) => {
      if (error.message.startsWith(GAME_IN_USE_PREFIX)) {
        const count = error.message.slice(GAME_IN_USE_PREFIX.length)
        toast.error(
          `This game is used by ${count} lesson${count === '1' ? '' : 's'} — remove it from ${count === '1' ? 'that lesson' : 'those lessons'} first.`,
        )
        return
      }
      toast.error(error.message)
    },
  })
}
