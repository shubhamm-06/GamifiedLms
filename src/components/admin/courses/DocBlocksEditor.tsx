import { useState, type ComponentType } from 'react'
import { Check, CircleHelp, Heart, ImageIcon, Info, Lightbulb, Pencil, Plus, Star, Trash2, Type } from 'lucide-react'
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
import { DragHandle, SimpleSortableList } from '@/components/admin/dnd/SimpleSortableList'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useBlockMutations,
  useContentBlocks,
  type BlockFormValues,
  type BlockType,
  type ContentBlock,
} from '@/hooks/admin/useCurriculum'
import { CALLOUT_COLORS, CALLOUT_ICONS, type CalloutColor, type CalloutIcon } from '@/lib/lessonBlocks'
import { cn } from '@/lib/utils'

const BLOCK_TYPES: { value: BlockType; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: 'paragraph', label: 'Paragraph', icon: Type },
  { value: 'callout', label: 'Callout', icon: Info },
  { value: 'image', label: 'Image', icon: ImageIcon },
]

// Same icon set the kid renderer uses (DocBlocks.tsx) — kept as its own small
// mapping rather than importing that kid-facing component's, so admin and
// kid stay independent of each other's React trees; `lib/lessonBlocks.ts`'s
// CALLOUT_ICONS is the one shared source of truth for the value set itself.
const ICONS: Record<CalloutIcon, ComponentType<{ className?: string }>> = {
  info: Info,
  idea: Lightbulb,
  star: Star,
  heart: Heart,
  question: CircleHelp,
}

// Tailwind's scanner needs the full class name literally in source — a
// template literal like `bg-${color}` is invisible to it and would ship
// unstyled swatches, so each one is spelled out here instead.
const COLOR_BG_CLASS: Record<CalloutColor, string> = {
  gold: 'bg-gold',
  teal: 'bg-teal',
  coral: 'bg-coral',
  plum: 'bg-plum',
}

interface BlockFormState {
  type: BlockType
  text: string
  color: CalloutColor | ''
  icon: CalloutIcon | ''
  url: string
  alt: string
}

function emptyForm(): BlockFormState {
  return { type: 'paragraph', text: '', color: '', icon: '', url: '', alt: '' }
}

function blockToFormState(block: ContentBlock): BlockFormState {
  return {
    type: block.block_type as BlockType,
    text: block.text_content ?? '',
    color: (block.callout_color as CalloutColor) ?? '',
    icon: (block.callout_icon as CalloutIcon) ?? '',
    url: block.image_url ?? '',
    alt: block.image_alt ?? '',
  }
}

const IMAGE_URL_RE = /^https?:\/\//i

function validate(state: BlockFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (state.type === 'paragraph') {
    if (!state.text.trim()) errors.text = 'Text is required.'
  } else if (state.type === 'callout') {
    if (!state.text.trim()) errors.text = 'Text is required.'
    if (!state.color) errors.color = 'Choose a colour.'
    if (!state.icon) errors.icon = 'Choose an icon.'
  } else {
    const url = state.url.trim()
    if (!url) errors.url = 'Paste an image URL.'
    else if (!IMAGE_URL_RE.test(url)) errors.url = 'Must start with http:// or https://.'
  }
  return errors
}

/** Only ever produces one of the three valid shapes — mirrors `lesson_content_blocks_shape_check` exactly (schema.md), so a save can't hit the database's own constraint violation. */
function toBlockFormValues(state: BlockFormState): BlockFormValues {
  if (state.type === 'paragraph') return { type: 'paragraph', text: state.text.trim() }
  if (state.type === 'callout') {
    return { type: 'callout', text: state.text.trim(), color: state.color, icon: state.icon }
  }
  return { type: 'image', url: state.url.trim(), alt: state.alt.trim() }
}

interface BlockFormProps {
  initial: BlockFormState
  isSubmitting: boolean
  onSave: (values: BlockFormValues) => void
  onCancel: () => void
}

