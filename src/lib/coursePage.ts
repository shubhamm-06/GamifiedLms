/**
 * The parent-facing course page's model: ONE pure function, `buildCoursePageModel`,
 * holds every show/hide rule, so the student page and the admin live preview can
 * never disagree. No React, no fetching, no clock — it only turns a course row, an
 * outline and the viewer's state into a plain object that contains ONLY what should
 * appear. A section or fact with no data is simply absent (never an empty heading,
 * a blank cell or an orphan divider); the view renders what is here and nothing else.
 *
 * Sections come out as an ORDERED list (`sections`): the order, visibility, titles and
 * custom blocks are the admin's (`page_layout`, migration 037), read through
 * `normalizePageConfig`, which never throws and drops anything invalid.
 *
 * Plain text throughout: nothing here produces or accepts HTML, and strings pass
 * through unmodified apart from trimming (layout, not truncation, handles length).
 * Pure TypeScript with NO zod (this file is in the student bundle): the validators below follow
 * the same rules as coursePageSchema.ts (admin only), and scripts/check-course-page.mjs checks that
 * they accept and reject exactly the same values. Runs under `node --experimental-strip-types`.
 */
import { isHttpsUrl } from './externalLink.ts'
import {
  BUILTIN_KEYS,
  COVER_FOCUS,
  CUSTOM_ID_RE,
  FACT_KEYS,
  LIST_STYLES,
  OUTLINE_DETAIL,
  OUTLINE_OPEN,
  PAGE_LIMITS,
  TESTIMONIAL_SOURCES,
  type BuiltinKey,
  type CoverFocus,
  type FactKey,
  type ListStyle,
  type OutlineDetail,
  type OutlineOpen,
  type TestimonialSource,
} from './coursePageLimits.ts'

export { PAGE_LIMITS, BUILTIN_KEYS, FACT_KEYS }
export type { BuiltinKey, FactKey }

export const PAGE_THEMES = ['teal', 'plum', 'coral', 'ink'] as const
export type PageTheme = (typeof PAGE_THEMES)[number]
export const PAGE_FONTS = ['inter', 'classic', 'friendly'] as const
export type PageFont = (typeof PAGE_FONTS)[number]

/** The default order of the built-in sections (also the order missing ones are appended in). */
const DEFAULT_ORDER: readonly BuiltinKey[] = BUILTIN_KEYS

export const SECTION_LABELS: Record<BuiltinKey, string> = {
  about: 'About this course',
  learn: 'What your child will learn',
  inside: "What's inside",
  how: 'How it works',
  need: "What you'll need",
  reviews: 'What parents say',
  made_by: 'Made by',
  faq: 'Questions parents ask',
}

export const FACT_LABELS: Record<FactKey, string> = { ages: 'Ages', lessons: 'Lessons', time: 'Total time', access: 'Access', language: 'Language' }

// ------------------------------------------------------------------- input

export interface CoursePageCourse {
  title: string
  tagline?: string | null
  thumbnail_url?: string | null
  description?: string | null
  is_free?: boolean | null
  price_amount?: number | null
  currency?: string | null
  access_type?: string | null
  access_duration_days?: number | null
  gamification_enabled?: boolean | null
  enroll_url?: string | null
  age_min?: number | null
  age_max?: number | null
  language?: string | null
  learning_outcomes?: unknown
  requirements?: unknown
  faqs?: unknown
  instructor_name?: string | null
  instructor_role?: string | null
  instructor_bio?: string | null
  instructor_photo_url?: string | null
  page_theme?: string | null
  page_font?: string | null
  page_hidden_sections?: unknown
  page_layout?: unknown
  page_options?: unknown
  testimonials?: unknown
}

interface OutlineLesson {
  id: string
  title: string
  type: string
  position: number
  minutes: number | null
  is_preview: boolean
}

export interface OutlineModule {
  id: string | null
  title: string
  position: number
  lessons: OutlineLesson[]
}

/**
 * Who is looking. `new`: signed in, never enrolled here. `anon`: signed out (the public page).
 * `enrolled`: an active enrollment. `revoked` / `expired`: access that ended (only the FREE-course
 * flow reads `revoked`: a paid course keeps its "Enroll now" for everyone who is not enrolled).
 */
export type Viewer = { kind: 'new' } | { kind: 'anon' } | { kind: 'enrolled' } | { kind: 'revoked' } | { kind: 'expired'; endedAt: string | null }

interface CoursePageInput {
  course: CoursePageCourse
  outline?: OutlineModule[] | null
  viewer?: Viewer
  /** The platform support address (app_settings.support_email). Absent or blank: no support line. */
  supportEmail?: string | null
  /** Reserved so callers stay deterministic; no rule currently depends on the clock. */
  now?: Date
}

