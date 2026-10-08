/**
 * The admin "Course page" editor's form logic, kept pure so scripts/check-course-page.mjs can
 * check it: mapping a course row to editable values, cleaning the values into exactly the page
 * columns, validating them against the shared limits (`PAGE_LIMITS` and the zod schemas in
 * coursePageSchema.ts, which mirror the database's CHECKs), and building the course object the
 * live preview feeds `buildCoursePageModel`.
 *
 * The layout, options and testimonials are edited in the normalized shape
 * (`normalizePageConfig`), with blanks as '' so inputs stay controlled; `toPageRow` turns blanks
 * back into ABSENT keys (the database rejects a JSON null where a string is expected), drops
 * blank list rows and half-filled rows, and always writes `page_hidden_sections: []` so
 * `page_layout` is the one source of truth once the v3 editor has saved.
 */
import { isHttpsUrl } from './externalLink.ts'
import {
  DEFAULT_OPTIONS,
  FACT_KEYS,
  PAGE_FONTS,
  PAGE_LIMITS,
  PAGE_THEMES,
  entryId,
  normalizePageConfig,
  type CoursePageCourse,
  type NormCustom,
  type NormEntry,
  type NormOptions,
  type PageFont,
  type PageTheme,
} from './coursePage.ts'
import { pageConfigSchema, type CustomType, type LayoutEntryRow, type PageOptionsRow, type TestimonialRow } from './coursePageSchema.ts'
import type { TestimonialSource } from './coursePageLimits.ts'

export interface FaqRow {
  question: string
  answer: string
}

export interface TestimonialForm {
  quote: string
  name: string
  relation: string
  photo_url: string
  /** '' = no source icon. */
  source: TestimonialSource | ''
  /** Link to the real post; only meaningful (and only saved) with a source. */
  post_url: string
}

/** A blank review row. */
export const blankTestimonial = (): TestimonialForm => ({ quote: '', name: '', relation: '', photo_url: '', source: '', post_url: '' })

const SOURCE_HOSTS: [TestimonialSource, string[]][] = [
  ['instagram', ['instagram.com']],
  ['facebook', ['facebook.com', 'fb.com']],
  ['youtube', ['youtube.com', 'youtu.be']],
  ['x', ['x.com', 'twitter.com']],
  ['linkedin', ['linkedin.com']],
  ['google', ['google.com', 'g.page', 'maps.app.goo.gl']],
]

