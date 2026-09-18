import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppSettings, useUpdateAppSettings, type AppSettings } from '@/hooks/useAppSettings'

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

interface IdentityFormValues {
  site_name: string
  site_url: string
  support_email: string
  terms_url: string
  privacy_url: string
}

function toFormValues(settings: AppSettings): IdentityFormValues {
  return {
    site_name: settings.site_name,
    site_url: settings.site_url ?? '',
    support_email: settings.support_email ?? '',
    terms_url: settings.terms_url ?? '',
    privacy_url: settings.privacy_url ?? '',
  }
}

/**
 * Mounted with `key={settings.id}` by the parent — same "mount fresh from
 * a query-loaded singleton row" trick as `GamificationSettingsSection`.
 */
function SiteIdentityForm({ settings }: { settings: AppSettings }) {
  const updateSettings = useUpdateAppSettings()
  const [values, setValues] = useState<IdentityFormValues>(toFormValues(settings))
  const [siteNameError, setSiteNameError] = useState<string | null>(null)

  function set<K extends keyof IdentityFormValues>(field: K, value: IdentityFormValues[K]) {
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

    updateSettings.mutate({
      id: settings.id,
      site_name: siteName,
      site_url: values.site_url.trim() || null,
      support_email: values.support_email.trim() || null,
      terms_url: values.terms_url.trim() || null,
      privacy_url: values.privacy_url.trim() || null,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <Field
        id="site-name"
        label="Site name"
        error={siteNameError ?? undefined}
        hint={siteNameError ? undefined : 'Shown in the admin sidebar.'}
      >
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

      <div className="flex justify-end">
        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

/** Split out on its own tab — everything about how the platform presents itself, separate from Commerce/Gamification config. */
export function SiteIdentitySettingsSection() {
  const { data: settings, isPending, isError } = useAppSettings()

  if (isPending) {
    return (
      <div className="space-y-4 rounded-lg border p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (isError || !settings) {
    return <p className="text-coral-d text-sm">Couldn&rsquo;t load platform settings.</p>
  }

  return (
    <section className="rounded-lg border p-4">
      <SiteIdentityForm key={settings.id} settings={settings} />
    </section>
  )
}