// ------------------------------------------------------- normalized config
// Blank optional strings are '' here (not absent), so the admin editor can use this
// exact shape as its form state. coursePageForm.ts turns it back into database rows.

interface NormBuiltin {
  key: BuiltinKey
  visible: boolean
  title: string
  intro: string
}
export type NormCustom =
  | { key: 'custom'; id: string; type: 'text'; visible: boolean; title: string; body: string }
  | { key: 'custom'; id: string; type: 'list'; visible: boolean; title: string; items: string[]; list_style: ListStyle }
  | { key: 'custom'; id: string; type: 'image'; visible: boolean; title: string; image_url: string; alt: string; caption: string }
export type NormEntry = NormBuiltin | NormCustom

export interface NormOptions {
  cover: { show: boolean; focus: CoverFocus }
  cta_label: string
  price_note: string
  included: string[]
  hidden_facts: FactKey[]
  custom_facts: { label: string; value: string }[]
  how_items: string[]
  how_intro: string
  outline: { open: OutlineOpen; detail: OutlineDetail; show_minutes: boolean }
}

interface NormTestimonial {
  quote: string
  name: string
  relation: string
  photo_url: string
  /** '' = no source icon. */
  source: TestimonialSource | ''
  /** '' = the icon is not a link. Only ever set together with a source. */
  post_url: string
}

interface PageConfig {
  layout: NormEntry[]
  options: NormOptions
  testimonials: NormTestimonial[]
  /** True when `page_layout` was empty (or held nothing valid): the default order plus legacy `page_hidden_sections`. */
  legacy: boolean
}

export const DEFAULT_OPTIONS: NormOptions = {
  cover: { show: true, focus: 'center' },
  cta_label: '',
  price_note: '',
  included: [],
  hidden_facts: [],
  custom_facts: [],
  how_items: [],
  how_intro: '',
  outline: { open: 'first', detail: 'lessons', show_minutes: true },
}

/** The entry id the editor and the status chips use: the built-in key, or the custom block's id. */
export const entryId = (e: NormEntry): string => (e.key === 'custom' ? e.id : e.key)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const only = (o: Record<string, unknown>, keys: readonly string[]) => Object.keys(o).every((k) => keys.includes(k))
/** A string whose trimmed length is >= min and raw length <= max (the database rule). */
const isText = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.length <= max && v.trim().length >= min
const optText = (o: Record<string, unknown>, k: string, max: number) => !(k in o) || isText(o[k], 0, max)
const isTextList = (v: unknown, min: number, maxItems: number, maxLen: number): v is string[] =>
  Array.isArray(v) && v.length >= min && v.length <= maxItems && v.every((x) => isText(x, 1, maxLen))
const isUrl = (v: unknown): v is string => typeof v === 'string' && isHttpsUrl(v)
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
const LIM = PAGE_LIMITS

/** One `page_layout` entry, by the same rules as `layoutEntrySchema` (coursePageSchema.ts) and the DB CHECK. */
function isValidLayoutEntry(e: unknown): boolean {
  if (!isObj(e) || typeof e.visible !== 'boolean') return false
  if (oneOf(BUILTIN_KEYS, e.key)) return only(e, ['key', 'visible', 'title', 'intro']) && optText(e, 'title', LIM.layout.title) && optText(e, 'intro', LIM.layout.intro)
  if (e.key !== 'custom' || typeof e.id !== 'string' || !CUSTOM_ID_RE.test(e.id) || !isText(e.title, 1, LIM.layout.title)) return false
  const base = ['key', 'id', 'type', 'visible', 'title']
  if (e.type === 'text') return only(e, [...base, 'body']) && optText(e, 'body', LIM.custom.body)
  if (e.type === 'list') return only(e, [...base, 'items', 'list_style']) && isTextList(e.items, 1, LIM.custom.listItems, LIM.custom.listItem) && oneOf(LIST_STYLES, e.list_style)
  if (e.type === 'image') return only(e, [...base, 'image_url', 'alt', 'caption']) && isUrl(e.image_url) && isText(e.alt, 1, LIM.custom.alt) && optText(e, 'caption', LIM.custom.caption)
  return false
}

