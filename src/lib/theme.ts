// The bridge between terCTL's color config and the shadcn design system.
//
// shadcn theming is a flat set of CSS custom properties (--background, --card,
// --primary, ...). Rather than hand-maintaining ten copies of that set — one
// per base palette, times sixteen accents — we derive it from the config in
// src/constants/{themes,accents}.ts and write it onto <html> as inline styles,
// which outrank the stylesheet defaults in src/index.css.
//
// Only the tokens that actually depend on the selected theme or accent are
// emitted here. The theme-independent ones (text ramp, hairlines, status
// colors) are aliased once in src/styles/theme.css.

import { ACCENTS, DEFAULT_ACCENT } from '../constants/accents'
import { DEFAULT_THEME, THEMES } from '../constants/themes'

export interface ThemeChoice {
  accent: string
  theme: string
}

/** Ink used on top of a brand-colored fill when the brand is light. */
const DARK_INK = '#0b0d10'
const LIGHT_INK = '#ffffff'

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  )
}

/**
 * Foreground for text sitting on `hex`, picked by whichever of the two inks
 * lands the higher contrast ratio. Every accent shipped today is mid-to-light
 * so this resolves to the dark ink, but it keeps a future dark accent legible.
 */
function readableOn(hex: string): string {
  const bg = luminance(hex) + 0.05
  return bg / (luminance(DARK_INK) + 0.05) >= 1.05 / bg ? DARK_INK : LIGHT_INK
}

/**
 * The shadcn token set for a given theme + accent. Returned as a plain map so
 * it can be applied to the live document or serialized into a stylesheet.
 */
export function themeTokens({ accent, theme }: ThemeChoice): Record<string, string> {
  const p = THEMES[theme] ?? THEMES[DEFAULT_THEME]
  const a = ACCENTS[accent] ?? ACCENTS[DEFAULT_ACCENT]
  const onBrand = readableOn(a.c)

  return {
    // --- shadcn surfaces, from the base palette ---------------------------
    '--background': p.bg,
    '--card': p.bgCard,
    // Floating surfaces sit one step above cards so menus read as elevated.
    '--popover': p.bgCardTop,
    '--secondary': p.bgCard2,
    '--muted': p.bgCard2,
    // shadcn's --accent is the subtle hover/active surface, NOT the brand.
    '--accent': p.bgCardTop,
    '--sidebar': p.bgPanel,
    '--sidebar-accent': p.bgInspectorTop,

    // --- shadcn brand slots, from the accent -----------------------------
    '--primary': a.c,
    '--primary-foreground': onBrand,
    '--ring': a.c,
    '--sidebar-primary': a.c,
    '--sidebar-primary-foreground': onBrand,
    '--sidebar-ring': a.c,
    '--chart-1': a.c,
    '--chart-2': a.c2,

    // --- terCTL tokens with no shadcn equivalent --------------------------
    // The vivid two-tone brand pair. Everything else (--brand-soft,
    // --brand-border, --gradient-brand, ...) derives from these in theme.css.
    '--brand': a.c,
    '--brand-2': a.c2,
    '--brand-contrast': onBrand,
    '--bg-deep': p.bgDeep,
  }
}

/**
 * Write the token set onto the document root. Safe to call repeatedly; it only
 * ever sets the same fixed key set, so no stale properties accumulate.
 *
 * The `dark` class is what shadcn's `dark:` variant keys off — terCTL is
 * dark-only, so it stays on permanently.
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  const tokens = themeTokens(choice)
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value)
  }
  root.classList.add('dark')
  root.dataset.theme = (THEMES[choice.theme] ?? THEMES[DEFAULT_THEME]).slug
}
