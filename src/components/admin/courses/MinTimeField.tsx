import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MIN_TIME_CHIPS, MIN_TIME_MAX_SECONDS } from '@/lib/lessonSettings'
import { cn } from '@/lib/utils'
import { getTerms as tw } from '@/lib/settings/terms'

interface MinTimeFieldProps {
  id: string
  /** Whole seconds as typed. Kept a string so a half-typed value never snaps back. */
  value: string
  onChange: (value: string) => void
  error?: string
}

/**
 * "Minimum time on lesson": quick-pick chips (Off, 30s, 1 min, 90s, 2 min,
 * 5 min) plus a numeric input for anything else. A chip is just a shortcut for
 * typing its number, so the input is always the truth. Two plain buttons rather
 * than a new shadcn toggle-group — see the note in `LessonDialog.tsx`.
 *
 * The setting is stored only; nothing enforces it yet (`docs/rules.md`).
 */
export function MinTimeField({ id, value, onChange, error }: MinTimeFieldProps) {
  const current = value.trim()

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{`Minimum time on ${tw().lower('lesson')}`}</Label>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Minimum time quick picks">
        {MIN_TIME_CHIPS.map((chip) => {
          const active = current === String(chip.seconds)
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(String(chip.seconds))}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MIN_TIME_MAX_SECONDS}
          step={1}
          className="w-28"
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-muted-foreground text-sm">seconds</span>
      </div>
      {error ? (
        <p className="text-coral-d text-sm">{error}</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          {`Kids can tap Mark complete after spending this long on the ${tw().lower('lesson')}. Off means no minimum.`}
        </p>
      )}
    </div>
  )
}