/** One `page_options` value, by key (same rules as `pageOptionSchemas`). */
function isValidPageOption(key: string, v: unknown): boolean {
  switch (key) {
    case 'cover':
      return isObj(v) && only(v, ['show', 'focus']) && (!('show' in v) || typeof v.show === 'boolean') && (!('focus' in v) || oneOf(COVER_FOCUS, v.focus))
    case 'cta_label':
      return isText(v, 0, LIM.ctaLabel)
    case 'price_note':
      return isText(v, 0, LIM.priceNote)
    case 'how_intro':
      return isText(v, 0, LIM.howIntro)
    case 'included':
      return isTextList(v, 0, LIM.included.items, LIM.included.length)
    case 'how_items':
      return isTextList(v, 0, LIM.howItems.items, LIM.howItems.length)
    case 'hidden_facts':
      return Array.isArray(v) && v.every((x) => oneOf(FACT_KEYS, x)) && new Set(v).size === v.length
    case 'custom_facts':
      return (
        Array.isArray(v) &&
        v.length <= LIM.customFacts.items &&
        v.every((f) => isObj(f) && only(f, ['label', 'value']) && isText(f.label, 1, LIM.customFacts.label) && isText(f.value, 1, LIM.customFacts.value))
      )
    case 'outline':
      return (
        isObj(v) &&
        only(v, ['open', 'detail', 'show_minutes']) &&
        (!('open' in v) || oneOf(OUTLINE_OPEN, v.open)) &&
        (!('detail' in v) || oneOf(OUTLINE_DETAIL, v.detail)) &&
        (!('show_minutes' in v) || typeof v.show_minutes === 'boolean')
      )
    default:
      return false
  }
}

/** One testimonial (same rules as `testimonialSchema`). */
function isValidTestimonial(t: unknown): boolean {
  const T = LIM.testimonials
  return (
    isObj(t) &&
    only(t, ['quote', 'name', 'relation', 'photo_url', 'source', 'post_url']) &&
    isText(t.quote, T.quoteMin, T.quoteMax) &&
    isText(t.name, 1, T.name) &&
    optText(t, 'relation', T.relation) &&
    (!('photo_url' in t) || isUrl(t.photo_url)) &&
    (!('source' in t) || oneOf(TESTIMONIAL_SOURCES, t.source)) &&
    (!('post_url' in t) || (isUrl(t.post_url) && 'source' in t))
  )
}

function normalizeLayout(raw: unknown): NormEntry[] {
  if (!Array.isArray(raw)) return []
  const out: NormEntry[] = []
  const builtins = new Set<string>()
  const ids = new Set<string>()
  let customs = 0
  for (const item of raw) {
    if (out.length >= LIM.layout.entries) break
    if (!isValidLayoutEntry(item)) continue
    const e = item as Record<string, unknown>
    if (e.key !== 'custom') {
      const key = e.key as BuiltinKey
      if (builtins.has(key)) continue
      builtins.add(key)
      out.push({ key, visible: e.visible as boolean, title: (e.title as string | undefined) ?? '', intro: (e.intro as string | undefined) ?? '' })
      continue
    }
    const id = e.id as string
    if (customs >= LIM.layout.customs || ids.has(id)) continue
    ids.add(id)
    customs++
    const base = { key: 'custom' as const, id, visible: e.visible as boolean, title: e.title as string }
    if (e.type === 'text') out.push({ ...base, type: 'text', body: (e.body as string | undefined) ?? '' })
    else if (e.type === 'list') out.push({ ...base, type: 'list', items: e.items as string[], list_style: e.list_style as ListStyle })
    else out.push({ ...base, type: 'image', image_url: e.image_url as string, alt: e.alt as string, caption: (e.caption as string | undefined) ?? '' })
  }
  return out
}

function normalizeOptions(raw: unknown): NormOptions {
  const o = isObj(raw) ? raw : {}
  const ok = (k: string) => k in o && isValidPageOption(k, o[k])
  const d = DEFAULT_OPTIONS
  const cover = ok('cover') ? (o.cover as { show?: boolean; focus?: CoverFocus }) : {}
  const outline = ok('outline') ? (o.outline as { open?: OutlineOpen; detail?: OutlineDetail; show_minutes?: boolean }) : {}
  return {
    cover: { show: cover.show ?? d.cover.show, focus: cover.focus ?? d.cover.focus },
    cta_label: ok('cta_label') ? (o.cta_label as string) : '',
    price_note: ok('price_note') ? (o.price_note as string) : '',
    included: ok('included') ? (o.included as string[]) : [],
    hidden_facts: ok('hidden_facts') ? (o.hidden_facts as FactKey[]) : [],
    custom_facts: ok('custom_facts') ? (o.custom_facts as { label: string; value: string }[]) : [],
    how_items: ok('how_items') ? (o.how_items as string[]) : [],
    how_intro: ok('how_intro') ? (o.how_intro as string) : '',
    outline: { open: outline.open ?? d.outline.open, detail: outline.detail ?? d.outline.detail, show_minutes: outline.show_minutes ?? d.outline.show_minutes },
  }
}

