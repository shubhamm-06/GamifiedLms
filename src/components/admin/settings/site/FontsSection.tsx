import { useEffect, useState, type CSSProperties } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FONT_CATALOG, FONT_IDS, getFont, loadFont, resolveFamily, type FontId } from '@/lib/settings/fonts'
import { useTerms } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'
import { SettingField } from './SectionShell'

// The preview panel sits in the admin page, outside .kid-app/.auth-page, so "default"
// can't reach the real chain (--font-kid, --font-ui-desktop) by inheritance — it would
// just show the ambient admin font (Geist) instead of what a learner actually sees.
// These mirror kid.css's own default literals so the preview stays accurate for
// "default" too, without the admin page needing .kid-app's full class/variable setup.
const DEFAULT_HEADING_FAMILY = "'Baloo 2 Variable', 'Baloo 2', ui-rounded, system-ui, -apple-system, \"Segoe UI\", sans-serif"
const DEFAULT_BODY_FAMILY = "'Nunito Variable', 'Baloo 2 Variable', 'Baloo 2', ui-rounded, system-ui, sans-serif"

interface PairingPreset {
  id: string
  label: string
  heading: FontId
  body: FontId
}

/** Fills the two selects only — never saves on its own (the tab's own Save does). */
const PAIRINGS: PairingPreset[] = [
  { id: 'default', label: 'Default', heading: 'default', body: 'default' },
  { id: 'playful', label: 'Playful', heading: 'baloo-2', body: 'nunito' },
  { id: 'friendly', label: 'Friendly', heading: 'nunito', body: 'nunito' },
  { id: 'modern', label: 'Modern', heading: 'plus-jakarta-sans', body: 'inter' },
  { id: 'clean', label: 'Clean', heading: 'inter', body: 'inter' },
  { id: 'editorial', label: 'Editorial', heading: 'source-serif-4', body: 'inter' },
]

/** A font's label, with a muted category tag — rendered in the ADMIN's own font (Geist), never preloaded. */
function FontOption({ id }: { id: FontId }) {
  const f = getFont(id)
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span>{f.label}</span>
      {f.id !== 'default' ? <span className="text-muted-foreground text-xs">{f.category}</span> : null}
    </span>
  )
}

