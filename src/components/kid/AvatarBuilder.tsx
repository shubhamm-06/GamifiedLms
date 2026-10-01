import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Ban, Check, Crown, Eye, Glasses, Image, Palette, Shuffle, Smile, Sparkles, type LucideIcon } from 'lucide-react'
import { Avatar } from './Avatar'
import { LG_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import {
  AVATAR_CATALOG,
  AVATAR_CATEGORIES,
  AVATAR_SWATCHES,
  describeAvatar,
  isTintSlot,
  randomAvatarConfig,
  tintFor,
  type AvatarCategory,
  type AvatarConfig,
  type AvatarTintSlot,
} from '@/lib/avatar'

const TABS: Record<AvatarCategory, { label: string; Icon: LucideIcon }> = {
  base: { label: 'Colour', Icon: Palette },
  eyes: { label: 'Eyes', Icon: Eye },
  mouth: { label: 'Mouth', Icon: Smile },
  glasses: { label: 'Glasses', Icon: Glasses },
  head: { label: 'Head', Icon: Crown },
  extra: { label: 'Extras', Icon: Sparkles },
  backdrop: { label: 'Backdrop', Icon: Image },
}

/** Eyes, mouth and glasses tiles zoom into the face so their detail is legible. */
const ZOOMED: readonly AvatarCategory[] = ['eyes', 'mouth', 'glasses']

/**
 * Arrow-key navigation shared by tabs, tiles and swatches (roving tabindex):
 * returns the index to move to, or null when the key is not a navigation key.
 */
function navTarget(e: KeyboardEvent, index: number, count: number): number | null {
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

/**
 * A roving-tabindex radiogroup of `items.length` buttons: ref callbacks to attach
 * (by index) and a keydown handler that moves focus and calls `onPick`. Shared by
 * the tile grid and the swatch row, which differ only in what they render per item.
 */
function useRovingRadio<T>(items: readonly T[], onPick: (item: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const ref = (i: number) => (el: HTMLButtonElement | null) => {
    refs.current[i] = el
  }
  function onKey(e: KeyboardEvent, index: number) {
    const to = navTarget(e, index, items.length)
    if (to === null) return
    e.preventDefault()
    onPick(items[to])
    refs.current[to]?.focus()
  }
  return { ref, onKey }
}

/**
 * The avatar builder: a big live preview (the only animated avatar), one tab per
 * body part, a wrapping grid of tiles that each show the FULL avatar with that
 * option applied, a colour row for the selected part when it can be coloured,
 * and Cancel / Save. Nothing here writes to the database: the page that opens
 * this owns `onSave`. Every option is free (Phase 1; no unlocks).
 *
 * Mobile: preview on top, tabs, the options region (the only scroller), then the
 * bottom bar. From 1024px: preview, Shuffle and the buttons on the left, tabs
 * and options on the right (kid.css, `.avb`).
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
  const [tab, setTab] = useState<AvatarCategory>('base')
  const [pop, setPop] = useState(0)
  const desktop = useMediaQuery(LG_UP)
  const uid = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const change = (next: AvatarConfig) => {
    setConfig(next)
    setPop((n) => n + 1)
  }
  const pick = (category: AvatarCategory, id: string) => change({ ...config, [category]: id } as AvatarConfig)
  const tint = (slot: AvatarTintSlot, swatch: (typeof AVATAR_SWATCHES)[number]['id']) =>
    change({ ...config, tints: { ...config.tints, [slot]: swatch } })

  const description = describeAvatar(config)
  const tabId = (c: AvatarCategory) => `${uid}-tab-${c}`
  const panelId = `${uid}-panel`

  function onTabKey(e: KeyboardEvent, index: number) {
    const to = navTarget(e, index, AVATAR_CATEGORIES.length)
    if (to === null) return
    e.preventDefault()
    const next = AVATAR_CATEGORIES[to]
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="avb" data-testid="avatar-builder">
      <div className="avb-stage">
        <div className="avb-preview" data-testid="av-preview">
          <Avatar config={config} size={desktop ? 200 : 152} animated popKey={pop} label={description} data-testid="av-preview-avatar" />
        </div>
        <p className="sr-only" aria-live="polite" data-testid="av-description">
          {description}
        </p>
        <button type="button" className="candy-btn-quiet avb-shuffle kid-tap" onClick={() => change(randomAvatarConfig())} data-testid="av-shuffle">
          <Shuffle className="size-5" aria-hidden />
          Shuffle
        </button>
      </div>

      <div className="avb-editor">
        <div className="avb-tabs" role="tablist" aria-label="Avatar parts">
          {AVATAR_CATEGORIES.map((c, i) => {
            const { label, Icon } = TABS[c]
            const active = tab === c
            return (
              <button
                key={c}
                ref={(el) => {
                  tabRefs.current[c] = el
                }}
                type="button"
                role="tab"
                id={tabId(c)}
                aria-selected={active}
                aria-controls={panelId}
                aria-label={label}
                tabIndex={active ? 0 : -1}
                className="avb-tab kid-tap"
                data-active={active ? 'true' : undefined}
                onClick={() => setTab(c)}
                onKeyDown={(e) => onTabKey(e, i)}
                data-testid={`av-tab-${c}`}
              >
                <Icon className="avb-tab-icon" aria-hidden />
                <span className="avb-tab-label" aria-hidden>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="avb-panel" role="tabpanel" id={panelId} aria-labelledby={tabId(tab)} data-testid="av-panel">
          <OptionGrid category={tab} config={config} onPick={pick} />
          {isTintSlot(tab) && tintFor(config, tab) !== null ? (
            <SwatchRow label={`${TABS[tab].label} colour`} value={tintFor(config, tab)!} onPick={(s) => tint(tab, s)} />
          ) : null}
        </div>
      </div>

      <div className="avb-actions">
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

/** One category's tiles: a radiogroup, each tile the full avatar with only that option swapped in. */
function OptionGrid({ category, config, onPick }: { category: AvatarCategory; config: AvatarConfig; onPick: (category: AvatarCategory, id: string) => void }) {
  const options = AVATAR_CATALOG[category] as readonly { id: string; label: string }[]
  const current = config[category] as string
  const zoomed = ZOOMED.includes(category)
  const { ref, onKey } = useRovingRadio(options, (o) => onPick(category, o.id))

  return (
    <div className="avb-grid" role="radiogroup" aria-label={`${TABS[category].label} options`} data-testid={`av-grid-${category}`}>
      {options.map((o, i) => {
        const chosen = current === o.id
        const isNone = o.id === 'none'
        return (
          <button
            key={o.id}
            ref={ref(i)}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={o.label}
            tabIndex={chosen ? 0 : -1}
            className="avb-tile kid-tap"
            data-chosen={chosen ? 'true' : undefined}
            onClick={() => onPick(category, o.id)}
            onKeyDown={(e) => onKey(e, i)}
            data-testid={`av-option-${category}-${o.id}`}
          >
            <span className="avb-tile-art" aria-hidden>
              {isNone ? (
                <Ban className="avb-none" />
              ) : (
                <Avatar config={{ ...config, [category]: o.id } as AvatarConfig} size={72} view={zoomed ? 'face' : 'full'} data-testid="av-tile-avatar" />
              )}
            </span>
            {chosen ? (
              <span className="avb-check" aria-hidden>
                <Check className="size-3.5" strokeWidth={3.5} />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function SwatchRow({ label, value, onPick }: { label: string; value: (typeof AVATAR_SWATCHES)[number]['id']; onPick: (id: (typeof AVATAR_SWATCHES)[number]['id']) => void }) {
  const { ref, onKey } = useRovingRadio(AVATAR_SWATCHES, (s) => onPick(s.id))
  return (
    <div className="avb-swatches" role="radiogroup" aria-label={label} data-testid="av-swatches">
      {AVATAR_SWATCHES.map((s, i) => {
        const chosen = s.id === value
        return (
          <button
            key={s.id}
            ref={ref(i)}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={s.label}
            tabIndex={chosen ? 0 : -1}
            className="avb-swatch kid-tap"
            data-swatch={s.id}
            data-chosen={chosen ? 'true' : undefined}
            style={{ '--swatch': `var(--${s.id})` } as React.CSSProperties}
            onClick={() => onPick(s.id)}
            onKeyDown={(e) => onKey(e, i)}
            data-testid={`av-swatch-${s.id}`}
          >
            {chosen ? <Check className="size-4" strokeWidth={3.5} aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}