function normalizeTestimonials(raw: unknown): NormTestimonial[] {
  if (!Array.isArray(raw)) return []
  const out: NormTestimonial[] = []
  for (const item of raw) {
    if (out.length >= LIM.testimonials.items) break
    if (!isObj(item)) continue
    // Lenient reading: legacy or unknown keys (e.g. the removed `rating`) are ignored, and a bad
    // source or link is dropped on its own (a quote never vanishes because of its link).
    const t: Record<string, unknown> = {}
    for (const k of ['quote', 'name', 'relation', 'photo_url'] as const) if (k in item) t[k] = item[k]
    if (oneOf(TESTIMONIAL_SOURCES, item.source)) {
      t.source = item.source
      if (isUrl(item.post_url)) t.post_url = item.post_url
    }
    if (!isValidTestimonial(t)) continue
    out.push({
      quote: t.quote as string,
      name: t.name as string,
      relation: (t.relation as string | undefined) ?? '',
      photo_url: (t.photo_url as string | undefined) ?? '',
      source: (t.source as TestimonialSource | undefined) ?? '',
      post_url: (t.post_url as string | undefined) ?? '',
    })
  }
  return out
}

/**
 * Reads the three migration-037 columns (and legacy `page_hidden_sections`) into one clean
 * config. Pure and total: anything invalid or unknown is dropped or replaced by its default.
 * - `page_layout` empty (or nothing valid in it): default order, `page_hidden_sections` applied;
 *   legacy "know" and "how" both map to the merged "how" section (hidden if either is listed).
 * - Otherwise the stored order; built-ins missing from it are appended in default order, visible;
 *   duplicates after the first and unknown keys are ignored.
 */
export function normalizePageConfig(row: Pick<CoursePageCourse, 'page_layout' | 'page_options' | 'testimonials' | 'page_hidden_sections'>): PageConfig {
  let layout = normalizeLayout(row.page_layout)
  const legacy = layout.length === 0
  if (legacy) {
    const hiddenRaw = Array.isArray(row.page_hidden_sections) ? row.page_hidden_sections : []
    const hidden = new Set(hiddenRaw.filter((k): k is string => typeof k === 'string'))
    if (hidden.has('know')) hidden.add('how')
    layout = DEFAULT_ORDER.map((key) => ({ key, visible: !hidden.has(key), title: '', intro: '' }))
  } else {
    const present = new Set(layout.map((e) => e.key))
    for (const key of DEFAULT_ORDER) if (!present.has(key)) layout.push({ key, visible: true, title: '', intro: '' })
  }
  return { layout, options: normalizeOptions(row.page_options), testimonials: normalizeTestimonials(row.testimonials), legacy }
}

// ------------------------------------------------------------------ output

export type LessonType = 'video' | 'text' | 'game' | 'quiz' | 'other'

/**
 * Icon keys the model hands the view (the view maps them to lucide icons in ONE file,
 * components/kid/coursePage/icons.ts), so no icon choice is hardcoded in the view.
 */
export type PageIconKey =
  | 'ages' | 'lessons' | 'time' | 'access' | 'no-expiry' | 'language' | 'custom-fact'
  | 'rule-order' | 'rule-time' | 'rule-retry' | 'rule-save' | 'rule-points'
  | 'incl-lessons' | 'incl-save' | 'incl-devices'

interface PageFact {
  key: FactKey | `custom-${number}`
  label: string
  value: string
  iconKey: PageIconKey
}

interface PageLesson {
  id: string
  title: string
  type: LessonType
  typeLabel: string
  /** "8 min", or null when unknown or minutes are switched off. */
  minutes: string | null
}

export interface PageModuleOut {
  key: string
  title: string
  meta: string
  /** "3 lessons, 19 min": the right-hand summary in the sections-only outline. */
  summary: string
  lessons: PageLesson[]
}

export interface PageTestimonial {
  quote: string
  name: string
  relation: string | null
  /** An https photo URL, or null: no photo element is rendered at all (never initials or a placeholder). */
  photoUrl: string | null
  /** Where it was posted: the card shows only an outline icon for it. */
  source: TestimonialSource | null
  /** The real post, https: the icon becomes a link. Only ever set together with a source. */
  postUrl: string | null
}

