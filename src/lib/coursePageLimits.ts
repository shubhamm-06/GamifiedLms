/**
 * Every limit and enum of the parent-facing course page's configuration, with NO dependencies,
 * so the student page (coursePage.ts) can import them without pulling zod into the student
 * bundle. coursePageSchema.ts (zod, admin only) builds its schemas from these same values, and
 * the database CHECKs (migrations 034, 037, 038) mirror them. Change a limit here AND in a migration.
 */

export const PAGE_LIMITS = {
  tagline: 160,
  ageMin: 1,
  ageMax: 18,
  language: 40,
  outcomes: { items: 8, length: 120 },
  requirements: { items: 6, length: 120 },
  faqs: { items: 8, question: 140, answer: 600 },
  instructorName: 80,
  instructorRole: 80,
  instructorBio: 300,
  url: 2048,
  layout: { entries: 20, customs: 6, title: 80, intro: 200 },
  custom: { body: 1200, listItems: 10, listItem: 140, alt: 140, caption: 140 },
  ctaLabel: 24,
  priceNote: 80,
  included: { items: 6, length: 80 },
  customFacts: { items: 3, label: 24, value: 32 },
  howItems: { items: 8, length: 140 },
  howIntro: 200,
  testimonials: { items: 6, quoteMin: 10, quoteMax: 280, name: 60, relation: 80 },
  /** How many facts the hero strip shows at most (built-in plus custom). */
  factsShown: 6,
} as const

/** Where a testimonial was posted (migration 039). The page maps each key to an outline icon (components/kid/coursePage/testimonialSources.tsx). */
export const TESTIMONIAL_SOURCES = ['google', 'facebook', 'instagram', 'whatsapp', 'youtube', 'x', 'linkedin', 'website'] as const
export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number]

export const BUILTIN_KEYS = ['about', 'learn', 'inside', 'how', 'need', 'reviews', 'made_by', 'faq'] as const
export type BuiltinKey = (typeof BUILTIN_KEYS)[number]
export const FACT_KEYS = ['ages', 'lessons', 'time', 'access', 'language'] as const
export type FactKey = (typeof FACT_KEYS)[number]
export const CUSTOM_TYPES = ['text', 'list', 'image'] as const
export type CustomType = (typeof CUSTOM_TYPES)[number]
export const LIST_STYLES = ['check', 'bullet', 'number'] as const
export type ListStyle = (typeof LIST_STYLES)[number]
export const COVER_FOCUS = ['top', 'center', 'bottom'] as const
export type CoverFocus = (typeof COVER_FOCUS)[number]
export const OUTLINE_OPEN = ['first', 'all', 'none'] as const
export type OutlineOpen = (typeof OUTLINE_OPEN)[number]
export const OUTLINE_DETAIL = ['lessons', 'sections'] as const
export type OutlineDetail = (typeof OUTLINE_DETAIL)[number]

/** The custom-section id rule (the DB uses the same pattern). */
export const CUSTOM_ID_RE = /^[a-z0-9-]{8,36}$/
