import { Switch } from '@/components/ui/switch'
import type { SiteConfigRow } from '@/hooks/admin/useSiteConfig'
import { useTerms } from '@/hooks/useSettings'
import type { FeatureKey } from '@/lib/settings/schema'
import type { Terms } from '@/lib/settings/terms'
import { SectionShell } from './SectionShell'
import { useSectionDraft } from './useSectionDraft'

interface Row {
  key: FeatureKey
  label: (t: Terms) => string
  description: (t: Terms) => string
  /** The switches this one needs on (gamification is the master switch; levels need XP). */
  needs?: FeatureKey[]
  indent?: boolean
}

const ROWS: Row[] = [
  { key: 'gamification', label: () => 'Gamification', description: (t) => `The master switch for ${t.lower('xp', true)}, ${t.lower('streak', true)}, ${t.lower('badge', true)} and ${t.lower('level', true)}.` },
  { key: 'xp', label: (t) => t.term('xp'), description: (t) => `Points for finishing each ${t.lower('lesson')}, shown on paths, profiles and completion.`, needs: ['gamification'], indent: true },
  { key: 'levels', label: (t) => t.terms('level'), description: (t) => `Profile ${t.lower('level', true)} built from ${t.lower('xp', true)}.`, needs: ['gamification', 'xp'], indent: true },
  { key: 'streaks', label: (t) => t.terms('streak'), description: (t) => `Daily ${t.lower('streak', true)} and the activity calendar.`, needs: ['gamification'], indent: true },
  { key: 'badges', label: (t) => t.terms('badge'), description: (t) => `The ${t.lower('badge', true)} screen and its navigation item.`, needs: ['gamification'], indent: true },
  { key: 'avatars', label: () => 'Avatars', description: () => 'Learners build an avatar. Off: initials instead, and no avatar builder.' },
  { key: 'celebrations', label: () => 'Celebrations', description: (t) => `Confetti and animation when a ${t.lower('lesson')} is finished. Reduced-motion settings are always respected.` },
  { key: 'publicCoursePages', label: (t) => `Public ${t.lower('course')} pages`, description: (t) => `Anyone with a ${t.lower('course')} link can see its page without signing in. Off: visitors sign in first.` },
]

/**
 * UI-level switches (Phase 1): the server keeps recording XP, streaks and badges, so
 * turning one back on shows the full history. Dependent switches are disabled with a
 * reason while what they need is off.
 */
export function FeaturesTab({ row }: { row: SiteConfigRow<'features'> }) {
  const d = useSectionDraft(row)
  const f = d.draft
  const terms = useTerms()

  return (
    <SectionShell
      title="Features"
      description="Changes apply to every learner and admin as soon as you save. Nothing is deleted: turning a feature back on shows all its history."
      draft={d}
    >
      <ul className="divide-y rounded-md border">
        {ROWS.map((r) => {
          const blockedBy = (r.needs ?? []).find((k) => !f[k])
          const id = `f-${r.key}`
          return (
            <li key={r.key} className={r.indent ? 'flex items-start gap-4 py-3 pr-4 pl-10' : 'flex items-start gap-4 px-4 py-3'} data-testid={`feature-${r.key}`}>
              <div className="min-w-0 flex-1">
                <label htmlFor={id} className="text-sm font-medium">
                  {r.label(terms)}
                </label>
                <p className="text-muted-foreground text-sm">{r.description(terms)}</p>
                {blockedBy ? (
                  <p className="text-muted-foreground mt-1 text-xs" data-testid={`feature-${r.key}-blocked`}>
                    Off while {ROWS.find((x) => x.key === blockedBy)?.label(terms)} is off.
                  </p>
                ) : null}
              </div>
              <Switch
                id={id}
                checked={f[r.key] && !blockedBy}
                disabled={!!blockedBy}
                onCheckedChange={(checked) => d.setDraft({ ...f, [r.key]: checked })}
              />
            </li>
          )
        })}
      </ul>
    </SectionShell>
  )
}
