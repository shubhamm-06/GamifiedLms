/**
 * Where the child was when they left the roadmap for a lesson, so Back can bring
 * them to the same place. The lesson player records the lesson it opened; the
 * roadmap reads it once when it next opens (`peek`, then `clear` after it has
 * scrolled) and scrolls to that node through the same path the locked-lesson
 * redirect uses. Module state, not storage: it only has to survive one trip.
 */
let leftFrom: string | null = null

export function rememberLessonLeft(lessonId: string): void {
  leftFrom = lessonId
}

export function peekLessonLeft(): string | null {
  return leftFrom
}

export function clearLessonLeft(): void {
  leftFrom = null
}
