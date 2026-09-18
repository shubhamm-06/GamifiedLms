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
import { Skeleton } from '@/components/ui/skeleton'
import { useAppSettings, useUpdateAppSettings, type AppSettings } from '@/hooks/useAppSettings'

/** Same small local Section/Field helpers as `CourseForm.tsx` — not shared, since each is a ~10-line presentational wrapper with no logic to drift. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Field({
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

interface PlatformFormValues {
  default_currency: string
  quiz_pass_threshold_percent: string
  site_name: string
  site_url: string
  support_email: string
  terms_url: string
  privacy_url: string
}

function toFormValues(settings: AppSettings): PlatformFormValues {
  return {
    default_currency: settings.default_currency,
    quiz_pass_threshold_percent: String(settings.quiz_pass_threshold_percent),
    site_name: settings.site_name,
    site_url: settings.site_url ?? '',
    support_email: settings.support_email ?? '',
    terms_url: settings.terms_url ?? '',
    privacy_url: settings.privacy_url ?? '',
  }
}

/**
 * Mounted with `key={settings.id}` by the parent — since this is a page
 * section rather than a dialog, there's no open/close moment to reset on,
 * so a stable key (the singleton row's id, which never changes across a
 * refetch) does the same job the "mounts fresh per open" dialog pattern
 * does elsewhere: local state is seeded once from the loaded row and never
 * silently clobbered by a background refetch while the admin is mid-edit.
 */
function PlatformSettingsForm({ settings }: { settings: AppSettings }) {
  const updateSettings = useUpdateAppSettings()
  const [values, setValues] = useState<PlatformFormValues>(toFormValues(settings))
  const [siteNameError, setSiteNameError] = useState<string | null>(null)

  function set<K extends keyof PlatformFormValues>(field: K, value: PlatformFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const siteName = values.site_name.trim()
    if (!siteName) {
      setSiteNameError('Site name is required.')
      return
    }
    setSiteNameError(null)

    const threshold = Number(values.quiz_pass_threshold_percent)

    updateSettings.mutate({
      id: settings.id,
      default_currency: values.default_currency,
      quiz_pass_threshold_percent: Number.isFinite(threshold) ? threshold : settings.quiz_pass_threshold_percent,
      site_name: siteName,
      site_url: values.site_url.trim() || null,
      support_email: values.support_email.trim() || null,
      terms_url: values.terms_url.trim() || null,
      privacy_url: values.privacy_url.trim() || null,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <Section title="Commerce">
        <Field id="default-currency" label="Default currency" hint="Pre-fills new courses' currency in the Course Builder.">
          <Select value={values.default_currency} onValueChange={(v) => set('default_currency', v)}>
            <SelectTrigger id="default-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Gamification">
        <Field
          id="quiz-pass-threshold"
          label="Quiz pass threshold (%)"
          hint="Not used anywhere yet — quiz grading doesn't exist. Stored here so it's ready when it does."
        >
          <Input
            id="quiz-pass-threshold"
            type="number"
            min={0}
            max={100}
            value={values.quiz_pass_threshold_percent}
            onChange={(e) => set('quiz_pass_threshold_percent', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Site Identity">
        <Field id="site-name" label="Site name" error={siteNameError ?? undefined} hint={siteNameError ? undefined : 'Shown in the admin sidebar.'}>
          <Input
            id="site-name"
            value={values.site_name}
            aria-invalid={!!siteNameError}
            onChange={(e) => {
              set('site_name', e.target.value)
              setSiteNameError(null)
            }}
          />
        </Field>
        <Field id="site-url" label="Site URL" hint="Public base URL, for outbound links once this is deployed.">
          <Input
            id="site-url"
            type="url"
            placeholder="https://example.com"
            value={values.site_url}
            onChange={(e) => set('site_url', e.target.value)}
          />
        </Field>
        <Field id="support-email" label="Support email">
          <Input
            id="support-email"
            type="email"
            placeholder="support@example.com"
            value={values.support_email}
            onChange={(e) => set('support_email', e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="terms-url" label="Terms URL">
            <Input
              id="terms-url"
              type="url"
              value={values.terms_url}
              onChange={(e) => set('terms_url', e.target.value)}
            />
          </Field>
          <Field id="privacy-url" label="Privacy URL">
            <Input
              id="privacy-url"
              type="url"
              value={values.privacy_url}
              onChange={(e) => set('privacy_url', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

/**
 * One form saving the whole row on submit — this is config, not a list of
 * independent records, so there's no per-field save affordance. Grouped
 * visually into Commerce / Gamification / Site Identity rather than one
 * flat list of seven fields.
 */
export function PlatformSettingsSection() {
  const { data: settings, isPending, isError } = useAppSettings()

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError || !settings) {
    return <p className="text-coral-d text-sm">Couldn&rsquo;t load platform settings.</p>
  }

  return <PlatformSettingsForm key={settings.id} settings={settings} />
}