interface SectionBase {
  /** Built-in key or the custom block's id (unique on the page). */
  id: string
  title: string
  intro: string | null
}
export type PageSection = SectionBase &
  (
    | { kind: 'about'; paragraphs: string[] }
    | { kind: 'learn'; items: string[] }
    | { kind: 'inside'; modules: PageModuleOut[]; detail: OutlineDetail; open: OutlineOpen }
    | { kind: 'how'; items: string[]; /** One per item for the DEFAULT rules; null when the admin wrote the list (plain dots then). */ icons: PageIconKey[] | null }
    | { kind: 'need'; items: string[] }
    | { kind: 'reviews'; items: PageTestimonial[] }
    | { kind: 'made_by'; person: { name: string; role: string | null; bio: string | null; photoUrl: string | null; initials: string } }
    | { kind: 'faq'; items: { question: string; answer: string }[] }
    | { kind: 'text'; paragraphs: string[] }
    | { kind: 'list'; items: string[]; style: ListStyle }
    | { kind: 'image'; url: string; alt: string; caption: string | null }
  )

export type SectionStatus = 'showing' | 'hidden_by_you' | 'empty'

export interface CoursePageModel {
  theme: PageTheme
  font: PageFont
  title: string
  lead: string | null
  /** null: no cover at all (the admin hid it). Otherwise an https image or null url (the generated cover). */
  cover: { url: string | null; focus: CoverFocus } | null
  facts: PageFact[]
  /** Only the sections that render, in page order. */
  sections: PageSection[]
  /** The support line: under the FAQ when that shows, else on its own after the sections. */
  support: { email: string; inFaq: boolean } | null
  /** Per layout entry id (built-in key or custom id), for the editor's status chips, from the same rules. */
  sectionStatus: Record<string, SectionStatus>
  /** "What's included": the buy card list (wide) and, only when admin-written, the narrow section. Never repeats the access line. */
  included: string[]
  /** One icon per automatic item; null when the admin wrote the list (check icons then). */
  includedIcons: PageIconKey[] | null
  /** True when the admin wrote the included list. On narrow screens only an admin-written list is shown. */
  includedCustom: boolean
  price: { text: string | null; note: string | null; accessLine: string | null }
  enroll:
    | { state: 'open'; url: string; label: string; expiredNote: string | null }
    /**
     * A FREE course enrolls directly on the site (fn_enroll_free_course), the custom link is ignored.
     * enroll: a signed-in viewer enrolls; signup: a signed-out viewer goes to /signup; go: already enrolled.
     */
    | { state: 'free'; action: 'enroll' | 'signup' | 'go'; label: string }
    | { state: 'closed'; note: string }
}

// ------------------------------------------------------------------ helpers

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const orNull = (v: unknown): string | null => str(v) || null

function textList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(str).filter((s) => s !== '')
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

function formatAges(min: unknown, max: unknown): string | null {
  const lo = min == null ? null : min
  const hi = max == null ? null : max
  if (lo !== null && !(isInt(lo) && lo >= PAGE_LIMITS.ageMin && lo <= PAGE_LIMITS.ageMax)) return null
  if (hi !== null && !(isInt(hi) && hi >= PAGE_LIMITS.ageMin && hi <= PAGE_LIMITS.ageMax)) return null
  if (lo !== null && hi !== null) {
    if (lo > hi) return null
    return lo === hi ? `Age ${lo}` : `${lo} to ${hi}`
  }
  if (lo !== null) return `${lo} and up`
  if (hi !== null) return `Up to ${hi}`
  return null
}

