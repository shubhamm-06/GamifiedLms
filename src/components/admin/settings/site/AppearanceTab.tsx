import type { CSSProperties, ReactNode } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { SiteConfigRow } from '@/hooks/admin/useSiteConfig'
import { useTerms } from '@/hooks/useSettings'
import { HEX, THEME_PRESETS, THEME_RULES, checkTheme, deriveTokens } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { SectionShell, SettingField } from './SectionShell'
import { useSectionDraft } from './useSectionDraft'
import { FontsSection } from './FontsSection'

function ColorInput({ id, label, hint, value, error, onChange }: { id: string; label: string; hint: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <SettingField id={id} label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Pick the ${label.toLowerCase()}`}
          value={HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded border"
        />
        <Input id={id} className="w-32 font-mono uppercase" value={value} maxLength={7} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
      </div>
    </SettingField>
  )
}

/**
 * The primary (`--gold`) and secondary (`--teal`) roles. Presets, hex inputs with a
 * native picker, live contrast results, and a preview in a scoped container (its own
 * CSS variables, so nothing outside it changes until Save).
 */
/** Colors and Fonts, one form, one Save/Discard/Reset (compare-and-swap on the whole `theme` row). */
export function AppearanceTab({ row }: { row: SiteConfigRow<'theme'> }) {
  const d = useSectionDraft(row)
  const t = d.draft
  const { term } = useTerms()
  const check = checkTheme(t.primary, t.secondary)
  const valid = HEX.test(t.primary) && HEX.test(t.secondary)
  const p = valid ? deriveTokens(t.primary) : null
  const s = valid ? deriveTokens(t.secondary) : null
  const scoped = (p && s
    ? { '--gold': p.base, '--gold-d': p.dark, '--gold-fg': p.fg, '--teal': s.base, '--teal-d': s.dark, '--teal-fg': s.fg }
    : {}) as CSSProperties

  return (
    <SectionShell title="Appearance" description="Colours and fonts, used across the learner app, sign-in screens and admin." draft={d}>
      <div>
        <h3 className="text-sm font-semibold">Colors</h3>
        <p className="text-muted-foreground text-sm">Your primary and secondary colours, used across the learner app, sign-in screens and admin.</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Presets</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Colour presets">
          {THEME_PRESETS.map((preset) => {
            const active = preset.primary === t.primary.toUpperCase() && preset.secondary === t.secondary.toUpperCase()
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => d.setDraft({ ...t, preset: preset.id, primary: preset.primary, secondary: preset.secondary })}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  active ? 'border-foreground font-medium' : 'hover:bg-muted',
                )}
                data-testid={`preset-${preset.id}`}
              >
                <span className="flex" aria-hidden>
                  <span className="size-4 rounded-full border" style={{ background: preset.primary }} />
                  <span className="-ml-1 size-4 rounded-full border" style={{ background: preset.secondary }} />
                </span>
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <ColorInput
            id="c-primary"
            label="Primary colour"
            hint="The main action: buttons, the next step, highlights."
            value={t.primary}
            error={valid ? undefined : d.errors.primary}
            onChange={(primary) => d.setDraft({ ...t, preset: 'custom', primary })}
          />
          <ColorInput
            id="c-secondary"
            label="Secondary colour"
            hint="Links, progress, completed states."
            value={t.secondary}
            error={valid ? undefined : d.errors.secondary}
            onChange={(secondary) => d.setDraft({ ...t, preset: 'custom', secondary })}
          />

          <div className="space-y-2 rounded-md border p-3 text-sm" aria-live="polite" data-testid="contrast-results">
            <p className="font-medium">Readability</p>
            {valid ? (
              <>
                <Result ok={check.primaryForeground >= THEME_RULES.primaryForeground}>
                  Text on the primary colour: {check.primaryForeground.toFixed(2)}:1 (needs {THEME_RULES.primaryForeground}:1)
                </Result>
                <Result ok={check.secondaryOnWhite >= THEME_RULES.secondaryOnWhite} warn={check.secondaryOnWhite < THEME_RULES.secondaryTextWarning}>
                  Secondary colour on white: {check.secondaryOnWhite.toFixed(2)}:1 (needs {THEME_RULES.secondaryOnWhite}:1, 4.5:1 for text links)
                </Result>
              </>
            ) : null}
            {[...check.errors, ...check.warnings].map((m) => (
              <p key={m} className={check.errors.includes(m) ? 'text-coral-d' : 'text-muted-foreground'}>
                {m}
              </p>
            ))}
            <p className="text-muted-foreground text-xs">
              Rules: text on the primary colour needs 4.5:1; the secondary colour needs 3:1 on white (a warning below 4.5:1, its text-link
              threshold). A pair that breaks a rule cannot be saved.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <div className="space-y-4 rounded-lg border bg-cream p-5 text-ink" style={scoped} data-testid="colors-preview">
            <div className="rounded-2xl bg-surface p-4 shadow-sm">
              <p className="font-semibold">A card</p>
              <p className="text-ink/70 text-sm">
                With a <span className="text-teal-d font-medium underline underline-offset-2">secondary link</span> in the text.
              </p>
              <div className="bg-ink/10 mt-3 h-2 overflow-hidden rounded-full" aria-hidden>
                <span className="bg-teal block h-full w-3/5 rounded-full" />
              </div>
              <span className="bg-gold/20 text-gold-d mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold">+10 {term('xp')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-gold text-gold-fg inline-flex h-10 items-center rounded-full px-5 text-sm font-bold shadow-[0_4px_0_var(--gold-d)]">
                Primary button
              </span>
              <span className="bg-teal text-teal-fg inline-flex h-10 items-center rounded-full px-5 text-sm font-bold">Secondary fill</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-5">
        <FontsSection heading={t.fonts.heading} body={t.fonts.body} onChange={(fonts) => d.setDraft({ ...t, fonts })} />
      </div>
    </SectionShell>
  )
}

function Result({ ok, warn, children }: { ok: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <p className={cn('flex items-center gap-2', ok ? (warn ? 'text-ink/80' : 'text-teal-d') : 'text-coral-d')}>
      {ok && !warn ? <Check className="size-4" aria-hidden /> : <TriangleAlert className="size-4" aria-hidden />}
      <span>
        {ok ? (warn ? 'OK, with a warning: ' : 'Passes: ') : 'Too low: '}
        {children}
      </span>
    </p>
  )
}
