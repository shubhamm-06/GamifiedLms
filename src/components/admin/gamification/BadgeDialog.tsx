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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { BadgeIconPicker } from './BadgeIconPicker'
import {
  CONDITION_TYPES,
  CONDITION_TYPE_KEYS,
  isConditionType,
  type Badge,
  type BadgeConditionType,
  type BadgeFormValues,
} from '@/hooks/admin/useBadges'
import { badgeIconToUrl, initialBadgeIconState } from '@/lib/badgeIcon'
import { slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { getTerms as tw } from '@/lib/settings/terms'

const EMPTY_BADGE: BadgeFormValues = {
  name: '',
  slug: '',
  description: '',
  icon_url: '',
  condition_type: 'total_xp',
  condition_value: '',
  is_active: true,
}

function badgeToFormValues(badge: Badge): BadgeFormValues {
  return {
    name: badge.name,
    slug: badge.slug,
    description: badge.description ?? '',
    icon_url: badge.icon_url ?? '',
    // The DB check constraint guarantees one of the four; the guard just
    // keeps the type honest instead of casting a bare string.
    condition_type: isConditionType(badge.condition_type) ? badge.condition_type : 'total_xp',
    condition_value: String(badge.condition_value),
    is_active: badge.is_active,
  }
}

interface BadgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The badge being edited, or null when creating a new one. */
  badge: Badge | null
  isSubmitting: boolean
  /** Set only after a failed submit — a slug collision surfaces inline, not as a toast. */
  slugError: string | null
  onSubmit: (values: BadgeFormValues) => void
}

/** Mounts fresh per open, so switching badges never carries over stale state. */
function BadgeForm({
  badge,
  isSubmitting,
  slugError,
  onSubmit,
  onCancel,
}: {
  badge: Badge | null
  isSubmitting: boolean
  slugError: string | null
  onSubmit: (values: BadgeFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<BadgeFormValues>(
    badge ? badgeToFormValues(badge) : EMPTY_BADGE,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Editing an existing badge must never silently rewrite its slug because
  // someone tweaked the name, so edit starts "touched" — same rule as
  // GameForm/CourseForm.
  const [slugTouched, setSlugTouched] = useState(!!badge)
  // A builder-made icon preselects its real colour+glyph; any other existing
  // icon (the six hand-seeded rows, or a previous upload) opens in upload
  // mode showing that same image, so editing an unrelated field never
  // silently swaps out an icon nobody asked to change. A new badge starts
  // with a real icon already selected (gold + star), not blank.
  const [icon, setIcon] = useState(() => initialBadgeIconState(badge?.icon_url ?? null))

  function set<K extends keyof BadgeFormValues>(field: K, value: BadgeFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleNameChange(name: string) {
    setValues((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : slugify(name),
    }))
  }

  const isCourseComplete = values.condition_type === 'course_complete'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    const name = values.name.trim()
    const slug = values.slug.trim() || slugify(name)

    if (!name) next.name = 'Name is required.'
    if (!slug) next.slug = 'Slug is required.'

    // course_complete has no visible number field — it's fixed at 1 and
    // never reaches validation, so a hidden field can't fail a check meant
    // for the other three types.
    const conditionValue = Number(values.condition_value)
    if (
      !isCourseComplete &&
      (!values.condition_value.trim() || !Number.isInteger(conditionValue) || conditionValue < 1)
    ) {
      next.condition_value = 'Enter a whole number, 1 or more.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      ...values,
      name,
      slug,
      condition_value: isCourseComplete ? '1' : values.condition_value,
      icon_url: badgeIconToUrl(icon),
    })
  }

  const condition = CONDITION_TYPES[values.condition_type]

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="badge-name">Name</Label>
        <Input
          id="badge-name"
          value={values.name}
          aria-invalid={!!errors.name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
        {errors.name ? <p className="text-coral-d text-sm">{errors.name}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="badge-slug">Slug</Label>
        <Input
          id="badge-slug"
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
          <p className="text-muted-foreground text-xs">Fills in from the name until you edit it.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="badge-description">Description</Label>
        <Textarea
          id="badge-description"
          rows={3}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Icon</Label>
        <BadgeIconPicker icon={icon} onChange={setIcon} />
      </div>

      <div className={cn('grid gap-4', !isCourseComplete && 'sm:grid-cols-2')}>
        <div className="space-y-1.5">
          <Label htmlFor="badge-condition-type">Condition</Label>
          <Select
            value={values.condition_type}
            onValueChange={(v) => set('condition_type', v as BadgeConditionType)}
          >
            <SelectTrigger id="badge-condition-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_TYPE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {CONDITION_TYPES[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* course_complete has no meaningful number to set — fn_evaluate_badges
            only ever checks "at least one course finished", so the field is
            fixed at 1 behind the scenes (handleSubmit) rather than shown as a
            number input with nothing useful to type into it. */}
        {isCourseComplete ? null : (
          <div className="space-y-1.5">
            {/* Label and hint follow the selected type — the same number means
                XP, days or lessons depending on it. */}
            <Label htmlFor="badge-condition-value">{condition.valueLabel}</Label>
            <Input
              id="badge-condition-value"
              type="number"
              min={1}
              value={values.condition_value}
              aria-invalid={!!errors.condition_value}
              onChange={(e) => set('condition_value', e.target.value)}
            />
          </div>
        )}
      </div>
      {errors.condition_value ? (
        <p className="text-coral-d -mt-2 text-sm">{errors.condition_value}</p>
      ) : (
        <p className="text-muted-foreground -mt-2 text-xs">{condition.hint}</p>
      )}

      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div>
          <Label htmlFor="badge-active">Active</Label>
          <p className="text-muted-foreground text-xs">
            {`Inactive ${tw().lower('badge', true)} are never awarded, but anyone who already earned one keeps it.`}
          </p>
        </div>
        <Switch
          id="badge-active"
          checked={values.is_active}
          onCheckedChange={(checked) => set('is_active', checked)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : badge ? `Save ${tw().lower('badge')}` : `Add ${tw().lower('badge')}`}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function BadgeDialog({
  open,
  onOpenChange,
  badge,
  isSubmitting,
  slugError,
  onSubmit,
}: BadgeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{badge ? `Edit ${tw().lower('badge')}` : `New ${tw().lower('badge')}`}</DialogTitle>
          <DialogDescription>
            {badge ? badge.name : 'A flat record — awarded automatically once its condition is met.'}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so switching between badges remounts with fresh state instead
            of carrying the previous badge's values over. */}
        <BadgeForm
          key={badge?.id ?? 'new'}
          badge={badge}
          isSubmitting={isSubmitting}
          slugError={slugError}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
