import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTableSelection } from '@/components/admin/selection/useTableSelection'
import { GameDialog } from '@/components/admin/games/GameDialog'
import { GameTable } from '@/components/admin/games/GameTable'
import {
  SLUG_TAKEN,
  useCreateGame,
  useGames,
  useUpdateGame,
  type Game,
  type GameFormValues,
} from '@/hooks/admin/useGames'
import { useTrashActions } from '@/hooks/admin/useTrashActions'

export function GamesPage() {
  const [search, setSearch] = useState('')
  const { data, isPending, isError } = useGames()

  const [dialogTarget, setDialogTarget] = useState<Game | null>(null)
  // Distinguishes "create dialog open, no game" from "dialog closed" — the
  // GameDialog's `game` prop being null means create mode, so the open flag
  // has to live separately.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)

  const createGame = useCreateGame()
  const updateGame = useUpdateGame()
  const { trash, isPending: trashPending } = useTrashActions()
  const selection = useTableSelection([search])
  const selectedGames = (data ?? []).filter((g) => selection.rowSelection[g.id])

  const toItem = (game: Game) => ({ id: game.id, name: game.title, slug: game.slug })

  // No confirm dialog: trashing is reversible, so the Undo toast is the safety net.
  async function handleTrash(games: Game[]) {
    const result = await trash([{ entity: 'games', items: games.map(toItem) }])
    selection.removeIds(result.succeeded.map((item) => item.id))
  }

  function openCreate() {
    setDialogTarget(null)
    setSlugError(null)
    setDialogOpen(true)
  }

  function openEdit(game: Game) {
    setDialogTarget(game)
    setSlugError(null)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setSlugError(null)
  }

  function handleSubmit(values: GameFormValues) {
    setSlugError(null)
    const onError = (error: Error) => {
      if (error.message === SLUG_TAKEN) {
        setSlugError('This slug is already in use.')
        return
      }
      toast.error(error.message)
    }

    if (dialogTarget) {
      updateGame.mutate(
        { id: dialogTarget.id, values },
        { onSuccess: () => setDialogOpen(false), onError },
      )
    } else {
      createGame.mutate(values, { onSuccess: () => setDialogOpen(false), onError })
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Games</h1>
          <p className="text-muted-foreground text-sm">
            {data?.length ?? 0} {(data?.length ?? 0) === 1 ? 'game' : 'games'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          New game
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          className="pl-8"
          placeholder="Search by title…"
          aria-label="Search games"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <GameTable
        games={data ?? []}
        isPending={isPending}
        isError={isError}
        search={search}
        onEdit={openEdit}
        onTrash={(game) => void handleTrash([game])}
        selection={selection}
        bulkActions={
          <Button
            variant="outline"
            size="sm"
            disabled={trashPending}
            onClick={() => void handleTrash(selectedGames)}
          >
            Move to trash
          </Button>
        }
      />

      <GameDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        game={dialogTarget}
        isSubmitting={createGame.isPending || updateGame.isPending}
        slugError={slugError}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
