import type { TestimonialSource } from '@/lib/coursePageLimits'

/** Accessible labels for the testimonial source icons (the icon never carries meaning alone). */
export const SOURCE_LABELS: Record<TestimonialSource, string> = {
  google: 'Google review',
  facebook: 'Posted on Facebook',
  instagram: 'Posted on Instagram',
  whatsapp: 'Shared on WhatsApp',
  youtube: 'Posted on YouTube',
  x: 'Posted on X',
  linkedin: 'Posted on LinkedIn',
  website: 'Posted on a website',
}

/** The platform as it reads in "View original post on <Platform>". */
export const SOURCE_NAMES: Record<TestimonialSource, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  website: 'a website',
}
