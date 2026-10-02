import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
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
import { isHttpsUrl } from '@/lib/externalLink'
import { courseSlugFromTitle, isValidCourseSlug } from '@/lib/slug'
import type { CourseFormValues } from '@/hooks/admin/useCourses'

/** Defaults for create mode. Not exported — the form owns its blank state. */
const EMPTY_COURSE_FORM: CourseFormValues = {
  title: '',
  slug: '',
  subtitle: '',
  description: '',
  thumbnail_url: '',
  is_free: false,
  price_amount: '',
  currency: 'INR',
  access_type: 'lifetime',
  access_duration_days: '',
  enrollment_status: 'open',
  default_lesson_xp: '10',
  gamification_enabled: true,
  enroll_url: '',
}

export const SLUG_FORMAT_MESSAGE =
  'Use lowercase letters, numbers and single hyphens, up to 80 characters. It cannot look like an ID.'

type FieldErrors = Partial<Record<keyof CourseFormValues, string>>

interface CourseFormProps {
  mode: 'create' | 'edit'
  initialValues?: CourseFormValues
  onSubmit: (values: CourseFormValues) => void
  isSubmitting: boolean
  /** Server-side errors keyed to a field — e.g. a slug uniqueness violation. */
  externalErrors?: FieldErrors
  onCancel: () => void
  /** Overrides the default submit wording (create mode uses "Save & continue"). */
  submitLabel?: string
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-coral-d text-sm">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

export function CourseForm({
  mode,
  initialValues,
  onSubmit,
  isSubmitting,
  externalErrors,
  onCancel,
  submitLabel,
}: CourseFormProps) {
  const [values, setValues] = useState<CourseFormValues>(initialValues ?? EMPTY_COURSE_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  // Editing an existing course must never silently rewrite its slug (and so
  // its URL) because someone tweaked the title, so edit starts "touched".
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')

  function set<K extends keyof CourseFormValues>(field: K, value: CourseFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleTitleChange(title: string) {
    setValues((prev) => ({
      ...prev,
      title,
      // Mirrors into slug until the slug field is edited by hand.
      slug: slugTouched ? prev.slug : courseSlugFromTitle(title),
    }))
  }

  function validate(): CourseFormValues | null {
    const next: FieldErrors = {}
    const title = values.title.trim()
    // An empty slug falls back to the title rather than blocking submit.
    const slug = values.slug.trim() || courseSlugFromTitle(title)

    if (!title) next.title = 'Title is required.'
    if (!slug) next.slug = 'Slug is required.'
    else if (!isValidCourseSlug(slug)) next.slug = SLUG_FORMAT_MESSAGE

    if (!values.is_free) {
      const price = Number(values.price_amount)
      if (!values.price_amount.trim() || Number.isNaN(price) || price <= 0) {
        next.price_amount = 'Enter a price greater than 0, or mark the course free.'
      }
    }

    if (values.access_type === 'fixed') {
      const days = Number(values.access_duration_days)
      if (!values.access_duration_days.trim() || Number.isNaN(days) || days <= 0) {
        next.access_duration_days = 'Enter a duration in days greater than 0.'
      }
    }

    const xp = Number(values.default_lesson_xp)
    if (!values.default_lesson_xp.trim() || Number.isNaN(xp) || xp < 0) {
      next.default_lesson_xp = 'Enter 0 or more.'
    }

    const enrollUrl = values.enroll_url.trim()
    if (enrollUrl && !isHttpsUrl(enrollUrl)) {
      next.enroll_url = 'Must be a valid https:// link, no spaces, 2048 characters or fewer.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return null
    return { ...values, title, slug }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const normalised = validate()
    if (normalised) onSubmit(normalised)
  }

  const slugError = errors.slug ?? externalErrors?.slug
  const enrollUrlError = errors.enroll_url ?? externalErrors?.enroll_url

  return (
    <form className="max-w-2xl space-y-5" onSubmit={handleSubmit} noValidate>
      <Section title="Basics">
        <Field id="title" label="Title" error={errors.title}>
          <Input
            id="title"
            value={values.title}
            aria-invalid={!!errors.title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
        </Field>

        <Field
          id="slug"
          label="Slug"
          hint={
            mode === 'edit'
              ? 'The course link ends with this. Changing it breaks links people already have (the course id link keeps working).'
              : 'The course link ends with this. Fills in from the title until you edit it.'
          }
          error={slugError}
        >
          <Input
            id="slug"
            value={values.slug}
            aria-invalid={!!slugError}
            onChange={(e) => {
              setSlugTouched(true)
              set('slug', e.target.value)
            }}
          />
        </Field>

        <Field id="subtitle" label="Subtitle">
          <Input
            id="subtitle"
            value={values.subtitle}
            onChange={(e) => set('subtitle', e.target.value)}
          />
        </Field>

        <Field id="description" label="Description">
          <Textarea
            id="description"
            rows={4}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>

        <Field
          id="thumbnail_url"
          label="Thumbnail URL"
          hint="Paste a hosted image link. Upload isn't wired yet (no Storage bucket exists)."
        >
          <Input
            id="thumbnail_url"
            value={values.thumbnail_url}
            onChange={(e) => set('thumbnail_url', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Pricing & access">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="is_free">Free course</Label>
            <p className="text-muted-foreground text-xs">No payment required to enroll.</p>
          </div>
          <Switch
            id="is_free"
            checked={values.is_free}
            onCheckedChange={(checked) => set('is_free', checked)}
          />
        </div>

        {/* Price and currency are meaningless for a free course, so they're
            removed outright rather than left disabled and ambiguous. */}
        {!values.is_free ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="price_amount" label="Price" error={errors.price_amount}>
              <Input
                id="price_amount"
                type="number"
                min={1}
                value={values.price_amount}
                aria-invalid={!!errors.price_amount}
                onChange={(e) => set('price_amount', e.target.value)}
              />
            </Field>
            <Field id="currency" label="Currency">
              <Select value={values.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="access_type" label="Access type">
            <Select
              value={values.access_type}
              onValueChange={(v) =>
                setValues((prev) => ({
                  ...prev,
                  access_type: v,
                  // Clear the duration when leaving 'fixed' so a stale value
                  // can't be submitted.
                  access_duration_days: v === 'fixed' ? prev.access_duration_days : '',
                }))
              }
            >
              <SelectTrigger id="access_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lifetime">Lifetime</SelectItem>
                <SelectItem value="fixed">Fixed duration</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {values.access_type === 'fixed' ? (
            <Field
              id="access_duration_days"
              label="Access duration (days)"
              error={errors.access_duration_days}
            >
              <Input
                id="access_duration_days"
                type="number"
                min={1}
                value={values.access_duration_days}
                aria-invalid={!!errors.access_duration_days}
                onChange={(e) => set('access_duration_days', e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <Field id="enrollment_status" label="Enrollment">
          <Select
            value={values.enrollment_status}
            onValueChange={(v) => set('enrollment_status', v)}
          >
            <SelectTrigger id="enrollment_status" className="w-full sm:w-1/2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="enroll_url"
          label="Enrollment link"
          hint="Where the Enroll now button sends students, for example a payment page, form or WhatsApp link. Must start with https://. Leave empty to hide the button."
          error={enrollUrlError}
        >
          <Input
            id="enroll_url"
            type="url"
            placeholder="https://"
            value={values.enroll_url}
            aria-invalid={!!enrollUrlError}
            onChange={(e) => set('enroll_url', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Gamification">
        <Field
          id="default_lesson_xp"
          label="Default lesson XP"
          hint="Used when a lesson doesn't set its own XP reward."
          error={errors.default_lesson_xp}
        >
          <Input
            id="default_lesson_xp"
            type="number"
            min={0}
            className="sm:w-1/2"
            value={values.default_lesson_xp}
            aria-invalid={!!errors.default_lesson_xp}
            onChange={(e) => set('default_lesson_xp', e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="gamification_enabled">Gamification enabled</Label>
            <p className="text-muted-foreground text-xs">
              Turning this off disables XP, levels, streaks, badges and lesson counts for this course.
              It is not retroactive: XP, badges and counts already earned are kept, and only
              completions from now on follow the setting.
            </p>
          </div>
          <Switch
            id="gamification_enabled"
            checked={values.gamification_enabled}
            onCheckedChange={(checked) => set('gamification_enabled', checked)}
          />
        </div>
      </Section>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving…'
            : (submitLabel ?? (mode === 'create' ? 'Create course' : 'Save changes'))}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
