/**
 * Pure helpers for enrolling in a FREE course from the course page (`fn_enroll_free_course`,
 * migration 040). Kept free of React and Supabase so scripts/check-course-page.mjs can run them.
 */

/** Calm, plain wording for every failure the function (or the network) can produce. Never the raw error text. */
export function describeEnrollError(message: string | null | undefined): string {
  const m = (message ?? '').toLowerCase()
  if (m.includes('enrollment_revoked')) return 'Your access to this course was ended. Please contact support.'
  if (m.includes('enrollment_expired')) return 'Your access to this course has ended.'
  if (m.includes('enrollment_closed')) return "Enrollment isn't open for this course right now."
  if (m.includes('not_free')) return "This course isn't free right now."
  if (m.includes('course_not_found') || m.includes('course_unavailable') || m.includes('course_archived')) return "This course isn't available right now."
  if (m.includes('not_authenticated')) return 'Please log in to enroll.'
  return "We couldn't enroll you just now. Please try again."
}

/** Where a visitor goes to create an account or log in, carrying a redirect back to this course (the in-app page, by slug). */
export function courseAuthHref(kind: 'signup' | 'login', slug: string): string {
  return `/${kind}?redirect=${encodeURIComponent(`/courses/${slug}`)}`
}

/** The course's kid-facing page (the roadmap once enrolled). */
export const courseRoadmapHref = (slug: string): string => `/courses/${slug}`