/** The platform a pasted https link belongs to, by hostname (subdomains included); any other host is "website"; not a valid https link: null. */
export function detectSource(url: string): TestimonialSource | null {
  const u = url.trim()
  if (!isHttpsUrl(u)) return null
  let host: string
  try {
    host = new URL(u).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  for (const [source, domains] of SOURCE_HOSTS) if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return source
  return 'website'
}

export interface PageFormValues {
  tagline: string
  /** The course thumbnail, shared with the Basics tab (one column, not a copy). */
  thumbnail_url: string
  age_min: string
  age_max: string
  language: string
  learning_outcomes: string[]
  requirements: string[]
  faqs: FaqRow[]
  instructor_name: string
  instructor_role: string
  instructor_bio: string
  instructor_photo_url: string
  page_theme: PageTheme
  page_font: PageFont
  layout: NormEntry[]
  options: NormOptions
  testimonials: TestimonialForm[]
}

/** The columns the editor writes — and the ONLY ones its Save touches. */
export interface PageRow {
  tagline: string | null
  thumbnail_url: string | null
  age_min: number | null
  age_max: number | null
  language: string | null
  learning_outcomes: string[]
  requirements: string[]
  faqs: FaqRow[]
  instructor_name: string | null
  instructor_role: string | null
  instructor_bio: string | null
  instructor_photo_url: string | null
  page_theme: PageTheme
  page_font: PageFont
  page_hidden_sections: string[]
  page_layout: LayoutEntryRow[]
  page_options: PageOptionsRow
  testimonials: TestimonialRow[]
}

/** Every page column the editor writes (scripts/check-course-page.mjs checks a save touches only these). */
export const PAGE_COLUMNS: (keyof PageRow)[] = [
  'tagline', 'thumbnail_url', 'age_min', 'age_max', 'language', 'learning_outcomes', 'requirements', 'faqs',
  'instructor_name', 'instructor_role', 'instructor_bio', 'instructor_photo_url', 'page_theme', 'page_font',
  'page_hidden_sections', 'page_layout', 'page_options', 'testimonials',
]

type CourseRowLike = Omit<CoursePageCourse, 'title'>

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export function toPageFormValues(c: CourseRowLike): PageFormValues {
  const faqs: FaqRow[] = []
  if (Array.isArray(c.faqs)) {
    for (const f of c.faqs) {
      if (f && typeof f === 'object') {
        const o = f as Record<string, unknown>
        faqs.push({ question: typeof o.question === 'string' ? o.question : '', answer: typeof o.answer === 'string' ? o.answer : '' })
      }
    }
  }
  const config = normalizePageConfig(c)
  return {
    tagline: c.tagline ?? '',
    thumbnail_url: c.thumbnail_url ?? '',
    age_min: c.age_min == null ? '' : String(c.age_min),
    age_max: c.age_max == null ? '' : String(c.age_max),
    language: c.language ?? '',
    learning_outcomes: strings(c.learning_outcomes),
    requirements: strings(c.requirements),
    faqs,
    instructor_name: c.instructor_name ?? '',
    instructor_role: c.instructor_role ?? '',
    instructor_bio: c.instructor_bio ?? '',
    instructor_photo_url: c.instructor_photo_url ?? '',
    page_theme: (PAGE_THEMES as readonly string[]).includes(c.page_theme ?? '') ? (c.page_theme as PageTheme) : 'teal',
    page_font: (PAGE_FONTS as readonly string[]).includes(c.page_font ?? '') ? (c.page_font as PageFont) : 'inter',
    layout: config.layout,
    options: config.options,
    testimonials: config.testimonials.map((t) => ({ quote: t.quote, name: t.name, relation: t.relation, photo_url: t.photo_url, source: t.source, post_url: t.post_url })),
  }
}

/** A new custom block with a fresh id (8 to 36 of [a-z0-9-]: a UUID fits). */
export function newCustomEntry(type: CustomType): NormCustom {
  const id = globalThis.crypto.randomUUID()
  if (type === 'text') return { key: 'custom', id, type, visible: true, title: '', body: '' }
  if (type === 'list') return { key: 'custom', id, type, visible: true, title: '', items: [''], list_style: 'bullet' }
  return { key: 'custom', id, type, visible: true, title: '', image_url: '', alt: '', caption: '' }
}

const orNull = (s: string) => s.trim() || null
const nonBlank = (items: string[]) => items.map((s) => s.trim()).filter((s) => s !== '')
/** `{key: trimmed}` when non-blank, else nothing, for spreading into a jsonb object. */
const opt = <K extends string>(key: K, s: string): Partial<Record<K, string>> => (s.trim() ? ({ [key]: s.trim() } as Record<K, string>) : {})

function parseAge(s: string): number | null | 'invalid' {
  const t = s.trim()
  if (t === '') return null
  if (!/^\d{1,2}$/.test(t)) return 'invalid'
  const n = Number(t)
  return n >= PAGE_LIMITS.ageMin && n <= PAGE_LIMITS.ageMax ? n : 'invalid'
}

function layoutRow(e: NormEntry): LayoutEntryRow {
  if (e.key !== 'custom') {
    // "How it works" edits its intro through page_options.how_intro, so the layout entry carries none.
    return { key: e.key, visible: e.visible, ...opt('title', e.title), ...(e.key === 'how' ? {} : opt('intro', e.intro)) }
  }
  const base = { key: 'custom' as const, id: e.id, visible: e.visible, title: e.title.trim() }
  if (e.type === 'text') return { ...base, type: 'text', ...opt('body', e.body) }
  if (e.type === 'list') return { ...base, type: 'list', items: nonBlank(e.items), list_style: e.list_style }
  return { ...base, type: 'image', image_url: e.image_url.trim(), alt: e.alt.trim(), ...opt('caption', e.caption) }
}

function optionsRow(o: NormOptions): PageOptionsRow {
  const d = DEFAULT_OPTIONS
  const row: PageOptionsRow = {}
  if (o.cover.show !== d.cover.show || o.cover.focus !== d.cover.focus) row.cover = { show: o.cover.show, focus: o.cover.focus }
  Object.assign(row, opt('cta_label', o.cta_label), opt('price_note', o.price_note), opt('how_intro', o.how_intro))
  const included = nonBlank(o.included)
  if (included.length) row.included = included
  const hidden = FACT_KEYS.filter((k) => o.hidden_facts.includes(k))
  if (hidden.length) row.hidden_facts = hidden
  const facts = o.custom_facts.map((f) => ({ label: f.label.trim(), value: f.value.trim() })).filter((f) => f.label && f.value)
  if (facts.length) row.custom_facts = facts
  const how = nonBlank(o.how_items)
  if (how.length) row.how_items = how
  const ol = o.outline
  if (ol.open !== d.outline.open || ol.detail !== d.outline.detail || ol.show_minutes !== d.outline.show_minutes) row.outline = { ...ol }
  return row
}

function testimonialRows(items: TestimonialForm[]): TestimonialRow[] {
  return items
    .filter((t) => t.quote.trim() && t.name.trim())
    .map((t) => ({
      quote: t.quote.trim(),
      name: t.name.trim(),
      ...opt('relation', t.relation),
      ...opt('photo_url', t.photo_url),
      ...(t.source ? { source: t.source, ...opt('post_url', t.post_url) } : {}),
    }))
}

/** Trims, turns blanks into NULL or absent keys, drops blank and half-filled rows. Assumes valid values. */
export function toPageRow(v: PageFormValues): PageRow {
  const ageMin = parseAge(v.age_min)
  const ageMax = parseAge(v.age_max)
  return {
    tagline: orNull(v.tagline),
    thumbnail_url: orNull(v.thumbnail_url),
    age_min: ageMin === 'invalid' ? null : ageMin,
    age_max: ageMax === 'invalid' ? null : ageMax,
    language: orNull(v.language),
    learning_outcomes: nonBlank(v.learning_outcomes),
    requirements: nonBlank(v.requirements),
    faqs: v.faqs.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question && f.answer),
    instructor_name: orNull(v.instructor_name),
    instructor_role: orNull(v.instructor_role),
    instructor_bio: orNull(v.instructor_bio),
    instructor_photo_url: orNull(v.instructor_photo_url),
    page_theme: v.page_theme,
    page_font: v.page_font,
    page_hidden_sections: [],
    page_layout: v.layout.map(layoutRow),
    page_options: optionsRow(v.options),
    testimonials: testimonialRows(v.testimonials),
  }
}

