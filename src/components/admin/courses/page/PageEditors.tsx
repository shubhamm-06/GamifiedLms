import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SourceGlyph } from '@/components/kid/coursePage/testimonialSources'
import { PAGE_LIMITS } from '@/lib/coursePage'
import { TESTIMONIAL_SOURCES, type TestimonialSource } from '@/lib/coursePageLimits'
import { blankTestimonial, detectSource, type FaqRow, type TestimonialForm } from '@/lib/coursePageForm'

/** A running "12/160" count, so a limit is visible before it is hit (the inputs also enforce it with maxLength). */
export function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-xs tabular-nums ${value >= max ? 'text-foreground font-medium' : 'text-muted-foreground'}`} aria-hidden>
      {value}/{max}
    </span>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-coral-d text-sm">
      {message}
    </p>
  ) : null
}

/** Move up / move down / remove: plain buttons, no drag and drop, so it works by keyboard everywhere. */
function RowButtons({ noun, index, count, onMove, onRemove }: { noun: string; index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Move ${noun} ${index + 1} up`}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Move ${noun} ${index + 1} down`}>
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${noun} ${index + 1}`}>
        <Trash2 />
      </Button>
    </div>
  )
}

function moved<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** A repeatable one-line list (outcomes, requirements): add, remove, move up/down; blank rows are dropped on save. */
export function ListEditor({
  id,
  noun,
  items,
  max,
  maxLen,
  placeholder,
  errors,
  errorKey,
  onChange,
  emptyText = 'Nothing here yet. This section stays off the page until you add a line.',
}: {
  id: string
  noun: string
  items: string[]
  max: number
  maxLen: number
  placeholder: string
  errors: Record<string, string>
  errorKey: string
  onChange: (next: string[]) => void
  /** What to say when the list is empty (e.g. that an automatic list is used instead). */
  emptyText?: string
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? <p className="text-muted-foreground text-sm">{emptyText}</p> : null}
      {items.map((text, i) => {
        const err = errors[`${errorKey}.${i}`]
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  id={`${id}-${i}`}
                  value={text}
                  maxLength={maxLen}
                  placeholder={placeholder}
                  aria-label={`${noun} ${i + 1}`}
                  aria-invalid={!!err}
                  aria-describedby={err ? `${id}-${i}-err` : undefined}
                  onChange={(e) => onChange(items.map((t, j) => (j === i ? e.target.value : t)))}
                />
                <div className="flex justify-end">
                  <Counter value={text.length} max={maxLen} />
                </div>
              </div>
              <RowButtons noun={noun} index={i} count={items.length} onMove={(to) => onChange(moved(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
            </div>
            <FieldError id={`${id}-${i}-err`} message={err} />
          </div>
        )
      })}
      <FieldError id={`${id}-err`} message={errors[errorKey]} />
      <Button type="button" variant="outline" size="sm" disabled={items.length >= max} onClick={() => onChange([...items, ''])}>
        <Plus />
        Add a line
      </Button>
      {items.length >= max ? <p className="text-muted-foreground text-xs">That is the most this section can hold ({max}).</p> : null}
    </div>
  )
}

/** Question / answer pairs: max 8, counters, move up/down. Rows missing either side are flagged and dropped on save. */
export function FaqEditor({
  items,
  errors,
  warnings,
  onChange,
}: {
  items: FaqRow[]
  errors: Record<string, string>
  warnings: Record<string, string>
  onChange: (next: FaqRow[]) => void
}) {
  const L = PAGE_LIMITS.faqs
  return (
    <div className="space-y-3">
      {items.length === 0 ? <p className="text-muted-foreground text-sm">No questions yet. This section stays off the page until you add one.</p> : null}
      {items.map((f, i) => {
        const qErr = errors[`faqs.${i}.question`]
        const aErr = errors[`faqs.${i}.answer`]
        const warn = warnings[`faqs.${i}`]
        return (
          <div key={i} className="space-y-2 rounded-md border p-3" data-testid="faq-row">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">Question {i + 1}</span>
              <RowButtons noun="question" index={i} count={items.length} onMove={(to) => onChange(moved(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
            </div>
            <div className="space-y-1">
              <Input
                value={f.question}
                maxLength={L.question}
                placeholder="A question parents often ask"
                aria-label={`Question ${i + 1}`}
                aria-invalid={!!qErr}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
              />
              <div className="flex items-start justify-between gap-2">
                <FieldError id={`faq-${i}-q-err`} message={qErr} />
                <span className="ml-auto">
                  <Counter value={f.question.length} max={L.question} />
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Textarea
                rows={3}
                value={f.answer}
                maxLength={L.answer}
                placeholder="The answer"
                aria-label={`Answer ${i + 1}`}
                aria-invalid={!!aErr}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
              />
              <div className="flex items-start justify-between gap-2">
                <FieldError id={`faq-${i}-a-err`} message={aErr} />
                <span className="ml-auto">
                  <Counter value={f.answer.length} max={L.answer} />
                </span>
              </div>
            </div>
            {warn ? (
              <p className="text-sm text-amber-700" role="status" data-testid="faq-warning">
                {warn}
              </p>
            ) : null}
          </div>
        )
      })}
      <FieldError id="faqs-err" message={errors.faqs} />
      <Button type="button" variant="outline" size="sm" disabled={items.length >= L.items} onClick={() => onChange([...items, { question: '', answer: '' }])}>
        <Plus />
        Add a question
      </Button>
      {items.length >= L.items ? <p className="text-muted-foreground text-xs">That is the most this section can hold ({L.items}).</p> : null}
    </div>
  )
}

/** A radio card: a native radio (keyboard and screen reader behaviour for free) wrapped in a bordered label. */
export function ChoiceCard({ name, value, checked, onSelect, label, children }: { name: string; value: string; checked: boolean; onSelect: () => void; label: string; children: ReactNode }) {
  return (
    <label className="has-checked:border-foreground has-checked:ring-foreground has-focus-visible:ring-ring relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors has-checked:ring-1 has-focus-visible:ring-3 hover:bg-muted/40">
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

/** A small single-choice control (native radios, so arrow keys and screen readers work), e.g. Top / Center / Bottom. */
export function Segmented<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (next: T) => void
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className="has-checked:bg-background has-checked:text-foreground text-muted-foreground has-focus-visible:ring-ring cursor-pointer rounded-md px-3 py-1 text-sm font-medium has-checked:shadow-sm has-focus-visible:ring-2"
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Up to 3 label/value pairs shown after the built-in facts. Half-filled pairs are flagged and dropped on save. */
export function CustomFactsEditor({
  items,
  errors,
  warnings,
  onChange,
}: {
  items: { label: string; value: string }[]
  errors: Record<string, string>
  warnings: Record<string, string>
  onChange: (next: { label: string; value: string }[]) => void
}) {
  const L = PAGE_LIMITS.customFacts
  return (
    <div className="space-y-2">
      {items.map((f, i) => {
        const k = `options.custom_facts.${i}`
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-start gap-2">
              <Input
                aria-label={`Custom fact ${i + 1} label`}
                placeholder="Label, e.g. Level"
                value={f.label}
                maxLength={L.label}
                aria-invalid={!!errors[`${k}.label`]}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <Input
                aria-label={`Custom fact ${i + 1} value`}
                placeholder="Value, e.g. Beginner"
                value={f.value}
                maxLength={L.value}
                aria-invalid={!!errors[`${k}.value`]}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove custom fact ${i + 1}`}>
                <Trash2 />
              </Button>
            </div>
            <FieldError id={`${k}-err`} message={errors[`${k}.label`] ?? errors[`${k}.value`]} />
            {warnings[k] ? (
              <p className="text-sm text-amber-700" role="status">
                {warnings[k]}
              </p>
            ) : null}
          </div>
        )
      })}
      <Button type="button" variant="outline" size="sm" disabled={items.length >= L.items} onClick={() => onChange([...items, { label: '', value: '' }])}>
        <Plus />
        Add a custom fact
      </Button>
      {items.length >= L.items ? <p className="text-muted-foreground text-xs">That is the most you can add ({L.items}).</p> : null}
    </div>
  )
}

const SOURCE_OPTION_LABELS: Record<TestimonialSource, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  website: 'Website',
}

/**
 * Up to 6 reviews: quote (with counter), name, relation, optional photo link, optional Source (an
 * icon shown on the card, no text) and an optional link to the real post. Pasting a link while
 * Source is None picks the platform from its hostname (changeable); clearing a Source that has a link
 * asks first. Move up/down and delete per review. The live preview shows the exact card.
 */
export function TestimonialEditor({
  items,
  errors,
  warnings,
  onChange,
}: {
  items: TestimonialForm[]
  errors: Record<string, string>
  warnings: Record<string, string>
  onChange: (next: TestimonialForm[]) => void
}) {
  const T = PAGE_LIMITS.testimonials
  const [confirmClear, setConfirmClear] = useState<number | null>(null)
  const update = (i: number, patch: Partial<TestimonialForm>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  /** Picks the platform from a link when none is chosen yet. */
  const autoDetect = (i: number, link: string) => {
    if (items[i].source) return
    const found = detectSource(link)
    if (found) update(i, { post_url: link, source: found })
  }
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm" data-testid="review-guidance">
        Only add real feedback you have permission to share. Use a first name and initial. Never add a child&apos;s name or photo.
      </p>
      {items.length === 0 ? <p className="text-muted-foreground text-sm">No reviews yet. This section stays off the page until you add one.</p> : null}
      {items.map((t, i) => {
        const k = `testimonials.${i}`
        return (
          <div key={i} className="space-y-2 rounded-md border p-3" data-testid="review-row">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">Review {i + 1}</span>
              <RowButtons noun="review" index={i} count={items.length} onMove={(to) => onChange(moved(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
            </div>
            <div className="space-y-1">
              <Textarea
                rows={3}
                aria-label={`Review ${i + 1} text`}
                placeholder="What the parent said"
                value={t.quote}
                maxLength={T.quoteMax}
                aria-invalid={!!errors[`${k}.quote`]}
                onChange={(e) => update(i, { quote: e.target.value })}
              />
              <div className="flex items-start justify-between gap-2">
                <FieldError id={`${k}-quote-err`} message={errors[`${k}.quote`]} />
                <span className="ml-auto">
                  <Counter value={t.quote.length} max={T.quoteMax} />
                </span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Input aria-label={`Review ${i + 1} name`} placeholder="Name, e.g. Priya S." value={t.name} maxLength={T.name} aria-invalid={!!errors[`${k}.name`]} onChange={(e) => update(i, { name: e.target.value })} />
                <FieldError id={`${k}-name-err`} message={errors[`${k}.name`]} />
              </div>
              <Input aria-label={`Review ${i + 1} relation`} placeholder="e.g. Parent of a 6 year old" value={t.relation} maxLength={T.relation} onChange={(e) => update(i, { relation: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Input
                type="url"
                aria-label={`Review ${i + 1} photo link`}
                placeholder="Photo link (optional, https://)"
                value={t.photo_url}
                aria-invalid={!!errors[`${k}.photo_url`]}
                onChange={(e) => update(i, { photo_url: e.target.value })}
              />
              <FieldError id={`${k}-photo-err`} message={errors[`${k}.photo_url`]} />
              <p className="text-muted-foreground text-xs">Leave empty to show no photo. Adult photos only.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <div className="space-y-1">
                <Select
                  value={t.source || 'none'}
                  onValueChange={(v) => {
                    if (v !== 'none') update(i, { source: v as TestimonialSource })
                    else if (t.post_url.trim()) setConfirmClear(i)
                    else update(i, { source: '', post_url: '' })
                  }}
                >
                  <SelectTrigger className="w-full" aria-label={`Review ${i + 1} source`} aria-invalid={!!errors[`${k}.source`]}>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Source: none</SelectItem>
                    {TESTIMONIAL_SOURCES.map((src) => (
                      <SelectItem key={src} value={src}>
                        <span className="flex items-center gap-2">
                          <SourceGlyph source={src} size={16} />
                          {SOURCE_OPTION_LABELS[src]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id={`${k}-source-err`} message={errors[`${k}.source`]} />
              </div>
              <div className="space-y-1">
                <Input
                  type="url"
                  aria-label={`Review ${i + 1} link to the original post`}
                  placeholder="Link to the original post (optional, https://)"
                  value={t.post_url}
                  aria-invalid={!!errors[`${k}.post_url`]}
                  onChange={(e) => update(i, { post_url: e.target.value })}
                  onPaste={(e) => autoDetect(i, e.clipboardData.getData('text').trim())}
                  onBlur={(e) => autoDetect(i, e.target.value)}
                />
                <FieldError id={`${k}-post-err`} message={errors[`${k}.post_url`]} />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Add the link to the original public post if there is one. Only link to posts you have permission to share. The source shows as a small icon on the card.
            </p>
            {warnings[k] ? (
              <p className="text-sm text-amber-700" role="status">
                {warnings[k]}
              </p>
            ) : null}
          </div>
        )
      })}
      <FieldError id="testimonials-err" message={errors.testimonials} />
      <Button type="button" variant="outline" size="sm" disabled={items.length >= T.items} onClick={() => onChange([...items, blankTestimonial()])}>
        <Plus />
        Add a review
      </Button>
      {items.length >= T.items ? <p className="text-muted-foreground text-xs">That is the most this section can hold ({T.items}).</p> : null}

      <AlertDialog open={confirmClear !== null} onOpenChange={(o) => !o && setConfirmClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the source and its link?</AlertDialogTitle>
            <AlertDialogDescription>This review has a link to the original post. Removing the source removes the link too.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmClear !== null) update(confirmClear, { source: '', post_url: '' })
                setConfirmClear(null)
              }}
            >
              Remove both
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