function BlockForm({ initial, isSubmitting, onSave, onCancel }: BlockFormProps) {
  const [state, setState] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSave() {
    const next = validate(state)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave(toBlockFormValues(state))
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-1.5">
        <Label>Block type</Label>
        {/* A labeled type picker, not a Select — only three options, and
            seeing all three at once (like the video-link mode switch in
            LessonDialog) beats opening a dropdown for such a short list. */}
        <div role="radiogroup" aria-label="Block type" className="flex gap-1.5">
          {BLOCK_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={state.type === value}
              // Switching type clears the other type's fields rather than
              // leaving them stale in state — matches the "only ever produces
              // a valid shape" rule this whole form is built around.
              onClick={() => setState((prev) => ({ ...emptyForm(), type: value, text: prev.text }))}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm font-medium transition-colors',
                state.type === value
                  ? 'border-foreground bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.type === 'paragraph' || state.type === 'callout' ? (
        <div className="space-y-1.5">
          <Label htmlFor="block-text">Text</Label>
          <Textarea
            id="block-text"
            rows={3}
            value={state.text}
            aria-invalid={!!errors.text}
            onChange={(e) => setState((prev) => ({ ...prev, text: e.target.value }))}
          />
          {errors.text ? <p className="text-coral-d text-sm">{errors.text}</p> : null}
        </div>
      ) : null}

      {state.type === 'callout' ? (
        <>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {CALLOUT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={state.color === color}
                  onClick={() => setState((prev) => ({ ...prev, color }))}
                  className={cn(
                    COLOR_BG_CLASS[color],
                    'grid size-8 place-items-center rounded-full ring-offset-2 transition-shadow',
                    state.color === color && 'ring-2 ring-foreground',
                  )}
                >
                  {state.color === color ? <Check className="text-cream size-4" /> : null}
                </button>
              ))}
            </div>
            {errors.color ? <p className="text-coral-d text-sm">{errors.color}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex gap-2">
              {CALLOUT_ICONS.map((icon) => {
                const Icon = ICONS[icon]
                return (
                  <button
                    key={icon}
                    type="button"
                    aria-label={icon}
                    aria-pressed={state.icon === icon}
                    onClick={() => setState((prev) => ({ ...prev, icon }))}
                    className={cn(
                      'grid size-8 place-items-center rounded-full border',
                      state.icon === icon ? 'border-foreground bg-muted' : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
            {errors.icon ? <p className="text-coral-d text-sm">{errors.icon}</p> : null}
          </div>
        </>
      ) : null}

      {state.type === 'image' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="block-url">Image URL</Label>
            <Input
              id="block-url"
              value={state.url}
              placeholder="https://…"
              aria-invalid={!!errors.url}
              onChange={(e) => setState((prev) => ({ ...prev, url: e.target.value }))}
            />
            {errors.url ? (
              <p className="text-coral-d text-sm">{errors.url}</p>
            ) : (
              <p className="text-muted-foreground text-xs">Paste-only — there is no upload flow.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-alt">Alt text (optional)</Label>
            <Input
              id="block-alt"
              value={state.alt}
              onChange={(e) => setState((prev) => ({ ...prev, alt: e.target.value }))}
            />
          </div>
        </>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={isSubmitting} onClick={handleSave}>
          {isSubmitting ? 'Saving…' : 'Save block'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** A compact, non-interactive stand-in for a row's content: truncated text for paragraph/callout, a thumbnail for image. */
function BlockPreview({ block }: { block: ContentBlock }) {
  if (block.block_type === 'image') {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {block.image_url ? (
          <img src={block.image_url} alt="" className="size-8 shrink-0 rounded object-cover" />
        ) : (
          <ImageIcon className="text-muted-foreground size-8 shrink-0" />
        )}
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {block.image_alt || block.image_url || 'No URL'}
        </span>
      </div>
    )
  }
  if (block.block_type === 'callout') {
    const Icon = block.callout_icon ? ICONS[block.callout_icon as CalloutIcon] : Info
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full text-cream',
            block.callout_color ? COLOR_BG_CLASS[block.callout_color as CalloutColor] : 'bg-muted',
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{block.text_content}</span>
      </div>
    )
  }
  return <span className="min-w-0 flex-1 truncate text-sm">{block.text_content}</span>
}

function BlockRowPreview({ block }: { block: ContentBlock }) {
  return (
    <div className="bg-background flex items-center gap-2 rounded-md border px-2.5 py-2 shadow-md">
      <span className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <BlockPreview block={block} />
    </div>
  )
}

export function DocBlocksEditor({ lessonId }: { lessonId: string }) {
  const { data: blocks, isPending } = useContentBlocks(lessonId)
  const mutations = useBlockMutations(lessonId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ContentBlock | null>(null)

  const rows = blocks ?? []

  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Content blocks</h3>
        <span className="text-muted-foreground text-xs">
          {rows.length} {rows.length === 1 ? 'block' : 'blocks'}
        </span>
      </div>

      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : rows.length === 0 && !isAdding ? (
        <p className="text-muted-foreground text-sm">No blocks yet — add the first one below.</p>
      ) : (
        <SimpleSortableList
          items={rows}
          onReorder={(changed) => mutations.reorder.mutate(changed)}
          renderOverlay={(block) => <BlockRowPreview block={block} />}
          renderRow={(block, { attributes, listeners }) =>
            editingId === block.id ? (
              <BlockForm
                initial={blockToFormState(block)}
                isSubmitting={mutations.update.isPending}
                onCancel={() => setEditingId(null)}
                onSave={(values) =>
                  mutations.update.mutate({ id: block.id, values }, { onSuccess: () => setEditingId(null) })
                }
              />
            ) : (
              <div className="flex items-center gap-2 rounded-md border px-2.5 py-2">
                <DragHandle attributes={attributes} listeners={listeners} label="Reorder block" />
                <BlockPreview block={block} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit block"
                  onClick={() => {
                    setIsAdding(false)
                    setEditingId(block.id)
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete block"
                  onClick={() => setDeleteTarget(block)}
                >
                  <Trash2 />
                </Button>
              </div>
            )
          }
        />
      )}

      {isAdding ? (
        <BlockForm
          initial={emptyForm()}
          isSubmitting={mutations.create.isPending}
          onCancel={() => setIsAdding(false)}
          onSave={(values) =>
            mutations.create.mutate({ values, position: rows.length }, { onSuccess: () => setIsAdding(false) })
          }
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingId(null)
            setIsAdding(true)
          }}
        >
          <Plus />
          Add block
        </Button>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription>This will be removed for good — there&rsquo;s no undo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutations.remove.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!deleteTarget) return
                mutations.remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }}
            >
              {mutations.remove.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
