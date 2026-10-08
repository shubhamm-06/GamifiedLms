import { useBranding } from '@/hooks/useSettings'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useBlocker } from '@tanstack/react-router'
import { Copy, ExternalLink, Eye, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { FONT_PRESETS, loadCoursePageFont } from '@/components/kid/coursePage/fonts'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useCourseOutline } from '@/hooks/useCourseInfo'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useUpdateCoursePage } from '@/hooks/admin/useCoursePage'
import type { Course } from '@/hooks/admin/useCourses'
import {
  buildCoursePageModel,
  defaultHowItems,
  FACT_KEYS,
  FACT_LABELS,
  PAGE_FONTS,
  PAGE_LIMITS,
  PAGE_THEMES,
  type CoursePageCourse,
  type PageFont,
  type PageTheme,
} from '@/lib/coursePage'
import { previewCourse, samePage, toPageFormValues, validatePageValues, type PageFormValues } from '@/lib/coursePageForm'
import { ChoiceCard, Counter, CustomFactsEditor, FieldError, ListEditor, Segmented } from './PageEditors'
import { CoursePagePreview } from './CoursePagePreview'
import { SectionsEditor } from './SectionsEditor'
import { getTerms as tw } from '@/lib/settings/terms'

const XL_UP = '(min-width: 1280px)'
const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Kannada', 'Punjabi', 'Spanish', 'French']
const THEME_SWATCH: Record<PageTheme, { label: string; color: string }> = {
  teal: { label: 'Teal', color: '#2fa3a0' },
  plum: { label: 'Plum', color: '#7a5fa8' },
  coral: { label: 'Coral', color: '#e2543d' },
  ink: { label: 'Ink', color: '#3a2a1a' },
}
const UNSAVED = `You have unsaved changes to this ${tw().lower('course')} page. Leave without saving them?`

