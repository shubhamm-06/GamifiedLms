import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  Backpack,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  CircleHelp,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  List,
  ListChecks,
  ListTree,
  MessageSquareQuote,
  Plus,
  Trash2,
  Type,
  UserRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DragHandle, SimpleSortableList } from '@/components/admin/dnd/SimpleSortableList'
import { cn } from '@/lib/utils'
import { entryId, PAGE_LIMITS, SECTION_LABELS, type NormCustom, type NormEntry, type SectionStatus } from '@/lib/coursePage'
import { newCustomEntry, type PageFormValues } from '@/lib/coursePageForm'
import type { CustomType } from '@/lib/coursePageSchema'
import { Counter, FaqEditor, FieldError, ListEditor, Segmented, TestimonialEditor } from './PageEditors'
import { getTerms as tw } from '@/lib/settings/terms'

const STATUS_TEXT: Record<SectionStatus, string> = {
  showing: 'Showing',
  hidden_by_you: 'Hidden by you',
  empty: 'No content yet, hidden automatically',
}
const CUSTOM_LABEL: Record<CustomType, string> = { text: 'Text', list: 'List', image: 'Image' }

/** One leading icon per section row (secondary ink, 20px): a quick way to find a row, never the only label. */
const ROW_ICON: Record<string, LucideIcon> = {
  about: FileText,
  learn: ListChecks,
  inside: ListTree,
  how: Workflow,
  need: Backpack,
  reviews: MessageSquareQuote,
  made_by: UserRound,
  faq: CircleHelp,
  text: Type,
  list: List,
  image: ImageIcon,
}
const rowIcon = (e: NormEntry): LucideIcon => ROW_ICON[e.key === 'custom' ? e.type : e.key]

/** Which form errors belong to which row, so a collapsed row with a problem says so. */
function rowErrorPrefixes(e: NormEntry): string[] {
  if (e.key === 'custom') return [`layout.${e.id}.`]
  const own = [`layout.${e.key}.`]
  switch (e.key) {
    case 'learn':
      return [...own, 'learning_outcomes']
    case 'need':
      return [...own, 'requirements']
    case 'faq':
      return [...own, 'faqs']
    case 'made_by':
      return [...own, 'instructor_']
    case 'reviews':
      return [...own, 'testimonials']
    case 'how':
      return [...own, 'options.how_']
    default:
      return own
  }
}

function rowName(e: NormEntry): string {
  if (e.key === 'custom') return e.title.trim() || `New ${CUSTOM_LABEL[e.type].toLowerCase()} section`
  return e.title.trim() || SECTION_LABELS[e.key]
}

interface SectionsEditorProps {
  values: PageFormValues
  update: (fn: (v: PageFormValues) => PageFormValues) => void
  status: Record<string, SectionStatus>
  errors: Record<string, string>
  warnings: Record<string, string>
  courseId: string
  /** The automatic "How it works" intro and rules, shown as placeholders / the fallback. */
  autoHowIntro: string | null
  defaultHowItems: string[]
}

/**
 * The ordered list of ALL page sections (built-in and custom). Each row: drag handle (the
 * shared dnd-kit list, snap only, no animation) plus Move up / Move down buttons for keyboard
 * users, the name, a status chip from the SAME model the page uses, a visibility switch and an
 * expand control. At most one row is expanded at a time so the editor never overwhelms.
 */
