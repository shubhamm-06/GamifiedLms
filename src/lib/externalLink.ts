/**
 * The one check for "is this a safe, external https link" — the admin form
 * (`CourseForm.tsx`) uses it before save, and the student info page
 * (`CourseInfoPage.tsx`) uses it again at click time, right before opening
 * `courses.enroll_url`. Mirrors the DB's own `courses_enroll_url_format_check`
 * (migration 033): https only, no whitespace, <= 2048 chars. The DB is still
 * the backstop — this is never the only thing standing between a bad value
 * and the database, just the thing standing between a bad value and a tap.
 */
export function isHttpsUrl(value: string): boolean {
  return /^https:\/\/\S+$/.test(value) && value.length <= 2048
}
