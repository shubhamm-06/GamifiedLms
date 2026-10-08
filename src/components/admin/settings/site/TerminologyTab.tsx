import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SiteConfigRow } from '@/hooks/admin/useSiteConfig'
import { DEFAULT_SETTINGS, TERM_KEYS, type TermKey } from '@/lib/settings/schema'
import { makeTerms } from '@/lib/settings/terms'
import { SectionShell } from './SectionShell'
import { useSectionDraft } from './useSectionDraft'

const ROW_LABEL: Record<TermKey, string> = {
  course: 'Course',
  module: 'Module',
  lesson: 'Lesson',
  xp: 'XP (points)',
  badge: 'Badge',
  streak: 'Streak',
  level: 'Level',
}

/** Display words only: routes, data and code keep their own names. */
export function TerminologyTab({ row }: { row: SiteConfigRow<'terminology'> }) {
  // A few admin labels are built once per page load, so the page reloads after a save to show every new word.
  const d = useSectionDraft(row, { onSaved: () => window.setTimeout(() => window.location.reload(), 900) })
  const t = d.draft
  const set = (key: TermKey, form: 'singular' | 'plural', value: string) => d.setDraft({ ...t, [key]: { ...t[key], [form]: value } })
  const preview = makeTerms(t)

  return (
    <SectionShell
      title="Terminology"
      description="The words learners and admins see for each idea. Write both forms: the app never guesses a plural."
      draft={d}
    >
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Term</th>
              <th scope="col" className="px-3 py-2 font-medium">Default</th>
              <th scope="col" className="px-3 py-2 font-medium">Your singular</th>
              <th scope="col" className="px-3 py-2 font-medium">Your plural</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Reset</span></th>
            </tr>
          </thead>
          <tbody>
            {TERM_KEYS.map((key) => {
              const def = DEFAULT_SETTINGS.terminology[key]
              const changed = t[key].singular !== def.singular || t[key].plural !== def.plural
              return (
                <tr key={key} className="border-t align-top" data-testid={`term-${key}`}>
                  <th scope="row" className="px-3 py-2 font-medium">{ROW_LABEL[key]}</th>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {def.singular} / {def.plural}
                  </td>
                  {(['singular', 'plural'] as const).map((form) => {
                    const error = d.errors[`${key}.${form}`]
                    return (
                      <td key={form} className="px-3 py-2">
                        <Input
                          value={t[key][form]}
                          maxLength={40}
                          aria-label={`${ROW_LABEL[key]}, ${form}`}
                          aria-invalid={!!error}
                          onChange={(e) => set(key, form, e.target.value)}
                        />
                        {error ? <p className="text-coral-d mt-1 text-xs">{error}</p> : null}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={!changed}
                      aria-label={`Reset ${ROW_LABEL[key]} to the default`}
                      onClick={() => d.setDraft({ ...t, [key]: { ...def } })}
                    >
                      <RotateCcw />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border p-3 text-sm" aria-live="polite" data-testid="terms-example">
        <p className="text-muted-foreground mb-1 text-xs">Example</p>
        <p>
          You completed {preview.formatCount('lesson', 3)} in this {preview.lower('module')} and earned 120 {preview.lower('xp', true)}.
        </p>
        <p>
          Your {preview.lower('streak')} is 4 days and you reached {preview.term('level')} 2.
        </p>
        <p>
          {preview.terms('badge')} earned in this {preview.lower('course')}: 1 of 6.
        </p>
      </div>
      <p className="text-muted-foreground text-xs">Letters, numbers, spaces, hyphens and apostrophes, 1 to 24 characters each.</p>
    </SectionShell>
  )
}