export function SectionsEditor({ values, update, status, errors, warnings, courseId, autoHowIntro, defaultHowItems }: SectionsEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<NormCustom | null>(null)
  const layout = values.layout
  const customs = layout.filter((e) => e.key === 'custom').length
  const full = customs >= PAGE_LIMITS.layout.customs || layout.length >= PAGE_LIMITS.layout.entries

  const setLayout = (next: NormEntry[]) => update((v) => ({ ...v, layout: next }))
  const patchEntry = (id: string, patch: Partial<NormEntry>) =>
    update((v) => ({ ...v, layout: v.layout.map((e) => (entryId(e) === id ? ({ ...e, ...patch } as NormEntry) : e)) }))
  const move = (from: number, to: number) => {
    const next = layout.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setLayout(next)
  }
  const add = (type: CustomType) => {
    const entry = newCustomEntry(type)
    setLayout([...layout, entry])
    setExpanded(entry.id)
  }

  const items = layout.map((e, i) => ({ id: entryId(e), position: i, entry: e }))

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground -mt-1 text-xs">
        Drag a row, or use its arrow buttons, to change the order on the page. Sections with no content are hidden automatically.
      </p>
      <SimpleSortableList
        items={items}
        className="space-y-2"
        onReorder={(changed) => {
          const pos = new Map(items.map((it) => [it.id, it.position]))
          for (const c of changed) pos.set(c.id, c.position)
          setLayout([...items].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0)).map((it) => it.entry))
        }}
        renderOverlay={(it) => <div className="bg-background rounded-lg border px-3 py-2 text-sm font-medium">{rowName(it.entry)}</div>}
        renderRow={(it, handle) => {
          const e = it.entry
          const id = it.id
          const i = it.position
          const name = rowName(e)
          const open = expanded === id
          const chip: SectionStatus = !e.visible ? 'hidden_by_you' : (status[id] ?? 'empty')
          const hasError = Object.keys(errors).some((k) => rowErrorPrefixes(e).some((p) => k.startsWith(p)))
          return (
            <div className={cn('bg-background rounded-lg border', open && 'ring-foreground/20 ring-1')} data-section-row={id}>
              <div className="flex flex-wrap items-center gap-2 px-2 py-2">
                <DragHandle attributes={handle.attributes} listeners={handle.listeners} label={`Drag to reorder ${name}`} />
                <div className="flex gap-0.5">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${name} up`}>
                    <ChevronUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={i === layout.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${name} down`}>
                    <ChevronDown />
                  </Button>
                </div>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-expanded={open}
                  aria-controls={`section-panel-${id}`}
                  onClick={() => setExpanded(open ? null : id)}
                >
                  {(() => {
                    const Icon = rowIcon(e)
                    return <Icon className="text-muted-foreground size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  })()}
                  <span className="min-w-0 truncate">{name}</span>
                  {e.key === 'custom' ? <span className="text-muted-foreground shrink-0 text-xs font-normal">{CUSTOM_LABEL[e.type]}</span> : null}
                  {hasError ? <AlertCircle className="text-coral-d size-4 shrink-0" aria-label="Needs attention" /> : null}
                </button>
                <Badge variant={chip === 'showing' ? 'secondary' : 'outline'} data-status={chip} className="shrink-0">
                  {chip === 'empty' ? <CircleDashed strokeWidth={1.75} aria-hidden="true" /> : null}
                  {STATUS_TEXT[chip]}
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1.5">
                  {e.visible ? <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                  <Switch checked={e.visible} onCheckedChange={(on) => patchEntry(id, { visible: on })} aria-label={`Show ${name} on the page`} />
                </span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setExpanded(open ? null : id)} aria-label={open ? `Collapse ${name}` : `Edit ${name}`} aria-expanded={open}>
                  <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
                </Button>
              </div>
              {open ? (
                <div id={`section-panel-${id}`} className="space-y-4 border-t px-4 py-4" data-testid="section-panel">
                  <RowPanel
                    entry={e}
                    values={values}
                    update={update}
                    patchEntry={patchEntry}
                    errors={errors}
                    warnings={warnings}
                    courseId={courseId}
                    autoHowIntro={autoHowIntro}
                    defaultHowItems={defaultHowItems}
                    onDelete={e.key === 'custom' ? () => setDeleting(e) : undefined}
                  />
                </div>
              ) : null}
            </div>
          )
        }}
      />
      <FieldError id="layout-err" message={errors.layout} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={full}>
            <Plus />
            Add section
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(['text', 'list', 'image'] as const).map((t) => (
            <DropdownMenuItem key={t} onSelect={() => add(t)}>
              {CUSTOM_LABEL[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {full ? <p className="text-muted-foreground text-xs">You can add up to {PAGE_LIMITS.layout.customs} sections of your own.</p> : null}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting ? rowName(deleting) : ''}&rdquo; and its content will be removed from the page when you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) setLayout(layout.filter((x) => entryId(x) !== deleting.id))
                setExpanded(null)
                setDeleting(null)
              }}
            >
              Delete section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  max,
  error,
  placeholder,
  hint,
  multiline,
  onChange,
}: {
  id: string
  label: string
  value: string
  max: number
  error?: string
  placeholder?: string
  hint?: ReactNode
  multiline?: boolean
  onChange: (v: string) => void
}) {
  const props = { id, value, maxLength: max, placeholder, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined }
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? <Textarea rows={4} {...props} onChange={(e) => onChange(e.target.value)} /> : <Input {...props} onChange={(e) => onChange(e.target.value)} />}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <FieldError id={`${id}-err`} message={error} />
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        <span className="ml-auto">
          <Counter value={value.length} max={max} />
        </span>
      </div>
    </div>
  )
}

