import { useState } from 'react'
import { Check, Shuffle } from 'lucide-react'
import { Avatar } from './Avatar'
import {
  AVATAR_ACCENTS,
  AVATAR_BASES,
  AVATAR_FACES,
  AVATAR_TOPPERS,
  randomAvatarConfig,
  type AvatarConfig,
} from '@/lib/avatar'

const CATEGORY_LABEL: Record<'base' | 'topper' | 'face' | 'accent', string> = {
  base: 'Colour',
  topper: 'Topper',
  face: 'Face',
  accent: 'Accent',
}

/**
 * One category's row of choices: each chip is the full avatar with only that
 * category swapped in, so the child sees exactly what tapping it would give
 * them, not an abstract swatch. A horizontal scroller (tap or swipe), snap per
 * chip, the same candy-press feedback as the app's other tappable circles.
 * The picked chip gets a small teal check instead of a second visual style.
 */
function CategoryRow<K extends 'base' | 'topper' | 'face' | 'accent'>({
  category,
  options,
  config,
  onPick,
}: {
  category: K
  options: readonly AvatarConfig[K][]
  config: AvatarConfig
  onPick: (value: AvatarConfig[K]) => void
}) {
  return (
    <div className="av-category" data-testid={`av-category-${category}`}>
      <p className="av-category-label">{CATEGORY_LABEL[category]}</p>
      <div className="av-row">
        {options.map((option) => {
          const chosen = config[category] === option
          return (
            <button
              key={String(option)}
              type="button"
              className="av-chip kid-tap"
              data-chosen={chosen ? 'true' : undefined}
              aria-pressed={chosen}
              aria-label={`${CATEGORY_LABEL[category]}: ${option}`}
              onClick={() => onPick(option)}
              data-testid={`av-option-${category}-${option}`}
            >
              <Avatar config={{ ...config, [category]: option }} size={56} />
              {chosen ? (
                <span className="av-chip-check" aria-hidden>
                  <Check className="size-3.5" strokeWidth={3.5} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The avatar builder: a live preview up top, one horizontally-scrolling row
 * of choices per category, a Shuffle button that randomizes all four at once,
 * and Save/Cancel. Nothing here writes to the database — the page that opens
 * this owns `onSave`, so the same builder could be reused anywhere a config
 * needs picking.
 */
export function AvatarBuilder({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: AvatarConfig
  saving: boolean
  onSave: (config: AvatarConfig) => void
  onCancel: () => void
}) {
  const [config, setConfig] = useState(initial)

  return (
    <div className="av-builder" data-testid="avatar-builder">
      <div className="av-preview">
        <Avatar config={config} size={120} />
      </div>
      <button type="button" className="candy-btn-quiet kid-tap av-shuffle" onClick={() => setConfig(randomAvatarConfig())} data-testid="av-shuffle">
        <Shuffle className="size-5" aria-hidden />
        Shuffle
      </button>

      <CategoryRow category="base" options={AVATAR_BASES} config={config} onPick={(v) => setConfig((c) => ({ ...c, base: v }))} />
      <CategoryRow category="topper" options={AVATAR_TOPPERS} config={config} onPick={(v) => setConfig((c) => ({ ...c, topper: v }))} />
      <CategoryRow category="face" options={AVATAR_FACES} config={config} onPick={(v) => setConfig((c) => ({ ...c, face: v }))} />
      <CategoryRow category="accent" options={AVATAR_ACCENTS} config={config} onPick={(v) => setConfig((c) => ({ ...c, accent: v }))} />

      <div className="av-actions">
        <button type="button" className="candy-btn-quiet kid-tap" onClick={onCancel} disabled={saving} data-testid="av-cancel">
          Cancel
        </button>
        <button type="button" className="candy-btn kid-tap" onClick={() => onSave(config)} disabled={saving} data-testid="av-save">
          {saving ? 'Saving…' : 'Save avatar'}
        </button>
      </div>
    </div>
  )
}
