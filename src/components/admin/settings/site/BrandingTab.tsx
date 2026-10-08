import { AuthCard } from '@/components/auth/AuthCard'
import { AuthField } from '@/components/auth/AuthField'
import { Input } from '@/components/ui/input'
import type { SiteConfigRow } from '@/hooks/admin/useSiteConfig'
import type { Settings } from '@/lib/settings/schema'
import { ImageUpload } from './ImageUpload'
import { SectionShell, SettingField } from './SectionShell'
import { useSectionDraft } from './useSectionDraft'

type Branding = Settings['branding']
type TextKey = 'productName' | 'tagline' | 'supportEmail' | 'helpUrl' | 'footerText' | 'loginHeading' | 'loginSubline' | 'registerHeading' | 'registerSubline'

const TEXT_FIELDS: { key: TextKey; label: string; max: number; hint?: string; type?: string; placeholder?: string }[] = [
  { key: 'productName', label: 'Product name', max: 30, hint: 'Shown on the sign-in screens, in the navigation and in the browser tab. 2 to 30 characters.' },
  { key: 'tagline', label: 'Tagline', max: 80, hint: 'Optional. Under the logo on the sign-in screens, and the page description.' },
  { key: 'supportEmail', label: 'Support email', max: 254, type: 'email', placeholder: 'support@company.com', hint: 'Optional. Shown under the sign-in card and in each learner’s profile.' },
  { key: 'helpUrl', label: 'Help link', max: 2048, type: 'url', placeholder: 'https://help.company.com', hint: 'Optional. An https link, opened in a new tab.' },
  { key: 'footerText', label: 'Footer text', max: 120, hint: 'Optional. Small text under the sign-in card.' },
]

const AUTH_TEXT: { key: TextKey; label: string; builtIn: string }[] = [
  { key: 'loginHeading', label: 'Log in heading', builtIn: 'Log in to your account' },
  { key: 'loginSubline', label: 'Log in subline', builtIn: 'Enter your details to continue' },
  { key: 'registerHeading', label: 'Sign up heading', builtIn: 'Create your account' },
  { key: 'registerSubline', label: 'Sign up subline', builtIn: 'Get started in a minute' },
]

export function BrandingTab({ row }: { row: SiteConfigRow<'branding'> }) {
  const d = useSectionDraft(row)
  const b = d.draft
  const set = (patch: Partial<Branding>) => d.setDraft({ ...b, ...patch })
  const setBg = (patch: Partial<Branding['login']['background']>) =>
    set({ login: { background: { ...b.login.background, ...patch } } })

  return (
    <SectionShell title="Branding" description="Your product name, logo and sign-in screens." draft={d}>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          {TEXT_FIELDS.map((f) => (
            <SettingField key={f.key} id={`b-${f.key}`} label={f.label} hint={f.hint} error={d.errors[f.key]}>
              <Input
                id={`b-${f.key}`}
                type={f.type ?? 'text'}
                value={b[f.key]}
                maxLength={f.max + 20}
                placeholder={f.placeholder}
                aria-invalid={!!d.errors[f.key]}
                onChange={(e) => set({ [f.key]: e.target.value } as Partial<Branding>)}
              />
            </SettingField>
          ))}

          <ImageUpload id="b-logo" kind="logo" label="Logo" value={b.logoUrl} error={d.errors.logoUrl} onChange={(logoUrl) => set({ logoUrl })} onUploaded={d.track} />
          <ImageUpload
            id="b-favicon"
            kind="favicon"
            label="Favicon"
            value={b.faviconUrl}
            error={d.errors.faviconUrl}
            onChange={(faviconUrl) => set({ faviconUrl })}
            onUploaded={d.track}
          />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Sign-in background</legend>
            <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Sign-in background">
              {(['none', 'color', 'image'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="b-bg" value={t} checked={b.login.background.type === t} onChange={() => setBg({ type: t })} />
                  {t === 'none' ? 'White' : t === 'color' ? 'Solid colour' : 'Image'}
                </label>
              ))}
            </div>
            {b.login.background.type === 'color' ? (
              <SettingField id="b-bg-color" label="Background colour" error={d.errors['login.background.color']}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick the background colour"
                    value={/^#[0-9A-Fa-f]{6}$/.test(b.login.background.color) ? b.login.background.color : '#FFFFFF'}
                    onChange={(e) => setBg({ color: e.target.value.toUpperCase() })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <Input id="b-bg-color" className="w-32 font-mono" value={b.login.background.color} onChange={(e) => setBg({ color: e.target.value })} />
                </div>
              </SettingField>
            ) : null}
            {b.login.background.type === 'image' ? (
              <ImageUpload
                id="b-bg-image"
                kind="background"
                label="Background image"
                value={b.login.background.imageUrl}
                error={d.errors['login.background.imageUrl']}
                onChange={(imageUrl) => setBg({ imageUrl })}
                onUploaded={d.track}
              />
            ) : null}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Sign-in text</legend>
            <p className="text-muted-foreground text-xs">Leave a field empty to use the built-in text. Up to 60 characters.</p>
            {AUTH_TEXT.map((f) => (
              <SettingField key={f.key} id={`b-${f.key}`} label={f.label} error={d.errors[f.key]}>
                <Input
                  id={`b-${f.key}`}
                  value={b[f.key]}
                  placeholder={f.builtIn}
                  aria-invalid={!!d.errors[f.key]}
                  onChange={(e) => set({ [f.key]: e.target.value } as Partial<Branding>)}
                />
              </SettingField>
            ))}
          </fieldset>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <div className="overflow-hidden rounded-lg border" data-testid="branding-preview" aria-hidden="true" inert>
            <AuthCard
              preview
              branding={b}
              heading={b.loginHeading || 'Log in to your account'}
              subheading={b.loginSubline || 'Enter your details to continue'}
              onSubmit={() => undefined}
              submitLabel="Log in"
            >
              <AuthField id="pv-email" label="Email" placeholder="you@company.com" readOnly tabIndex={-1} />
            </AuthCard>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
