import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Game, GameFormValues } from '@/hooks/admin/useGames'
import { slugify } from '@/lib/slug'

const EMPTY_GAME: GameFormValues = {
  title: '',
  slug: '',
  description: '',
  thumbnail_url: '',
  bundle_url: '',
  bundle_version: '',
  bundle_size_bytes: '',
  checksum: '',
  max_xp: '0',
}

function gameToFormValues(game: Game): GameFormValues {
  return {
    title: game.title,
    slug: game.slug,
    description: game.description ?? '',
    thumbnail_url: game.thumbnail_url ?? '',
    bundle_url: game.bundle_url,
    bundle_version: game.bundle_version,
    bundle_size_bytes: String(game.bundle_size_bytes),
    checksum: game.checksum,
    max_xp: String(game.max_xp),
  }
}

interface GameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The game being edited, or null when creating a new one. */
  game: Game | null
  isSubmitting: boolean
  /** Set only after a failed submit — a slug collision surfaces inline, not as a toast. */
  slugError: string | null
  onSubmit: (values: GameFormValues) => void
}

/** Mounts fresh per open, so switching games never carries over stale state. */
function GameForm({
  game,
  isSubmitting,
  slugError,
  onSubmit,
  onCancel,
}: {
  game: Game | null
  isSubmitting: boolean
  slugError: string | null
  onSubmit: (values: GameFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<GameFormValues>(
    game ? gameToFormValues(game) : EMPTY_GAME,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Editing an existing game must never silently rewrite its slug because
  // someone tweaked the title, so edit starts "touched" — same rule as
  // CourseForm.
  const [slugTouched, setSlugTouched] = useState(!!game)

  function set<K extends keyof GameFormValues>(field: K, value: GameFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleTitleChange(title: string) {
    setValues((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    const title = values.title.trim()
    const slug = values.slug.trim() || slugify(title)

    if (!title) next.title = 'Title is required.'
    if (!slug) next.slug = 'Slug is required.'
    if (!values.bundle_url.trim()) next.bundle_url = 'Bundle URL is required.'
    if (!values.bundle_version.trim()) next.bundle_version = 'Bundle version is required.'

    const maxXp = Number(values.max_xp)
    if (!values.max_xp.trim() || Number.isNaN(maxXp) || maxXp < 0) {
      next.max_xp = 'Enter 0 or more.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({ ...values, title, slug })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="game-title">Title</Label>
        <Input
          id="game-title"
          value={values.title}
          aria-invalid={!!errors.title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
        {errors.title ? <p className="text-coral-d text-sm">{errors.title}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="game-slug">Slug</Label>
        <Input
          id="game-slug"
          value={values.slug}
          aria-invalid={!!(errors.slug || slugError)}
          onChange={(e) => {
            setSlugTouched(true)
            set('slug', e.target.value)
          }}
        />
        {errors.slug || slugError ? (
          <p className="text-coral-d text-sm">{errors.slug ?? slugError}</p>
        ) : (
          <p className="text-muted-foreground text-xs">Fills in from the title until you edit it.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="game-description">Description</Label>
        <Textarea
          id="game-description"
          rows={3}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="game-thumbnail">Thumbnail URL</Label>
        <Input
          id="game-thumbnail"
          value={values.thumbnail_url}
          onChange={(e) => set('thumbnail_url', e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Paste a hosted image link. Upload isn&rsquo;t wired yet (no Storage bucket exists).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="game-bundle-url">Bundle URL</Label>
        <Input
          id="game-bundle-url"
          value={values.bundle_url}
          aria-invalid={!!errors.bundle_url}
          onChange={(e) => set('bundle_url', e.target.value)}
        />
        {errors.bundle_url ? (
          <p className="text-coral-d text-sm">{errors.bundle_url}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Paste a hosted HTML/CSS/JS bundle URL. No upload flow or Storage bucket yet.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="game-bundle-version">Bundle version</Label>
        <Input
          id="game-bundle-version"
          value={values.bundle_version}
          placeholder="e.g. 1.0.0"
          aria-invalid={!!errors.bundle_version}
          onChange={(e) => set('bundle_version', e.target.value)}
        />
        {errors.bundle_version ? (
          <p className="text-coral-d text-sm">{errors.bundle_version}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="game-bundle-size">Bundle size (bytes)</Label>
          <Input
            id="game-bundle-size"
            type="number"
            min={0}
            value={values.bundle_size_bytes}
            onChange={(e) => set('bundle_size_bytes', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="game-checksum">Checksum</Label>
          <Input
            id="game-checksum"
            value={values.checksum}
            onChange={(e) => set('checksum', e.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Informational only for now — nothing reads or verifies these until the
        game-loading/playing side is built.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="game-max-xp">Max XP</Label>
        <Input
          id="game-max-xp"
          type="number"
          min={0}
          className="sm:w-1/2"
          value={values.max_xp}
          aria-invalid={!!errors.max_xp}
          onChange={(e) => set('max_xp', e.target.value)}
        />
        {errors.max_xp ? (
          <p className="text-coral-d text-sm">{errors.max_xp}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Server-side ceiling on a single play&rsquo;s XP award.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : game ? 'Save game' : 'Add game'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function GameDialog({
  open,
  onOpenChange,
  game,
  isSubmitting,
  slugError,
  onSubmit,
}: GameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{game ? 'Edit game' : 'New game'}</DialogTitle>
          <DialogDescription>
            {game ? game.title : 'A flat record — no nested content like a course has.'}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so switching between games remounts with fresh state instead
            of carrying the previous game's values over. */}
        <GameForm
          key={game?.id ?? 'new'}
          game={game}
          isSubmitting={isSubmitting}
          slugError={slugError}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