function RowPanel({
  entry: e,
  values,
  update,
  patchEntry,
  errors,
  warnings,
  courseId,
  autoHowIntro,
  defaultHowItems,
  onDelete,
}: {
  entry: NormEntry
  values: PageFormValues
  update: (fn: (v: PageFormValues) => PageFormValues) => void
  patchEntry: (id: string, patch: Partial<NormEntry>) => void
  errors: Record<string, string>
  warnings: Record<string, string>
  courseId: string
  autoHowIntro: string | null
  defaultHowItems: string[]
  onDelete?: () => void
}) {
  const L = PAGE_LIMITS
  const id = entryId(e)
  const k = `layout.${id}`
  const set = <K extends keyof PageFormValues>(key: K, value: PageFormValues[K]) => update((v) => ({ ...v, [key]: value }))
  const setOpt = <K extends keyof PageFormValues['options']>(key: K, value: PageFormValues['options'][K]) => update((v) => ({ ...v, options: { ...v.options, [key]: value } }))

  if (e.key === 'custom') {
    return (
      <>
        <TextField id={`${k}-title`} label="Title" value={e.title} max={L.layout.title} error={errors[`${k}.title`]} onChange={(t) => patchEntry(id, { title: t })} />
        {e.type === 'text' ? (
          <TextField
            id={`${k}-body`}
            label="Text"
            multiline
            value={e.body}
            max={L.custom.body}
            error={errors[`${k}.body`]}
            hint="Plain text. Leave a blank line between paragraphs."
            onChange={(t) => patchEntry(id, { body: t })}
          />
        ) : null}
        {e.type === 'list' ? (
          <>
            <Segmented
              name={`${k}-style`}
              label="List style"
              value={e.list_style}
              options={[
                { value: 'bullet', label: 'Dots' },
                { value: 'check', label: 'Ticks' },
                { value: 'number', label: 'Numbers' },
              ]}
              onChange={(s) => patchEntry(id, { list_style: s })}
            />
            <ListEditor
              id={`${k}-item`}
              noun="line"
              items={e.items}
              max={L.custom.listItems}
              maxLen={L.custom.listItem}
              placeholder="A line of the list"
              errors={errors}
              errorKey={`${k}.items`}
              onChange={(n) => patchEntry(id, { items: n })}
            />
          </>
        ) : null}
        {e.type === 'image' ? (
          <>
            <TextField
              id={`${k}-url`}
              label="Image link"
              value={e.image_url}
              max={L.url}
              placeholder="https://"
              error={errors[`${k}.image_url`]}
              hint="Paste a hosted image link starting with https://. If it fails to load, the section is hidden."
              onChange={(t) => patchEntry(id, { image_url: t })}
            />
            <TextField id={`${k}-alt`} label="Description for screen readers" value={e.alt} max={L.custom.alt} error={errors[`${k}.alt`]} onChange={(t) => patchEntry(id, { alt: t })} />
            <TextField id={`${k}-caption`} label="Caption (optional)" value={e.caption} max={L.custom.caption} error={errors[`${k}.caption`]} onChange={(t) => patchEntry(id, { caption: t })} />
          </>
        ) : null}
        {onDelete ? (
          <div className="border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onDelete}>
              <Trash2 />
              Delete section
            </Button>
          </div>
        ) : null}
      </>
    )
  }

  const titleField = (
    <TextField
      id={`${k}-title`}
      label="Title"
      value={e.title}
      max={L.layout.title}
      placeholder={SECTION_LABELS[e.key]}
      error={errors[`${k}.title`]}
      hint="Leave empty to use the standard title."
      onChange={(t) => patchEntry(id, { title: t })}
    />
  )
  const introField =
    e.key === 'how' ? (
      <TextField
        id="options-how-intro"
        label="Intro line"
        value={values.options.how_intro}
        max={L.howIntro}
        placeholder={autoHowIntro ?? ''}
        error={errors['options.how_intro']}
        hint={`Leave empty to describe the ${tw().lower('lesson')} types automatically.`}
        onChange={(t) => setOpt('how_intro', t)}
      />
    ) : (
      <TextField
        id={`${k}-intro`}
        label="Intro line (optional)"
        value={e.intro}
        max={L.layout.intro}
        placeholder={e.key === 'inside' ? 'An automatic summary is shown when empty' : ''}
        error={errors[`${k}.intro`]}
        onChange={(t) => patchEntry(id, { intro: t })}
      />
    )

  let content: ReactNode = null
  switch (e.key) {
    case 'about':
      content = (
        <p className="text-sm">
          The text comes from the course Description in the{' '}
          <Link to="/admin/courses/$courseId/edit" params={{ courseId }} search={{ tab: 'basics' }} className="text-teal-d underline underline-offset-2">
            Basics tab
          </Link>
          . Leave a blank line between paragraphs.
        </p>
      )
      break
    case 'learn':
      content = (
        <ListEditor
          id="outcome"
          noun="outcome"
          items={values.learning_outcomes}
          max={L.outcomes.items}
          maxLen={L.outcomes.length}
          placeholder="For example: Count objects up to 100"
          errors={errors}
          errorKey="learning_outcomes"
          onChange={(n) => set('learning_outcomes', n)}
        />
      )
      break
    case 'need':
      content = (
        <ListEditor
          id="need"
          noun="item"
          items={values.requirements}
          max={L.requirements.items}
          maxLen={L.requirements.length}
          placeholder="For example: A phone, tablet or computer"
          errors={errors}
          errorKey="requirements"
          onChange={(n) => set('requirements', n)}
        />
      )
      break
    case 'inside':
      content = (
        <div className="space-y-3">
          <Segmented
            name="outline-detail"
            label="Show"
            value={values.options.outline.detail}
            options={[
              { value: 'lessons', label: `Sections and ${tw().lower('lesson', true)}` },
              { value: 'sections', label: 'Sections only' },
            ]}
            onChange={(d) => setOpt('outline', { ...values.options.outline, detail: d })}
          />
          {values.options.outline.detail === 'lessons' ? (
            <Segmented
              name="outline-open"
              label="Open when the page loads"
              value={values.options.outline.open}
              options={[
                { value: 'first', label: 'First section' },
                { value: 'all', label: 'All' },
                { value: 'none', label: 'None' },
              ]}
              onChange={(o) => setOpt('outline', { ...values.options.outline, open: o })}
            />
          ) : null}
          <div className="flex items-center gap-2">
            <Switch
              id="outline-minutes"
              checked={values.options.outline.show_minutes}
              onCheckedChange={(on) => setOpt('outline', { ...values.options.outline, show_minutes: on })}
            />
            <Label htmlFor="outline-minutes">Show minutes</Label>
          </div>
          <p className="text-muted-foreground text-xs">{`${tw().terms('lesson')} and their minutes come from the Curriculum tab (published ${tw().lower('lesson', true)} only).`}</p>
        </div>
      )
      break
    case 'how':
      content = (
        <div className="space-y-2">
          <p className="text-sm font-medium">Rules</p>
          <ListEditor
            id="how-item"
            noun="rule"
            items={values.options.how_items}
            max={L.howItems.items}
            maxLen={L.howItems.length}
            placeholder="A short rule, e.g. Quizzes can be retried."
            errors={errors}
            errorKey="options.how_items"
            emptyText="Using the standard rules:"
            onChange={(n) => setOpt('how_items', n)}
          />
          {values.options.how_items.length === 0 ? (
            <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-sm">
              {defaultHowItems.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )
      break
    case 'reviews':
      content = <TestimonialEditor items={values.testimonials} errors={errors} warnings={warnings} onChange={(n) => set('testimonials', n)} />
      break
    case 'made_by':
      content = (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">Nothing shows unless you add a name.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="instructor_name" label="Name" value={values.instructor_name} max={L.instructorName} error={errors.instructor_name} onChange={(t) => set('instructor_name', t)} />
            <TextField id="instructor_role" label="Role" value={values.instructor_role} max={L.instructorRole} error={errors.instructor_role} onChange={(t) => set('instructor_role', t)} />
          </div>
          <TextField id="instructor_bio" label="Bio" multiline value={values.instructor_bio} max={L.instructorBio} error={errors.instructor_bio} onChange={(t) => set('instructor_bio', t)} />
          <TextField
            id="instructor_photo_url"
            label="Photo link"
            value={values.instructor_photo_url}
            max={L.url}
            placeholder="https://"
            error={errors.instructor_photo_url}
            hint="Without one, initials are shown."
            onChange={(t) => set('instructor_photo_url', t)}
          />
        </div>
      )
      break
    case 'faq':
      content = <FaqEditor items={values.faqs} errors={errors} warnings={warnings} onChange={(n) => set('faqs', n)} />
      break
  }
  return (
    <>
      {titleField}
      {introField}
      {content}
    </>
  )
}
