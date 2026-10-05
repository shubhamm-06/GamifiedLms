/**
 * Lowercase, spaces to hyphens, strip anything else. Used to seed a course
 * slug from its title; the field stays hand-editable afterwards.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Longest course slug the database accepts (`courses_slug_format_check`, migration 036). */
const COURSE_SLUG_MAX = 80

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when a URL segment is a course id rather than a slug. Slugs may never be UUID-shaped (migration 036). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Mirrors `courses_slug_format_check`: lowercase letters and digits in hyphen-separated groups, <= 80, never UUID-shaped. */
export function isValidCourseSlug(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= COURSE_SLUG_MAX && !isUuid(value)
}

/** A course slug from its title, cut to the allowed length without leaving a trailing hyphen. */
export function courseSlugFromTitle(title: string): string {
  return slugify(title).slice(0, COURSE_SLUG_MAX).replace(/-+$/, '')
}
