import type { ITheme } from '@xterm/xterm'
import { ensureContrast, hexToHsl, hslToHex, mixHue } from '../lib/color'

// Terminal color schemes (Settings › Appearance › Terminal text, and the
// per-host override).
//
// Every scheme gets its own full 16-color ANSI ramp, derived from its own
// background and foreground rather than sharing one hardcoded palette. That is
// what makes `ls`, `git diff`, syntax highlighting and prompts read as a
// coherent theme instead of one flat foreground color: the hues stay
// recognisably red/green/yellow/blue/magenta/cyan, but each is pulled slightly
// toward the scheme's own hue and lifted until it clears a contrast floor
// against that scheme's background.

/**
 * Where each ANSI slot sits on the color wheel before harmonisation. Blue and
 * cyan are the tightest pair, so they are given a deliberately wide gap — the
 * hue pull compresses whatever separation they start with, and blue/cyan
 * confusion is the first thing that makes a palette feel wrong.
 */
const ANSI_HUES = {
  red: 2,
  green: 138,
  yellow: 45,
  blue: 224,
  magenta: 300,
  cyan: 186,
} as const

type AnsiName = keyof typeof ANSI_HUES

/**
 * How far each ANSI hue is pulled toward the scheme's own hue. Low on purpose:
 * enough to make Matrix's red feel like it belongs in a green terminal, not so
 * much that red stops reading as red.
 */
const HUE_PULL = 0.16

/** Normal and bright variants. Bright is lighter and a little more saturated. */
const NORMAL = { s: 0.6, l: 0.6 }
const BRIGHT = { s: 0.68, l: 0.73 }

/** ANSI colors carry meaning, so they must stay legible on the background. */
const MIN_CONTRAST = 4.5

interface SchemeSpec {
  bg: string
  fg: string
  cursor: string
  selection: string
}

/**
 * Saturation at which a scheme's foreground counts as fully "tinted". Below it
 * the hue pull is scaled down, and at zero saturation it is skipped entirely:
 * hexToHsl reports hue 0 for a grey, which is not red — it is no hue at all.
 * Without this, the Mono scheme would drag every ANSI color toward red.
 */
const TINT_REFERENCE_SATURATION = 0.35

function ansiRamp(spec: SchemeSpec): Record<string, string> {
  const fgHsl = hexToHsl(spec.fg)
  const bgHsl = hexToHsl(spec.bg)
  const pull = HUE_PULL * Math.min(fgHsl.s / TINT_REFERENCE_SATURATION, 1)

  const build = (name: AnsiName, tone: { s: number; l: number }) => {
    const h = mixHue(ANSI_HUES[name], fgHsl.h, pull)
    return ensureContrast({ h, s: tone.s, l: tone.l }, spec.bg, MIN_CONTRAST)
  }

  const ramp: Record<string, string> = {}
  for (const name of Object.keys(ANSI_HUES) as AnsiName[]) {
    ramp[name] = build(name, NORMAL)
    // "brightRed", "brightGreen", ...
    ramp[`bright${name[0].toUpperCase()}${name.slice(1)}`] = build(name, BRIGHT)
  }

  // Neutrals ride the scheme's own hue so the greys never look foreign.
  // `black` is a lifted background rather than pure black, which is what keeps
  // dim/bold-black text visible instead of vanishing into the canvas.
  ramp.black = hslToHex({ h: bgHsl.h, s: Math.min(bgHsl.s, 0.2), l: Math.min(bgHsl.l + 0.1, 0.3) })
  ramp.brightBlack = ensureContrast(
    { h: bgHsl.h, s: Math.min(bgHsl.s, 0.16), l: 0.42 },
    spec.bg,
    3, // dimmed-on-purpose text: a lower floor than the meaningful colors
  )
  ramp.white = spec.fg
  ramp.brightWhite = hslToHex({ ...hexToHsl(spec.fg), l: Math.min(hexToHsl(spec.fg).l + 0.16, 0.96) })

  return ramp
}

function scheme(bg: string, fg: string, cursor: string, selection: string): ITheme {
  const spec = { bg, fg, cursor, selection }
  return {
    background: bg,
    foreground: fg,
    cursor,
    cursorAccent: bg,
    selectionBackground: selection,
    ...ansiRamp(spec),
  }
}

export const TERM_SCHEMES: Record<string, ITheme> = {
  TerCTL: scheme('#0a0c10', '#cdd2da', '#8b95a6', '#242a34'),
  Snow: scheme('#0a0c10', '#dfe2e6', '#c7ccd2', '#242a34'),
  Matrix: scheme('#070b08', '#6bb894', '#5aa886', '#132a20'),
  Amber: scheme('#0d0a05', '#cba066', '#c79a5c', '#33290f'),
  Ice: scheme('#08111a', '#a6c2d8', '#6a95c0', '#122842'),
  Neon: scheme('#0a0810', '#5fadbd', '#4fa2b5', '#0f2630'),
  Grape: scheme('#0f0a16', '#b6a2d2', '#9580c0', '#241833'),
  Rose: scheme('#140a10', '#d3a6b4', '#c1737f', '#33161f'),
  Mono: scheme('#0d0d0d', '#a8a8a8', '#c4c4c4', '#262626'),
}

/** A small swatch color per scheme for the Settings UI (text-on-dark preview). */
export const TERM_SWATCH: Record<string, { bg: string; fg: string }> = Object.fromEntries(
  Object.entries(TERM_SCHEMES).map(([name, t]) => [
    name,
    { bg: t.background ?? '#000', fg: t.foreground ?? '#fff' },
  ]),
)

export const terminalTheme = TERM_SCHEMES.TerCTL
export const terminalFontFamily = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
