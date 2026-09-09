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
