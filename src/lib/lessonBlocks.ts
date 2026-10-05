/**
 * The kid app's view of `lesson_content_blocks` (migration 023): a doc lesson's
 * content as ordered typed blocks. Rows are validated on the way in, so the
 * renderer only ever sees a well-formed block: a row whose columns do not fit
 * its type (the database CHECK makes that impossible today) is dropped, not
 * guessed at.
 */

export const CALLOUT_COLORS = ['gold', 'teal', 'coral', 'plum'] as const
export type CalloutColor = (typeof CALLOUT_COLORS)[number]

export const CALLOUT_ICONS = ['info', 'idea', 'star', 'heart', 'question'] as const
export type CalloutIcon = (typeof CALLOUT_ICONS)[number]

export type LessonBlock =
  | { id: string; kind: 'paragraph'; text: string }
  | { id: string; kind: 'callout'; text: string; color: CalloutColor; icon: CalloutIcon }
  | { id: string; kind: 'image'; url: string; alt: string }

interface BlockRow {
  id: string
  position: number
  block_type: string
  text_content: string | null
  callout_color: string | null
  callout_icon: string | null
  image_url: string | null
  image_alt: string | null
}

const isColor = (v: string | null): v is CalloutColor => !!v && (CALLOUT_COLORS as readonly string[]).includes(v)
const isIcon = (v: string | null): v is CalloutIcon => !!v && (CALLOUT_ICONS as readonly string[]).includes(v)

/** Rows in `position` order (ties by id, so the order is stable) to well-formed blocks. */
export function toBlocks(rows: BlockRow[]): LessonBlock[] {
  const out: LessonBlock[] = []
  const sorted = [...rows].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  for (const r of sorted) {
    const text = r.text_content?.trim() ?? ''
    if (r.block_type === 'paragraph' && text) {
      out.push({ id: r.id, kind: 'paragraph', text })
    } else if (r.block_type === 'callout' && text && isColor(r.callout_color) && isIcon(r.callout_icon)) {
      out.push({ id: r.id, kind: 'callout', text, color: r.callout_color, icon: r.callout_icon })
    } else if (r.block_type === 'image' && r.image_url) {
      out.push({ id: r.id, kind: 'image', url: r.image_url, alt: r.image_alt?.trim() ?? '' })
    }
  }
  return out
}