interface PageValidation {
  /** Block the save. Keys: a field name, `list.index`, `faqs.i.question`, `layout.<id>.<field>`, `testimonials.i.<field>`, ... */
  errors: Record<string, string>
  /** Do not block: the row is simply dropped on save. */
  warnings: Record<string, string>
}

const URL_MESSAGE = `Must be a link starting with https://, no spaces, ${PAGE_LIMITS.url} characters or fewer.`

export function validatePageValues(v: PageFormValues): PageValidation {
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  const L = PAGE_LIMITS
  const tooLong = (key: string, s: string, max: number, what: string) => {
    if (s.trim().length > max) errors[key] = `Keep ${what} to ${max} characters.`
  }
  const list = (key: string, items: string[], maxItems: number, maxLen: number, noun: string) => {
    if (nonBlank(items).length > maxItems) errors[key] = `Add at most ${maxItems} ${noun}.`
    items.forEach((s, i) => {
      if (s.trim().length > maxLen) errors[`${key}.${i}`] = `Keep each line to ${maxLen} characters.`
    })
  }
  const url = (key: string, s: string) => {
    if (s.trim() && !isHttpsUrl(s.trim())) errors[key] = URL_MESSAGE
  }

  tooLong('tagline', v.tagline, L.tagline, 'the tagline')
  url('thumbnail_url', v.thumbnail_url)
  const lo = parseAge(v.age_min)
  const hi = parseAge(v.age_max)
  if (lo === 'invalid') errors.age_min = `Enter a whole number from ${L.ageMin} to ${L.ageMax}, or leave it empty.`
  if (hi === 'invalid') errors.age_max = `Enter a whole number from ${L.ageMin} to ${L.ageMax}, or leave it empty.`
  if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) errors.age_max = 'The oldest age cannot be below the youngest age.'
  tooLong('language', v.language, L.language, 'the language')

  list('learning_outcomes', v.learning_outcomes, L.outcomes.items, L.outcomes.length, 'outcomes')
  list('requirements', v.requirements, L.requirements.items, L.requirements.length, 'items')

  tooLong('instructor_name', v.instructor_name, L.instructorName, 'the name')
  tooLong('instructor_role', v.instructor_role, L.instructorRole, 'the role')
  tooLong('instructor_bio', v.instructor_bio, L.instructorBio, 'the bio')
  url('instructor_photo_url', v.instructor_photo_url)

  const filled = v.faqs.map((f) => ({ q: f.question.trim(), a: f.answer.trim() }))
  if (filled.filter((f) => f.q && f.a).length > L.faqs.items) errors.faqs = `Add at most ${L.faqs.items} questions.`
  filled.forEach((f, i) => {
    if (f.q.length > L.faqs.question) errors[`faqs.${i}.question`] = `Keep the question to ${L.faqs.question} characters.`
    if (f.a.length > L.faqs.answer) errors[`faqs.${i}.answer`] = `Keep the answer to ${L.faqs.answer} characters.`
    if ((f.q && !f.a) || (!f.q && f.a)) warnings[`faqs.${i}`] = 'Add both a question and an answer. A row with only one is dropped when you save.'
  })

  // ---- options
  const o = v.options
  tooLong('options.cta_label', o.cta_label, L.ctaLabel, 'the button label')
  tooLong('options.price_note', o.price_note, L.priceNote, 'the price note')
  tooLong('options.how_intro', o.how_intro, L.howIntro, 'the intro')
  list('options.included', o.included, L.included.items, L.included.length, 'lines')
  list('options.how_items', o.how_items, L.howItems.items, L.howItems.length, 'rules')
  if (o.custom_facts.length > L.customFacts.items) errors['options.custom_facts'] = `Add at most ${L.customFacts.items} custom facts.`
  o.custom_facts.forEach((f, i) => {
    tooLong(`options.custom_facts.${i}.label`, f.label, L.customFacts.label, 'the label')
    tooLong(`options.custom_facts.${i}.value`, f.value, L.customFacts.value, 'the value')
    if (!!f.label.trim() !== !!f.value.trim()) warnings[`options.custom_facts.${i}`] = 'Add both a label and a value. A fact with only one is dropped when you save.'
  })

  // ---- layout
  if (v.layout.length > L.layout.entries) errors.layout = `A page can have at most ${L.layout.entries} sections.`
  if (v.layout.filter((e) => e.key === 'custom').length > L.layout.customs) errors.layout = `Add at most ${L.layout.customs} sections of your own.`
  for (const e of v.layout) {
    const k = `layout.${entryId(e)}`
    tooLong(`${k}.title`, e.title, L.layout.title, 'the title')
    if (e.key !== 'custom') {
      if (e.key !== 'how') tooLong(`${k}.intro`, e.intro, L.layout.intro, 'the intro')
      continue
    }
    if (!e.title.trim()) errors[`${k}.title`] = 'Add a title for this section.'
    if (e.type === 'text') tooLong(`${k}.body`, e.body, L.custom.body, 'the text')
    if (e.type === 'list') {
      list(`${k}.items`, e.items, L.custom.listItems, L.custom.listItem, 'lines')
      if (nonBlank(e.items).length === 0) errors[`${k}.items`] = 'Add at least one line.'
    }
    if (e.type === 'image') {
      if (!e.image_url.trim()) errors[`${k}.image_url`] = 'Add the image link.'
      else url(`${k}.image_url`, e.image_url)
      if (!e.alt.trim()) errors[`${k}.alt`] = 'Describe the image for people who cannot see it.'
      else tooLong(`${k}.alt`, e.alt, L.custom.alt, 'the description')
      tooLong(`${k}.caption`, e.caption, L.custom.caption, 'the caption')
    }
  }

  // ---- testimonials
  const T = L.testimonials
  if (v.testimonials.filter((t) => t.quote.trim() && t.name.trim()).length > T.items) errors.testimonials = `Add at most ${T.items} reviews.`
  v.testimonials.forEach((t, i) => {
    const k = `testimonials.${i}`
    const q = t.quote.trim()
    if (q && q.length < T.quoteMin) errors[`${k}.quote`] = `A review needs at least ${T.quoteMin} characters.`
    tooLong(`${k}.quote`, t.quote, T.quoteMax, 'the review')
    tooLong(`${k}.name`, t.name, T.name, 'the name')
    tooLong(`${k}.relation`, t.relation, T.relation, 'this')
    url(`${k}.photo_url`, t.photo_url)
    url(`${k}.post_url`, t.post_url)
    if (t.post_url.trim() && !t.source) errors[`${k}.source`] = 'Choose where the post was made.'
    if (!!q !== !!t.name.trim()) warnings[k] = 'Add both the review and a name. A review with only one is dropped when you save.'
  })

  // ---- the shared schema as the final gate (the same rules as the database)
  if (Object.keys(errors).length === 0) {
    const row = toPageRow(v)
    const r = pageConfigSchema.safeParse({ page_layout: row.page_layout, page_options: row.page_options, testimonials: row.testimonials })
    if (!r.success) errors._config = 'Something on this page is not valid yet. Check the highlighted sections.'
  }
  return { errors, warnings }
}

