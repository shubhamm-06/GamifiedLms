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
import { GameDialog } from '@/components/admin/games/GameDialog'
import { GameTable } from '@/components/admin/games/GameTable'
import {
  SLUG_TAKEN,
  useCreateGame,
  useDeleteGame,
  useGames,
  useUpdateGame,
  type Game,
  type GameFormValues,
} from '@/hooks/admin/useGames'

export function GamesPage() {
  const [search, setSearch] = useState('')
  const { data, isPending, isError } = useGames()

  const [dialogTarget, setDialogTarget] = useState<Game | null>(null)
  // Distinguishes "create dialog open, no game" from "dialog closed" — the
  // GameDialog's `game` prop being null means create mode, so the open flag
  // has to live separately.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)

  const createGame = useCreateGame()
  const updateGame = useUpdateGame()
  const deleteGame = useDeleteGame()

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
        onDelete={setGameToDelete}
      />

      <GameDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        game={dialogTarget}
        isSubmitting={createGame.isPending || updateGame.isPending}
        slugError={slugError}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!gameToDelete} onOpenChange={(open) => !open && setGameToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{gameToDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&rsquo;t be undone. If any lesson still uses this game, the delete will be
              refused instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteGame.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (gameToDelete) {
                  deleteGame.mutate(gameToDelete, {
                    onSuccess: () => setGameToDelete(null),
                    onError: () => setGameToDelete(null),
                  })
                }
              }}
            >
              {deleteGame.isPending ? 'Deleting…' : 'Delete game'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
