import { Check, Flame, MoreHorizontal, Sparkles, Star, Trophy } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  BADGE_COLORS,
  BADGE_GLYPHS,
  buildBadgeIconDataUri,
  type BadgeColor,
  type BadgeGlyph,
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

export function BadgeIconPicker({
  color,
  glyph,
  onChange,
}: {
  color: BadgeColor
  glyph: BadgeGlyph
  onChange: (color: BadgeColor, glyph: BadgeGlyph) => void
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center gap-4">
        {/* The live preview is the exact data URI a save would write — never
            a CSS/React re-implementation of the same shapes — so it cannot
            drift from what actually gets saved. */}
        <img
          src={buildBadgeIconDataUri(color, glyph)}
          alt=""
          className="size-16 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1 space-y-3">
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
      </div>
    </div>
  )
}
