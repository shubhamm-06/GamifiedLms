import type { ReactNode } from 'react'
import type { TestimonialSource } from '@/lib/coursePageLimits'
import { SOURCE_LABELS, SOURCE_NAMES } from './testimonialSourceLabels'

/**
 * The testimonial source icons: one small LOCAL set, outline only, one colour (currentColor,
 * secondary ink), 24px viewBox, stroke 1.75, round caps and joins. Never brand colours. The icon
 * is supporting metadata and never the only carrier of meaning: it always has an accessible
 * label (`SOURCE_LABELS`), and a linked icon names the platform in its link label.
 */
const SHAPES: Record<TestimonialSource, ReactNode> = {
  google: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <text x="12" y="16.6" textAnchor="middle" fontSize="12.5" fontWeight="700" fontFamily="Inter, Arial, sans-serif" fill="currentColor" stroke="none">
        G
      </text>
    </>
  ),
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r=".7" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
      <path d="M9.2 8.8c.3 2.4 2.6 4.8 6 6l1-1.6-2-1-.9.8c-.8-.4-1.5-1.1-1.9-1.9l.8-.9-1-2z" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </>
  ),
  x: <path d="M5 4.5l14 15M19 4.5l-14 15" />,
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
}

/** The bare 20px icon (decorative: the wrapper that uses it carries the accessible name). */
export function SourceGlyph({ source, size = 20 }: { source: TestimonialSource; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {SHAPES[source]}
    </svg>
  )
}

/**
 * The icon on a testimonial card. Without a link: a static element, `role="img"` with the platform label.
 * With a link: an anchor that opens the real post in a new tab; its 44x44 hit area comes from padding
 * with an equal negative margin (so the layout does not move), see `.cp-src` in coursePage.css.
 */
export function SourceIcon({ source, postUrl }: { source: TestimonialSource; postUrl: string | null }) {
  if (postUrl) {
    return (
      <a className="cp-src" href={postUrl} target="_blank" rel="noopener noreferrer" aria-label={`View original post on ${SOURCE_NAMES[source]}, opens in a new tab`} data-source={source}>
        <SourceGlyph source={source} />
      </a>
    )
  }
  return (
    <span className="cp-src" role="img" aria-label={SOURCE_LABELS[source]} data-source={source}>
      <SourceGlyph source={source} />
    </span>
  )
}