/** True when two form states would save the same thing (blank rows and whitespace do not count). */
export function samePage(a: PageFormValues, b: PageFormValues): boolean {
  return JSON.stringify(toPageRow(a)) === JSON.stringify(toPageRow(b)) && a.age_min.trim() === b.age_min.trim() && a.age_max.trim() === b.age_max.trim()
}

/** The course object the live preview builds its model from: saved basics + the UNSAVED page values. */
export function previewCourse(basics: CoursePageCourse, v: PageFormValues): CoursePageCourse {
  const row = toPageRow(v)
  const lo = parseAge(v.age_min)
  const hi = parseAge(v.age_max)
  return { ...basics, ...row, age_min: lo === 'invalid' ? null : lo, age_max: hi === 'invalid' ? null : hi }
}

/** Readable text for the database's own CHECK errors (the backstop behind this form's validation). */
const L = PAGE_LIMITS
const CONSTRAINT_MESSAGES: Record<string, string> = {
  courses_tagline_len_check: `The tagline is too long (${L.tagline} characters at most).`,
  courses_age_min_range_check: 'The youngest age must be a whole number from 1 to 18.',
  courses_age_max_range_check: 'The oldest age must be a whole number from 1 to 18.',
  courses_age_order_check: 'The oldest age cannot be below the youngest age.',
  courses_language_len_check: `The language is too long (${L.language} characters at most).`,
  courses_learning_outcomes_check: `What your child will learn: at most ${L.outcomes.items} lines, none blank, each ${L.outcomes.length} characters or fewer.`,
  courses_requirements_check: `What you'll need: at most ${L.requirements.items} lines, none blank, each ${L.requirements.length} characters or fewer.`,
  courses_faqs_check: `Questions: at most ${L.faqs.items}, each with a question (${L.faqs.question} characters at most) and an answer (${L.faqs.answer} at most).`,
  courses_instructor_name_len_check: 'The name is too long.',
  courses_instructor_role_len_check: 'The role is too long.',
  courses_instructor_bio_len_check: 'The bio is too long.',
  courses_instructor_photo_url_check: 'The photo link must start with https:// and contain no spaces.',
  courses_page_theme_check: 'That colour is not available.',
  courses_page_font_check: 'That font is not available.',
  courses_page_hidden_sections_check: 'One of the hidden sections is not recognised.',
  courses_page_layout_check: `Sections: at most ${L.layout.entries} sections and ${L.layout.customs} of your own, each with a title; lists need 1 to ${L.custom.listItems} lines; images need an https:// link and a description.`,
  courses_page_options_check: 'One of the page options (button label, price note, included list, facts, outline or rules) is not valid.',
  courses_testimonials_check: `Reviews: at most ${L.testimonials.items}, each ${L.testimonials.quoteMin} to ${L.testimonials.quoteMax} characters with a name; photo and post links must start with https://; a post link needs a source.`,
}

export function describePageWriteError(message: string): string {
  const m = /constraint "([^"]+)"/.exec(message)
  return (m && CONSTRAINT_MESSAGES[m[1]]) || message
}
