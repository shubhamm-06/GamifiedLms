/**
 * The ONE schema for the parent-facing course page's configuration columns (migration 037:
 * `page_layout`, `page_options`, `testimonials`) and every limit the page uses (migration 034
 * columns too). It mirrors the database's validator functions exactly; the admin editor
 * enforces these limits in its inputs and validation, and the page normalizer
 * (`normalizePageConfig` in coursePage.ts) uses the same schemas to drop anything invalid.
 * Change a limit here AND in a migration, never in one place only.
 *
 * ADMIN ONLY (zod must never reach the student bundle; the page normalizer in coursePage.ts is
 * zod-free and is checked against these schemas in scripts/check-course-page.mjs). Pure TypeScript plus zod, so scripts/check-course-page.mjs can import it with
 * `node --experimental-strip-types`. Optional fields are ABSENT, never null (the database
 * rejects a JSON null where it expects a string).
 */
import { z } from 'zod'
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
} from './coursePageLimits.ts'

export * from './coursePageLimits.ts'

// ------------------------------------------------------------------ pieces

/** A string whose trimmed length is at least `min` and whose raw length is at most `max` (the DB rule). */
const text = (min: number, max: number) => z.string().max(max).refine((s) => s.trim().length >= min)
const textList = (min: number, maxItems: number, maxLen: number) => z.array(text(1, maxLen)).min(min).max(maxItems)
const httpsUrl = z.string().refine(isHttpsUrl)

const L = PAGE_LIMITS

const builtinEntrySchema = z.strictObject({
  key: z.enum(BUILTIN_KEYS),
  visible: z.boolean(),
  title: text(0, L.layout.title).optional(),
  intro: text(0, L.layout.intro).optional(),
})

const customBase = {
  key: z.literal('custom'),
  id: z.string().regex(CUSTOM_ID_RE),
  visible: z.boolean(),
  title: text(1, L.layout.title),
}
const customTextSchema = z.strictObject({ ...customBase, type: z.literal('text'), body: text(0, L.custom.body).optional() })
const customListSchema = z.strictObject({
  ...customBase,
  type: z.literal('list'),
  items: textList(1, L.custom.listItems, L.custom.listItem),
  list_style: z.enum(LIST_STYLES),
})
const customImageSchema = z.strictObject({
  ...customBase,
  type: z.literal('image'),
  image_url: httpsUrl,
  alt: text(1, L.custom.alt),
  caption: text(0, L.custom.caption).optional(),
})
export const layoutEntrySchema = z.union([builtinEntrySchema, customTextSchema, customListSchema, customImageSchema])

const pageLayoutSchema = z
  .array(layoutEntrySchema)
  .max(L.layout.entries)
  .superRefine((entries, ctx) => {
    const builtins = new Set<string>()
    const ids = new Set<string>()
    let customs = 0
    for (const e of entries) {
      if (e.key === 'custom') {
        customs++
        if (ids.has(e.id)) ctx.addIssue({ code: 'custom', message: 'duplicate custom id' })
        ids.add(e.id)
      } else {
        if (builtins.has(e.key)) ctx.addIssue({ code: 'custom', message: 'duplicate section' })
        builtins.add(e.key)
      }
    }
    if (customs > L.layout.customs) ctx.addIssue({ code: 'custom', message: 'too many custom sections' })
  })

export const pageOptionSchemas = {
  cover: z.strictObject({ show: z.boolean().optional(), focus: z.enum(COVER_FOCUS).optional() }),
  cta_label: text(0, L.ctaLabel),
  price_note: text(0, L.priceNote),
  included: textList(0, L.included.items, L.included.length),
  hidden_facts: z.array(z.enum(FACT_KEYS)).refine((a) => new Set(a).size === a.length),
  custom_facts: z.array(z.strictObject({ label: text(1, L.customFacts.label), value: text(1, L.customFacts.value) })).max(L.customFacts.items),
  how_items: textList(0, L.howItems.items, L.howItems.length),
  how_intro: text(0, L.howIntro),
  outline: z.strictObject({
    open: z.enum(OUTLINE_OPEN).optional(),
    detail: z.enum(OUTLINE_DETAIL).optional(),
    show_minutes: z.boolean().optional(),
  }),
} as const
const pageOptionsSchema = z.strictObject({
  cover: pageOptionSchemas.cover.optional(),
  cta_label: pageOptionSchemas.cta_label.optional(),
  price_note: pageOptionSchemas.price_note.optional(),
  included: pageOptionSchemas.included.optional(),
  hidden_facts: pageOptionSchemas.hidden_facts.optional(),
  custom_facts: pageOptionSchemas.custom_facts.optional(),
  how_items: pageOptionSchemas.how_items.optional(),
  how_intro: pageOptionSchemas.how_intro.optional(),
  outline: pageOptionSchemas.outline.optional(),
})

export const testimonialSchema = z
  .strictObject({
    quote: text(L.testimonials.quoteMin, L.testimonials.quoteMax),
    name: text(1, L.testimonials.name),
    relation: text(0, L.testimonials.relation).optional(),
    photo_url: httpsUrl.optional(),
    source: z.enum(TESTIMONIAL_SOURCES).optional(),
    post_url: httpsUrl.optional(),
  })
  // A link to the original post only makes sense with a platform (the database enforces the same).
  .refine((t) => t.post_url === undefined || t.source !== undefined)
const testimonialsSchema = z.array(testimonialSchema).max(L.testimonials.items)

/** The three migration-037 columns together, exactly as the database accepts them. */
export const pageConfigSchema = z.object({
  page_layout: pageLayoutSchema,
  page_options: pageOptionsSchema,
  testimonials: testimonialsSchema,
})

export type LayoutEntryRow = z.infer<typeof layoutEntrySchema>
export type PageOptionsRow = z.infer<typeof pageOptionsSchema>
export type TestimonialRow = z.infer<typeof testimonialSchema>
