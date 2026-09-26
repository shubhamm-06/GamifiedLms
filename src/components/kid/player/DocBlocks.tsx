import type { ComponentType } from 'react'
import { CircleHelp, Heart, Info, Lightbulb, Star } from 'lucide-react'
import { safeMediaUrl } from '@/lib/lessonPlayer'
import type { CalloutIcon, LessonBlock } from '@/lib/lessonBlocks'

const ICONS: Record<CalloutIcon, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  info: Info,
  idea: Lightbulb,
  star: Star,
  heart: Heart,
  question: CircleHelp,
}

/**
 * A doc lesson's content blocks, in the order given. A paragraph is plain body
 * text. A callout is a card with a round icon in the block's colour token (the
 * `-d` variant as the press-shadow under it, like the app's buttons), a cream
 * icon (decorative: the text carries the meaning) and the text. An image sits in
 * a rounded container at a capped width, never cropped. Text is rendered as text,
 * never as HTML. An image whose URL is not https (http in dev) is skipped.
 */
export function DocBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div className="lp-blocks" data-testid="doc-blocks">
      {blocks.map((block) => {
        if (block.kind === 'paragraph') {
          return (
            <p key={block.id} className="lp-block-p" data-testid="block-paragraph">
              {block.text}
            </p>
          )
        }
        if (block.kind === 'callout') {
          const Icon = ICONS[block.icon]
          return (
            <div key={block.id} className="lp-callout kid-card" data-testid="block-callout" data-color={block.color}>
              <span className="lp-callout-icon" data-color={block.color} aria-hidden="true">
                <Icon className="size-6" strokeWidth={2.75} />
              </span>
              <p className="lp-callout-text">{block.text}</p>
            </div>
          )
        }
        const src = safeMediaUrl(block.url, import.meta.env.DEV)
        if (!src) return null
        return (
          <figure key={block.id} className="lp-block-image" data-testid="block-image">
            <img src={src} alt={block.alt} loading="lazy" decoding="async" />
          </figure>
        )
      })}
    </div>
  )
}