/** Under an hour: "45 min". From an hour: rounded to 5 minutes, "1 hr", "1 hr 30 min", "2 hr 30 min". */
function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`
  const rounded = Math.round(totalMinutes / 5) * 5
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/** "30 days", "3 months", "12 months", "2 years" — month/year wording only on an exact multiple. */
function formatAccessLength(days: number): string {
  if (days % 365 === 0) {
    const years = days / 365
    return years === 1 ? '12 months' : `${years} years`
  }
  if (days % 30 === 0 && days >= 60) return `${days / 30} months`
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function accessInfo(course: CoursePageCourse): { fact: string; line: string } | null {
  if (course.access_type === 'lifetime') return { fact: 'No expiry', line: 'Access with no expiry' }
  if (course.access_type === 'fixed') {
    const d = course.access_duration_days
    if (!isInt(d) || d <= 0) return null
    const len = formatAccessLength(d)
    return { fact: len, line: `${len} of access` }
  }
  return null
}

function formatPrice(course: CoursePageCourse): string | null {
  if (course.is_free) return 'Free'
  const amount = course.price_amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null
  const currency = str(course.currency) || 'INR'
  try {
    // Whole rupees (rules.md: amounts are whole units, never paise), Indian digit grouping.
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${amount.toLocaleString('en-IN')} ${currency}`
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Hand-built (UTC) so the wording never depends on the engine's locale data. */
const formatDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`

function expiredNote(viewer: Viewer | undefined): string | null {
  if (!viewer || viewer.kind !== 'expired') return null
  const t = viewer.endedAt ? Date.parse(viewer.endedAt) : NaN
  return Number.isNaN(t) ? 'Your access has ended.' : `Your access ended on ${formatDate(new Date(t))}.`
}

function lessonType(t: unknown): LessonType {
  return t === 'video' || t === 'text' || t === 'game' || t === 'quiz' ? t : 'other'
}

const TYPE_LABEL: Record<LessonType, string> = { video: 'Video', text: 'Reading', game: 'Game', quiz: 'Quiz', other: 'Lesson' }
const TYPE_ORDER: Exclude<LessonType, 'other'>[] = ['video', 'text', 'game', 'quiz']
/** Words for "Lessons mix ..." and for the included list. */
const TYPE_PHRASE: Record<Exclude<LessonType, 'other'>, string> = { video: 'short videos', text: 'reading', game: 'games', quiz: 'quizzes' }
const TYPE_PLURAL: Record<Exclude<LessonType, 'other'>, string> = { video: 'videos', text: 'reading', game: 'games', quiz: 'quizzes' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "a", "a and b", "a, b and c". */
function joinList(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0]?.toUpperCase() ?? '')
    .join('')
}

function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
}

/** The default "How it works" rules (true by product decision); the points line only with gamification on. */
export function defaultHowItems(gamification: boolean): string[] {
  return defaultHowRules(gamification).map((r) => r.text)
}
function defaultHowRules(gamification: boolean): { text: string; icon: PageIconKey }[] {
  const rules: { text: string; icon: PageIconKey }[] = [
    { text: 'Lessons open one at a time, in order.', icon: 'rule-order' },
    { text: 'Each lesson has a minimum time before it counts as done.', icon: 'rule-time' },
    { text: 'Quizzes can be retried.', icon: 'rule-retry' },
    { text: 'Progress saves automatically.', icon: 'rule-save' },
  ]
  if (gamification) rules.push({ text: 'Your child earns points and badges as they learn.', icon: 'rule-points' })
  return rules
}

// -------------------------------------------------------------------- outline

/** Parses `fn_course_outline`'s jsonb defensively (anything malformed is dropped, never thrown). */
export function parseOutline(raw: unknown): OutlineModule[] {
  if (!Array.isArray(raw)) return []
  const out: OutlineModule[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const mod = m as Record<string, unknown>
    const lessons: OutlineLesson[] = []
    if (Array.isArray(mod.lessons)) {
      for (const l of mod.lessons) {
        if (!l || typeof l !== 'object') continue
        const les = l as Record<string, unknown>
        if (typeof les.id !== 'string' || typeof les.title !== 'string') continue
        lessons.push({
          id: les.id,
          title: les.title,
          type: typeof les.type === 'string' ? les.type : 'other',
          position: typeof les.position === 'number' ? les.position : 0,
          minutes: typeof les.minutes === 'number' && les.minutes > 0 ? les.minutes : null,
          is_preview: les.is_preview === true,
        })
      }
    }
    out.push({
      id: typeof mod.id === 'string' ? mod.id : null,
      title: typeof mod.title === 'string' ? mod.title : '',
      position: typeof mod.position === 'number' ? mod.position : 0,
      lessons,
    })
  }
  return out
}

// ---------------------------------------------------------------------- model

export function buildCoursePageModel(input: CoursePageInput): CoursePageModel {
  const { course, viewer } = input
  const outline = (input.outline ?? []).filter((m) => m.lessons.length > 0)
  const config = normalizePageConfig(course)
  const opts = config.options
  const showMinutes = opts.outline.show_minutes

  const theme = (PAGE_THEMES as readonly string[]).includes(course.page_theme ?? '') ? (course.page_theme as PageTheme) : 'teal'
  const font = (PAGE_FONTS as readonly string[]).includes(course.page_font ?? '') ? (course.page_font as PageFont) : 'inter'

  // ---- outline-derived numbers (the outline is the ONLY lesson source; courses.total_lessons counts drafts)
  const allLessons = outline.flatMap((m) => m.lessons)
  const lessonCount = allLessons.length
  const withMinutes = allLessons.filter((l) => l.minutes !== null && l.minutes > 0)
  const totalMinutes = withMinutes.reduce((sum, l) => sum + (l.minutes ?? 0), 0)
  const timeKnown = lessonCount > 0 && totalMinutes > 0 && withMinutes.length / lessonCount >= 0.8
  const typesPresent = TYPE_ORDER.filter((t) => allLessons.some((l) => lessonType(l.type) === t))

  const access = accessInfo(course)
  const language = orNull(course.language)
  const ages = formatAges(course.age_min, course.age_max)

  // ---- facts: built-ins minus the hidden ones, then custom facts, at most 6
  const hiddenFacts = new Set(opts.hidden_facts)
  const facts: PageFact[] = []
  const builtinFacts: [FactKey, string | null][] = [
    ['ages', ages],
    ['lessons', lessonCount > 0 ? String(lessonCount) : null],
    ['time', timeKnown ? formatDuration(totalMinutes) : null],
    ['access', access ? access.fact : null],
    ['language', language],
  ]
  const factIcon = (key: FactKey): PageIconKey => (key === 'access' && course.access_type === 'lifetime' ? 'no-expiry' : key)
  for (const [key, value] of builtinFacts) if (value && !hiddenFacts.has(key)) facts.push({ key, label: FACT_LABELS[key], value, iconKey: factIcon(key) })
  opts.custom_facts.forEach((f, i) => {
    const label = str(f.label)
    const value = str(f.value)
    if (label && value) facts.push({ key: `custom-${i}`, label, value, iconKey: 'custom-fact' })
  })
  facts.splice(PAGE_LIMITS.factsShown)

  // ---- built-in section content (before visibility)
  const modules: PageModuleOut[] = outline.map((m, i) => {
    const n = i + 1
    const known = m.lessons.filter((l) => l.minutes !== null && l.minutes > 0)
    const sum = known.reduce((s, l) => s + (l.minutes ?? 0), 0)
    const count = plural(m.lessons.length, 'lesson', 'lessons')
    const time = showMinutes && sum > 0 ? formatDuration(sum) : null
    return {
      key: m.id ?? `ungrouped-${n}`,
      title: str(m.title) || `Section ${n}`,
      meta: [`Section ${n}`, count, time].filter(Boolean).join(', '),
      summary: [count, time].filter(Boolean).join(', '),
      lessons: m.lessons.map((l) => {
        const type = lessonType(l.type)
        return { id: l.id, title: l.title, type, typeLabel: TYPE_LABEL[type], minutes: showMinutes && l.minutes !== null && l.minutes > 0 ? `${l.minutes} min` : null }
      }),
    }
  })
  let insideIntro: string | null = null
  if (modules.length > 0) {
    const parts = [plural(modules.length, 'section', 'sections'), plural(lessonCount, 'lesson', 'lessons')]
    if (showMinutes && timeKnown) parts.push(formatDuration(totalMinutes))
    insideIntro = parts.join(', ')
  }

  let howIntro: string | null = null
  if (typesPresent.length === 1) howIntro = `Lessons are ${TYPE_PHRASE[typesPresent[0]]}.`
  else if (typesPresent.length > 1) howIntro = `Lessons mix ${joinList(typesPresent.map((t) => TYPE_PHRASE[t]))}.`
  const customHow = textList(opts.how_items)
  const defaultRules = defaultHowRules(course.gamification_enabled === true)
  const howItems = customHow.length > 0 ? customHow : defaultRules.map((r) => r.text)
  const howIcons = customHow.length > 0 ? null : defaultRules.map((r) => r.icon)

  const instructorName = str(course.instructor_name)
  const photo = str(course.instructor_photo_url)
  const person = instructorName
    ? { name: instructorName, role: orNull(course.instructor_role), bio: orNull(course.instructor_bio), photoUrl: isHttpsUrl(photo) ? photo : null, initials: initialsOf(instructorName) }
    : null

  const faqItems: { question: string; answer: string }[] = []
  if (Array.isArray(course.faqs)) {
    for (const f of course.faqs) {
      if (!f || typeof f !== 'object') continue
      const q = str((f as Record<string, unknown>).question)
      const a = str((f as Record<string, unknown>).answer)
      if (q && a) faqItems.push({ question: q, answer: a })
    }
  }

  const reviews: PageTestimonial[] = config.testimonials
    .map((t) => ({
      quote: str(t.quote),
      name: str(t.name),
      relation: orNull(t.relation),
      photoUrl: isHttpsUrl(t.photo_url) ? t.photo_url : null,
      source: t.source || null,
      postUrl: t.source && isHttpsUrl(t.post_url) ? t.post_url : null,
    }))
    .filter((t) => t.quote && t.name)

  // ---- walk the layout: one section per entry that is visible AND has content
  const sections: PageSection[] = []
  const sectionStatus: Record<string, SectionStatus> = {}
  for (const entry of config.layout) {
    const id = entryId(entry)
    const title = str(entry.title) || (entry.key === 'custom' ? '' : SECTION_LABELS[entry.key])
    const ownIntro = entry.key === 'custom' ? null : orNull(entry.intro)
    let section: PageSection | null = null
    switch (entry.key) {
      case 'about': {
        const p = paragraphs(typeof course.description === 'string' ? course.description : '')
        if (p.length) section = { id, title, intro: ownIntro, kind: 'about', paragraphs: p }
        break
      }
      case 'learn': {
        const items = textList(course.learning_outcomes)
        if (items.length) section = { id, title, intro: ownIntro, kind: 'learn', items }
        break
      }
      case 'inside':
        if (modules.length) section = { id, title, intro: ownIntro ?? insideIntro, kind: 'inside', modules, detail: opts.outline.detail, open: opts.outline.open }
        break
      case 'how':
        section = { id, title, intro: ownIntro ?? orNull(opts.how_intro) ?? howIntro, kind: 'how', items: howItems, icons: howIcons }
        break
      case 'need': {
        const items = textList(course.requirements)
        if (items.length) section = { id, title, intro: ownIntro, kind: 'need', items }
        break
      }
      case 'reviews':
        if (reviews.length) section = { id, title, intro: ownIntro, kind: 'reviews', items: reviews }
        break
      case 'made_by':
        if (person) section = { id, title, intro: ownIntro, kind: 'made_by', person }
        break
      case 'faq':
        if (faqItems.length) section = { id, title, intro: ownIntro, kind: 'faq', items: faqItems }
        break
      case 'custom':
        if (!title) break
        if (entry.type === 'text') {
          const p = paragraphs(entry.body)
          if (p.length) section = { id, title, intro: null, kind: 'text', paragraphs: p }
        } else if (entry.type === 'list') {
          const items = textList(entry.items)
          if (items.length) section = { id, title, intro: null, kind: 'list', items, style: entry.list_style }
        } else {
          const url = str(entry.image_url)
          const alt = str(entry.alt)
          if (isHttpsUrl(url) && alt) section = { id, title, intro: null, kind: 'image', url, alt, caption: orNull(entry.caption) }
        }
        break
    }
    sectionStatus[id] = !entry.visible ? 'hidden_by_you' : section ? 'showing' : 'empty'
    if (entry.visible && section) sections.push(section)
  }

  const email = str(input.supportEmail)
  const supportEmail = /^[^\s@]+@[^\s@]+$/.test(email) ? email : null
  const faqShows = sections.some((s) => s.kind === 'faq')

  // ---- price / enroll / included
  const enrollUrl = str(course.enroll_url)
  const note = expiredNote(viewer)
  const ctaLabel = str(opts.cta_label) || 'Enroll now'
  const freeEnroll = (): CoursePageModel['enroll'] => {
    if (viewer?.kind === 'enrolled') return { state: 'free', action: 'go', label: 'Go to course' }
    if (viewer?.kind === 'revoked') return { state: 'closed', note: 'Your access to this course was ended. Please contact support.' }
    if (viewer?.kind === 'expired') return { state: 'closed', note: note ?? 'Your access has ended.' }
    return { state: 'free', action: viewer?.kind === 'anon' ? 'signup' : 'enroll', label: str(opts.cta_label) || 'Enroll for free' }
  }
  const enroll: CoursePageModel['enroll'] = course.is_free === true
    ? freeEnroll()
    : isHttpsUrl(enrollUrl)
    ? { state: 'open', url: enrollUrl, label: note ? 'Enroll again' : ctaLabel, expiredNote: note }
    : { state: 'closed', note: "Enrollment isn't open for this course yet." }

  let included = textList(opts.included)
  const includedCustom = included.length > 0
  let includedIcons: PageIconKey[] | null = null
  if (!includedCustom) {
    included = []
    includedIcons = []
    if (lessonCount > 0) {
      const kinds = typesPresent.map((t) => TYPE_PLURAL[t])
      included.push(kinds.length ? `${plural(lessonCount, 'lesson', 'lessons')} (${joinList(kinds)})` : plural(lessonCount, 'lesson', 'lessons'))
      includedIcons.push('incl-lessons')
    }
    included.push('Progress saved automatically', 'Works on phone, tablet and computer')
    includedIcons.push('incl-save', 'incl-devices')
  }

  const thumb = str(course.thumbnail_url)
  return {
    theme,
    font,
    title: str(course.title),
    lead: orNull(course.tagline),
    cover: opts.cover.show ? { url: isHttpsUrl(thumb) ? thumb : null, focus: opts.cover.focus } : null,
    facts,
    sections,
    support: supportEmail ? { email: supportEmail, inFaq: faqShows } : null,
    sectionStatus,
    included,
    includedIcons,
    includedCustom,
    price: { text: formatPrice(course), note: orNull(opts.price_note), accessLine: access ? access.line : null },
    enroll,
  }
}

export { COVER_FOCUS, OUTLINE_OPEN, OUTLINE_DETAIL }