/** A plain white card with a clear heading: the editor's five groups. */
function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground mt-0.5 text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Text({
  id,
  label,
  value,
  max,
  error,
  placeholder,
  hint,
  type,
  onChange,
}: {
  id: string
  label: string
  value: string
  max: number
  error?: string
  placeholder?: string
  hint?: ReactNode
  type?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} maxLength={max} placeholder={placeholder} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} onChange={(e) => onChange(e.target.value)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <FieldError id={`${id}-err`} message={error} />
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        {type === 'url' ? null : (
          <span className="ml-auto">
            <Counter value={value.length} max={max} />
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * The "Course page" tab: everything a parent sees beyond the basics, with a live preview of
 * the UNSAVED values. One Save writes ONLY the page columns (`useUpdateCoursePage`), with its
 * own dirty state, an unsaved-changes warning, and the database's CHECK errors shown as
 * readable text. The preview is the real page component fed by the same
 * `buildCoursePageModel` the student page uses, so they cannot disagree.
 */
export function CoursePageTab({ course }: { course: Course }) {
  const [baseline, setBaseline] = useState(() => toPageFormValues(course))
  const [values, setValues] = useState(baseline)
  const [triedSave, setTriedSave] = useState(false)
  const save = useUpdateCoursePage(course.id)
  const outline = useCourseOutline(course.id)
  const settings = useAppSettings()
  const wide = useMediaQuery(XL_UP)
  const [sheetOpen, setSheetOpen] = useState(false)

  const dirty = !samePage(values, baseline)
  const { errors, warnings } = useMemo(() => validatePageValues(values), [values])
  const hasErrors = Object.keys(errors).length > 0

  useBlocker({ shouldBlockFn: () => (dirty ? !window.confirm(UNSAVED) : false), enableBeforeUnload: () => dirty })

  // The font cards render their own sample text, so all three presets' fonts load while this tab is open.
  useEffect(() => {
    for (const f of PAGE_FONTS) void loadCoursePageFont(f)
  }, [])

  const set = <K extends keyof PageFormValues>(key: K, value: PageFormValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const setOpt = <K extends keyof PageFormValues['options']>(key: K, value: PageFormValues['options'][K]) => setValues((v) => ({ ...v, options: { ...v.options, [key]: value } }))

  const basics: CoursePageCourse = useMemo(
    () => ({
      title: course.title,
      description: course.description,
      is_free: course.is_free,
      price_amount: course.price_amount,
      currency: course.currency,
      access_type: course.access_type,
      access_duration_days: course.access_duration_days,
      gamification_enabled: course.gamification_enabled,
      enroll_url: course.enroll_url,
    }),
    [course],
  )
  const branding = useBranding()
  const supportEmail = branding.supportEmail || settings.data?.support_email || null
  const model = useMemo(
    () => buildCoursePageModel({ course: previewCourse(basics, values), outline: outline.data ?? [], viewer: { kind: 'new' }, supportEmail }),
    [basics, values, outline.data, supportEmail],
  )
  // The automatic values, ignoring the admin's overrides: shown beside the fact switches and as placeholders.
  const auto = useMemo(() => {
    const plain = { ...values, options: { ...values.options, hidden_facts: [], custom_facts: [], included: [], how_intro: '' } }
    return buildCoursePageModel({ course: previewCourse(basics, plain), outline: outline.data ?? [], viewer: { kind: 'new' } })
  }, [basics, values, outline.data])
  const autoFact = (k: string) => auto.facts.find((f) => f.key === k)?.value ?? null
  const autoHowIntro = auto.sections.find((s) => s.kind === 'how')?.intro ?? null

  function onSave() {
    setTriedSave(true)
    if (hasErrors) return
    save.mutate(values, {
      onSuccess: (row) => {
        const saved = toPageFormValues(row)
        setBaseline(saved)
        setValues(saved)
        setTriedSave(false)
        toast.success(`${tw().term('course')} page saved.`)
      },
      onError: (e: Error) => toast.error(e.message),
    })
  }

  const basicsLink = (
    <Link to="/admin/courses/$courseId/edit" params={{ courseId: course.id }} search={{ tab: 'basics' }} className="text-teal-d underline underline-offset-2">
      Basics tab
    </Link>
  )

  // The shareable link: the public page (no login), on the configured site URL when there is one.
  const publicUrl = `${(settings.data?.site_url || window.location.origin).replace(/\/+$/, '')}/course/${course.slug}`
  const copyLink = () =>
    navigator.clipboard.writeText(publicUrl).then(
      () => toast.success('Public link copied.'),
      () => toast.error('Could not copy. Select the link and copy it by hand.'),
    )

  const preview = (
    <div className="space-y-3">
      <CoursePagePreview model={model} />
      {course.status === 'published' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/courses/$courseId" params={{ courseId: course.slug }} target="_blank" rel="noopener noreferrer" aria-label="Open page as student sees it (opens in a new tab)">
                <ExternalLink />
                Open page as student sees it
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
              <Copy />
              Copy public link
            </Button>
          </div>
          <p className="text-muted-foreground text-xs break-all">
            Anyone with <span data-testid="public-url">{publicUrl}</span> can see this page without logging in.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{`Publish the ${tw().lower('course')} to open the saved page as a student sees it.`}</p>
      )}
    </div>
  )

  const o = values.options

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" data-testid="course-page-tab">
      <form
        className="max-w-2xl min-w-0 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onSave()
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">{`What parents see on the ${tw().lower('course')} page. Sections with no content are hidden automatically.`}</p>
          {!wide ? (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm" data-testid="open-preview">
                  <Eye />
                  Preview
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-[560px]">
                <SheetHeader className="p-0">
                  <SheetTitle>{`${tw().term('course')} page preview`}</SheetTitle>
                  <SheetDescription>Shows your unsaved changes.</SheetDescription>
                </SheetHeader>
                {preview}
              </SheetContent>
            </Sheet>
          ) : null}
        </div>

        <Card title="Top of page">
          <Text id="tagline" label="Tagline" value={values.tagline} max={PAGE_LIMITS.tagline} error={errors.tagline} hint={`One short line shown under the ${tw().lower('course')} name.`} onChange={(t) => set('tagline', t)} />
          <Text
            id="thumbnail_url"
            label="Cover image link"
            type="url"
            value={values.thumbnail_url}
            max={PAGE_LIMITS.url}
            placeholder="https://"
            error={errors.thumbnail_url}
            hint={<>{`This is the ${tw().lower('course')} thumbnail (also in the `}{basicsLink}). Without one, a plain generated cover is drawn.</>}
            onChange={(t) => set('thumbnail_url', t)}
          />
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <Switch id="cover-show" checked={o.cover.show} onCheckedChange={(on) => setOpt('cover', { ...o.cover, show: on })} />
              <Label htmlFor="cover-show">Show cover</Label>
            </div>
            {o.cover.show ? (
              <Segmented
                name="cover-focus"
                label="Keep in view"
                value={o.cover.focus}
                options={[
                  { value: 'top', label: 'Top' },
                  { value: 'center', label: 'Center' },
                  { value: 'bottom', label: 'Bottom' },
                ]}
                onChange={(f) => setOpt('cover', { ...o.cover, focus: f })}
              />
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text id="cta_label" label="Button label" value={o.cta_label} max={PAGE_LIMITS.ctaLabel} placeholder="Enroll now" error={errors['options.cta_label']} onChange={(t) => setOpt('cta_label', t)} />
            <Text id="price_note" label="Price note (optional)" value={o.price_note} max={PAGE_LIMITS.priceNote} placeholder="e.g. One payment, no subscription" error={errors['options.price_note']} onChange={(t) => setOpt('price_note', t)} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">What&apos;s included</p>
            <ListEditor
              id="included"
              noun="line"
              items={o.included}
              max={PAGE_LIMITS.included.items}
              maxLen={PAGE_LIMITS.included.length}
              placeholder="e.g. Printable worksheets"
              errors={errors}
              errorKey="options.included"
              emptyText={`Using the automatic list: ${auto.included.join('; ')}.`}
              onChange={(n) => setOpt('included', n)}
            />
          </div>
        </Card>

        <Card title="Quick facts" description="Shown under the title. Switch off any you do not want; at most six facts show.">
          <ul className="divide-y">
            {FACT_KEYS.map((k) => {
              const value = autoFact(k)
              return (
                <li key={k} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Switch
                      id={`fact-${k}`}
                      checked={!o.hidden_facts.includes(k)}
                      onCheckedChange={(on) => setOpt('hidden_facts', on ? o.hidden_facts.filter((x) => x !== k) : [...o.hidden_facts, k])}
                    />
                    <Label htmlFor={`fact-${k}`}>{FACT_LABELS[k]}</Label>
                  </div>
                  <span className="text-muted-foreground truncate text-sm" data-fact-auto={k}>
                    {value ?? 'Not known, not shown'}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['age_min', 'age_max'] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k}>{k === 'age_min' ? 'Youngest age' : 'Oldest age'}</Label>
                <div className="flex gap-2">
                  <Input id={k} inputMode="numeric" value={values[k]} maxLength={2} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} onChange={(e) => set(k, e.target.value)} />
                  {values[k] ? (
                    <Button type="button" variant="outline" size="icon" onClick={() => set(k, '')} aria-label={`Clear ${k === 'age_min' ? 'youngest' : 'oldest'} age`}>
                      <X />
                    </Button>
                  ) : null}
                </div>
                <FieldError id={`${k}-err`} message={errors[k]} />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="language">Language</Label>
            <Input id="language" list="course-languages" value={values.language} maxLength={PAGE_LIMITS.language} aria-invalid={!!errors.language} onChange={(e) => set('language', e.target.value)} />
            <datalist id="course-languages">
              {LANGUAGES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            <FieldError id="language-err" message={errors.language} />
          </div>
          <p className="text-muted-foreground text-xs">{`${tw().terms('lesson')} and total time come from the published ${tw().lower('lesson', true)}; access from the `}{basicsLink}.</p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Custom facts</p>
            <CustomFactsEditor items={o.custom_facts} errors={errors} warnings={warnings} onChange={(n) => setOpt('custom_facts', n)} />
          </div>
        </Card>

        <Card title="Sections">
          <SectionsEditor
            values={values}
            update={setValues}
            status={model.sectionStatus}
            errors={errors}
            warnings={warnings}
            courseId={course.id}
            autoHowIntro={autoHowIntro}
            defaultHowItems={defaultHowItems(course.gamification_enabled === true)}
          />
        </Card>

        <Card title="Look and feel">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Colour</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PAGE_THEMES.map((t) => (
                <ChoiceCard key={t} name="page_theme" value={t} label={THEME_SWATCH[t].label} checked={values.page_theme === t} onSelect={() => set('page_theme', t)}>
                  <span className="block h-6 rounded-md" style={{ background: THEME_SWATCH[t].color }} aria-hidden />
                </ChoiceCard>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">Colours ticks, list dots and links. The Enroll button always stays gold.</p>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Font</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {PAGE_FONTS.map((f: PageFont) => (
                <ChoiceCard key={f} name="page_font" value={f} label={FONT_PRESETS[f].label} checked={values.page_font === f} onSelect={() => set('page_font', f)}>
                  <span className="text-base font-semibold" style={{ fontFamily: FONT_PRESETS[f].heading }}>
                    Learning made calm
                  </span>
                  <span className="text-muted-foreground text-sm" style={{ fontFamily: FONT_PRESETS[f].body }}>
                    {`Short ${tw().lower('lesson', true)} your child can finish in one sitting.`}
                  </span>
                </ChoiceCard>
              ))}
            </div>
          </fieldset>
        </Card>

        <div className="bg-background/95 sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t py-3 backdrop-blur" data-testid="save-bar">
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save page'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setValues(baseline)
              setTriedSave(false)
            }}
          >
            Discard changes
          </Button>
          {dirty ? (
            <span className="text-muted-foreground text-sm" role="status" data-testid="unsaved">
              Unsaved changes
            </span>
          ) : null}
          {hasErrors && (triedSave || dirty) ? (
            <FieldError id="page-errors" message={errors._config ?? 'Fix the highlighted fields to save. Sections that need attention are marked.'} />
          ) : null}
        </div>
      </form>

      {wide ? <div className="sticky top-4 max-h-[calc(100vh-2rem)] self-start overflow-y-auto pr-1">{preview}</div> : null}
    </div>
  )
}
