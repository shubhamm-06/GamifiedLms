/**
 * Colour helpers for the admin-editable theme (Settings > Colors). Pure functions,
 * no imports, so `scripts/check-settings.mjs` can run them directly.
 *
 * Two token ROLES are editable: primary (`--gold`) and secondary (`--teal`). The
 * locked brand values in `styles.css` are the defaults; `deriveTokens` builds each
 * role's `-d` variant (same hue and saturation, HSL lightness 15 points lower) and
 * its foreground (`--gold-fg`, `--teal-fg`: white or ink, whichever contrasts more).
 */

export const INK = '#3A2A1A'
export const WHITE = '#FFFFFF'
export const DEFAULT_PRIMARY = '#F2B233'
export const DEFAULT_SECONDARY = '#2FA3A0'

/** Contrast rules (WCAG 2.x ratios). */
export const THEME_RULES = {
  /** Text on the primary colour (its foreground) must reach this: a hard block. */
  primaryForeground: 4.5,
  /** The secondary colour against white must reach this: a hard block. */
  secondaryOnWhite: 3,
  /** Below this the secondary is fine for icons and fills but weak for text links: a warning. */
  secondaryTextWarning: 4.5,
} as const

export const HEX = /^#[0-9A-Fa-f]{6}$/

export interface Hsl {
  h: number
  s: number
  l: number
}

export function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`.toUpperCase()
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

/** WCAG contrast ratio between two #RRGGBB colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** White or ink, whichever has the higher contrast on `bg`. */
export function pickForeground(bg: string): string {
  return contrastRatio(bg, WHITE) > contrastRatio(bg, INK) ? WHITE : INK
}

export interface RoleTokens {
  base: string
  dark: string
  fg: string
}

export function deriveTokens(hex: string): RoleTokens {
  const base = hex.toUpperCase()
  const hsl = hexToHsl(base)
  return { base, dark: hslToHex({ ...hsl, l: Math.max(0, hsl.l - 15) }), fg: pickForeground(base) }
}

export interface ThemeCheck {
  primaryForeground: number
  secondaryOnWhite: number
  errors: string[]
  warnings: string[]
}

/** The rules above, as plain-language messages. Empty `errors` means the pair can be saved. */
export function checkTheme(primary: string, secondary: string): ThemeCheck {
  const errors: string[] = []
  const warnings: string[] = []
  if (!HEX.test(primary) || !HEX.test(secondary)) {
    return { primaryForeground: 0, secondaryOnWhite: 0, errors: ['Use a 6-digit hex colour like #2563EB.'], warnings }
  }
  const p = deriveTokens(primary)
  const primaryForeground = contrastRatio(p.base, p.fg)
  const secondaryOnWhite = contrastRatio(secondary, WHITE)
  if (primaryForeground < THEME_RULES.primaryForeground) {
    errors.push(
      `Text on the primary colour would be hard to read (${primaryForeground.toFixed(2)}:1, needs ${THEME_RULES.primaryForeground}:1). Pick a darker or lighter shade.`,
    )
  }
  if (secondaryOnWhite < THEME_RULES.secondaryOnWhite) {
    errors.push(
      `The secondary colour is too light on white (${secondaryOnWhite.toFixed(2)}:1, needs ${THEME_RULES.secondaryOnWhite}:1). Pick a darker shade.`,
    )
  } else if (secondaryOnWhite < THEME_RULES.secondaryTextWarning) {
    warnings.push(
      `The secondary colour is fine for buttons and icons, but text links in it are a little light (${secondaryOnWhite.toFixed(2)}:1; 4.5:1 is ideal).`,
    )
  }
  return { primaryForeground, secondaryOnWhite, errors, warnings }
}

export interface ThemePreset {
  id: string
  label: string
  primary: string
  secondary: string
}

/** Starting points. Every one passes `checkTheme` (verified by scripts/check-settings.mjs). */
export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'default', label: 'Default', primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY },
  { id: 'ocean', label: 'Ocean', primary: '#2563EB', secondary: '#0E7490' },
  { id: 'forest', label: 'Forest', primary: '#15803D', secondary: '#B45309' },
  { id: 'slate', label: 'Slate', primary: '#334155', secondary: '#0F766E' },
  { id: 'sunset', label: 'Sunset', primary: '#C2410C', secondary: '#BE185D' },
  { id: 'violet', label: 'Violet', primary: '#7C3AED', secondary: '#0D9488' },
]