function FontSelect({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: FontId; onChange: (id: FontId) => void }) {
  return (
    <SettingField id={id} label={label} hint={hint}>
      <Select value={value} onValueChange={(v) => onChange(v as FontId)}>
        <SelectTrigger id={id} className="w-full font-sans">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="font-sans">
          {FONT_IDS.map((fid) => (
            <SelectItem key={fid} value={fid} data-testid={`font-option-${fid}`}>
              <FontOption id={fid} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingField>
  )
}

/** A short, non-blocking nudge — never a hard error. */
function PlayfulBodyNote({ bodyId }: { bodyId: FontId }) {
  const playful = getFont(bodyId).category === 'Playful'
  if (!playful) return null
  return (
    <p className="flex items-start gap-1.5 text-xs text-ink/60" data-testid="playful-body-note">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      Playful fonts can be harder to read in long text.
    </p>
  )
}

/**
 * Two selects (heading, body), pairing chips that only fill them, and a scoped live
 * preview — its own `--learner-font-heading`/`--learner-font-body` (not `--font-heading`/
 * `--font-body`: index.css's `@theme inline` already owns `--font-heading` as a Tailwind
 * utility token — see lib/settings/store.ts), so nothing outside this box changes until
 * the tab is saved. A picked font loads as soon as it is picked.
 */
export function FontsSection({ heading, body, onChange }: { heading: FontId; body: FontId; onChange: (next: { heading: FontId; body: FontId }) => void }) {
  const { term, terms } = useTerms()
  // Only ids that have FINISHED loading are tracked (never set synchronously in the
  // effect body itself — only in the async .then — so this never cascades a render).
  // "default" never appears here: loadFont resolves it without a real fetch.
  const [loaded, setLoaded] = useState<Set<FontId>>(() => new Set())
  useEffect(() => {
    let cancelled = false
    void Promise.all([loadFont(heading), loadFont(body)]).then(() => {
      if (cancelled) return
      setLoaded((prev) => {
        const next = new Set(prev)
        next.add(heading)
        next.add(body)
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [heading, body])
  const isPending = (id: FontId) => id !== 'default' && !loaded.has(id)

  const headingFamily = resolveFamily(heading) ?? DEFAULT_HEADING_FAMILY
  const bodyFamily = resolveFamily(body) ?? DEFAULT_BODY_FAMILY
  const scoped = {
    '--learner-font-heading': headingFamily,
    '--learner-font-body': bodyFamily,
  } as CSSProperties
  const loading = isPending(heading) || isPending(body)
  const headingDevanagari = getFont(heading).devanagari
  const bodyDevanagari = getFont(body).devanagari

  return (
    <div className="space-y-5" data-testid="fonts-section">
      <div>
        <h3 className="text-sm font-semibold">Fonts</h3>
        <p className="text-muted-foreground text-sm">
          Applies to learner screens and the sign-in pages. The admin panel keeps its own font. Chosen from a curated list — no uploads, no links, no custom
          CSS.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Quick pairings</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Font pairings">
          {PAIRINGS.map((p) => {
            const active = p.heading === heading && p.body === body
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ heading: p.heading, body: p.body })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  active ? 'border-foreground font-medium' : 'hover:bg-muted',
                )}
                data-testid={`pairing-${p.id}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FontSelect id="f-heading" label="Heading font" hint="Page and section titles, and stat numbers." value={heading} onChange={(id) => onChange({ heading: id, body })} />
        <FontSelect id="f-body" label="Body font" hint="Everything else: paragraphs, buttons, labels, badges." value={body} onChange={(id) => onChange({ heading, body: id })} />
      </div>
      <PlayfulBodyNote bodyId={body} />

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          Preview
          {loading ? (
            <span className="text-muted-foreground text-xs" data-testid="font-loading">
              Loading…
            </span>
          ) : null}
        </p>
        <div className="space-y-4 rounded-lg border bg-cream p-5 text-ink" style={scoped} data-testid="fonts-preview">
          <h4 className="text-2xl font-bold" style={{ fontFamily: 'var(--learner-font-heading)' }} data-testid="preview-heading">
            {terms('lesson')} ready for you
          </h4>
          <p className="text-sm leading-relaxed text-ink/80" style={{ fontFamily: 'var(--learner-font-body)' }} data-testid="preview-body">
            A short paragraph of body text, the kind a {term('lesson').toLowerCase()} description or a profile note uses. 12 {term('course').toLowerCase()}
            {'s'}, 3.5 hours — not bad!
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="bg-gold text-gold-fg inline-flex h-10 items-center rounded-full px-5 text-sm font-bold"
              style={{ fontFamily: 'var(--learner-font-body)' }}
              data-testid="preview-button"
            >
              Primary button
            </span>
            <span
              className="bg-surface inline-flex flex-col items-center rounded-xl px-4 py-2 shadow-sm"
              data-testid="preview-stat"
            >
              <span className="text-xl font-extrabold" style={{ fontFamily: 'var(--learner-font-heading)' }}>
                128
              </span>
              <span className="text-ink/60 text-xs" style={{ fontFamily: 'var(--learner-font-body)' }}>
                {terms('xp')}
              </span>
            </span>
          </div>
          {headingDevanagari || bodyDevanagari ? (
            <p className="text-sm text-ink/80" data-testid="preview-hindi">
              {headingDevanagari ? <span style={{ fontFamily: 'var(--learner-font-heading)' }}>आज नया सीखें </span> : null}
              {bodyDevanagari ? <span style={{ fontFamily: 'var(--learner-font-body)' }}>आज नया सीखें</span> : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export { FONT_CATALOG }
