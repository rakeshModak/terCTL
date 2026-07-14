import type { ITheme } from '@xterm/xterm'

// Shared ANSI palette — the 16 standard colors stay consistent across schemes;
// only the background / foreground / cursor change per scheme.
const ANSI = {
  black: '#12151b',
  red: '#ff5f56',
  green: '#3ddc97',
  yellow: '#f5b544',
  blue: '#5b9dff',
  magenta: '#8b5bff',
  cyan: '#5bd6ff',
  white: '#cdd3dd',
  brightBlack: '#5f6875',
  brightRed: '#ff8078',
  brightGreen: '#6be3b0',
  brightYellow: '#ffc766',
  brightBlue: '#8fbaff',
  brightMagenta: '#a17fff',
  brightCyan: '#8ae4ff',
  brightWhite: '#e8eaee',
} as const

function scheme(bg: string, fg: string, cursor: string, selection: string): ITheme {
  return { background: bg, foreground: fg, cursor, cursorAccent: bg, selectionBackground: selection, ...ANSI }
}

// Terminal text/color schemes (Settings › Appearance › Terminal text).
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

// A small swatch color per scheme for the Settings UI (text-on-dark preview).
export const TERM_SWATCH: Record<string, { bg: string; fg: string }> = {
  TerCTL: { bg: '#0a0c10', fg: '#cdd2da' },
  Snow: { bg: '#0a0c10', fg: '#dfe2e6' },
  Matrix: { bg: '#070b08', fg: '#6bb894' },
  Amber: { bg: '#0d0a05', fg: '#cba066' },
  Ice: { bg: '#08111a', fg: '#a6c2d8' },
  Neon: { bg: '#0a0810', fg: '#5fadbd' },
  Grape: { bg: '#0f0a16', fg: '#b6a2d2' },
  Rose: { bg: '#140a10', fg: '#d3a6b4' },
  Mono: { bg: '#0d0d0d', fg: '#a8a8a8' },
}

export const terminalTheme = TERM_SCHEMES.TerCTL
export const terminalFontFamily = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
