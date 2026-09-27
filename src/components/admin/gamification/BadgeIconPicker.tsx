import { useId, useState, type ChangeEvent, type DragEvent } from 'react'
import { Check, Flame, MoreHorizontal, Sparkles, Star, Trophy, Upload } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  badgeIconToUrl,
  BADGE_COLORS,
  BADGE_GLYPHS,
  BADGE_ICON_UPLOAD_TYPES,
  readBadgeIconFile,
  type BadgeColor,
  type BadgeGlyph,
  type BadgeIconState,
} from '@/lib/badgeIcon'
import { cn } from '@/lib/utils'

// Tailwind's scanner needs each class name spelled out literally — a
// template literal like `bg-${color}` is invisible to it and would ship an
// unstyled swatch (the same fix the doc-blocks editor's colour picker needed).
const COLOR_BG_CLASS: Record<BadgeColor, string> = {
  gold: 'bg-gold',
  teal: 'bg-teal',
  coral: 'bg-coral',
  plum: 'bg-plum',
}

const COLOR_LABEL: Record<BadgeColor, string> = {
  gold: 'Gold',
  teal: 'Teal',
  coral: 'Coral',
  plum: 'Plum',
}

// Only used for the picker's own buttons, never for the saved artwork —
// the actual icon is always the generated SVG (badgeIcon.ts), drawn from
// the same six badges' real path data, not from these lucide glyphs.
const GLYPH_ICON: Record<BadgeGlyph, typeof Check> = {
  checkmark: Check,
  flame: Flame,
  spark: Sparkles,
  trophy: Trophy,
  star: Star,
  dots: MoreHorizontal,
}

const GLYPH_LABEL: Record<BadgeGlyph, string> = {
  checkmark: 'Checkmark',
  flame: 'Flame',
  spark: 'Spark',
  trophy: 'Trophy',
  star: 'Star',
  dots: 'Dots',
}

const MODES = [
  { value: 'builder', label: 'Use the picker' },
  { value: 'upload', label: 'Upload image' },
] as const

function BuilderFields({
  color,
  glyph,
  onChange,
}: {
  color: BadgeColor
  glyph: BadgeGlyph
  onChange: (color: BadgeColor, glyph: BadgeGlyph) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Colour</Label>
        <div className="flex gap-2">
          {BADGE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={COLOR_LABEL[c]}
              aria-pressed={color === c}
              onClick={() => onChange(c, glyph)}
              className={cn(
                COLOR_BG_CLASS[c],
                'size-8 rounded-full ring-offset-2 transition-shadow',
                color === c && 'ring-2 ring-foreground',
              )}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Glyph</Label>
        <div className="flex flex-wrap gap-2">
          {BADGE_GLYPHS.map((g) => {
            const Icon = GLYPH_ICON[g]
            return (
              <button
                key={g}
                type="button"
                aria-label={GLYPH_LABEL[g]}
                aria-pressed={glyph === g}
                onClick={() => onChange(color, g)}
                className={cn(
                  'grid size-8 place-items-center rounded-full border',
                  glyph === g ? 'border-foreground bg-muted' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function UploadField({ onFile, error }: { onFile: (file: File) => void; error: string | null }) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear the input so picking the same file again (after fixing it) still fires.
    e.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors',
          'focus-within:ring-ring/50 focus-within:ring-3',
          dragging ? 'border-primary bg-accent' : 'border-border hover:bg-muted/50',
        )}
      >
        <Upload className="text-muted-foreground size-5" />
        <span className="font-medium">
          Drop an image here, or <span className="underline">browse</span>
        </span>
        <span className="text-muted-foreground text-xs">PNG, JPEG, WebP, GIF or SVG · up to 100 KB</span>
        <input
          id={inputId}
          type="file"
          accept={BADGE_ICON_UPLOAD_TYPES.join(',')}
          className="sr-only"
          onChange={handleChange}
        />
      </label>
      {error ? (
        <p role="alert" className="text-coral-d text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function BadgeIconPicker({
  icon,
  onChange,
}: {
  icon: BadgeIconState
  onChange: (icon: BadgeIconState) => void
}) {
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFile(file: File) {
    const result = await readBadgeIconFile(file)
    if ('error' in result) {
      setUploadError(result.error)
      return
    }
    setUploadError(null)
    onChange({ mode: 'upload', dataUri: result.dataUri })
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-4">
        {/* The live preview is the exact data URI a save would write — never
            a CSS/React re-implementation of the same shapes — so it cannot
            drift from what actually gets saved. */}
        <img src={badgeIconToUrl(icon)} alt="" className="size-16 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1 space-y-3">
          <div role="radiogroup" aria-label="Icon source" className="inline-flex rounded-md border p-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={icon.mode === m.value}
                onClick={() => {
                  if (m.value === icon.mode) return
                  setUploadError(null)
                  onChange(
                    m.value === 'builder'
                      ? { mode: 'builder', color: 'gold', glyph: 'star' }
                      : { mode: 'upload', dataUri: badgeIconToUrl(icon) },
                  )
                }}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                  icon.mode === m.value
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {icon.mode === 'builder' ? (
            <BuilderFields
              color={icon.color}
              glyph={icon.glyph}
              onChange={(color, glyph) => onChange({ mode: 'builder', color, glyph })}
            />
          ) : (
            <UploadField onFile={(file) => void handleFile(file)} error={uploadError} />
          )}
        </div>
      </div>
    </div>
  )
}
