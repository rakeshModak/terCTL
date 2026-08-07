export interface Hsl {
  /** 0-360 */
  h: number
  /** 0-1 */
  s: number
  /** 0-1 */
  l: number
}

export function hexToHsl(hex: string): Hsl {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h: h * 360, s, l }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))

  let rgb: [number, number, number]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  const m = l - c / 2
  const hex = rgb
    .map((v) => {
      const byte = Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      return byte.toString(16).padStart(2, '0')
    })
    .join('')
  return `#${hex}`
}

/** WCAG relative luminance of a #rrggbb color. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

/** Contrast ratio between two #rrggbb colors, 1-21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a) + 0.05
  const lb = luminance(b) + 0.05
  return la > lb ? la / lb : lb / la
}

/**
 * Whichever of the two inks lands the higher contrast ratio on `bg`. Used for
 * text sitting on a brand-colored fill, where the accent is user-chosen.
 */
export function readableOn(bg: string, darkInk: string, lightInk: string): string {
  return contrast(bg, darkInk) >= contrast(bg, lightInk) ? darkInk : lightInk
}

/**
 * Step `ink` toward black until it clears `target` contrast against `bg`.
 *
 * Tinted hues carry more luminance at the same HSL lightness, so a single
 * hand-picked lightness that reads fine on a neutral theme can fall under AA
 * on a green or teal one. Deriving the stopping point keeps every theme — and
 * any added later — legible without per-theme tuning.
 */
export function darkenToContrast(ink: Hsl, bg: string, target: number): string {
  let { l } = ink
  let hex = hslToHex({ ...ink, l })
  // 0.02 steps: fine enough to avoid overshooting, bounded by l > 0.
  while (l > 0.02 && contrast(hex, bg) < target) {
    l -= 0.02
    hex = hslToHex({ ...ink, l })
  }
  return hex
}
