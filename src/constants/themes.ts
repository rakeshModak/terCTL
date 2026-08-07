// Base-palette themes — the source of truth for every *surface* color in the
// app. These feed `themeTokens()` in src/lib/theme.ts, which derives the shadcn
// surface tokens (--background/--card/--popover/--sidebar/...) from them and
// writes the result onto <html> at runtime.
//
// Adding a theme here is all that is needed: the Settings picker, its swatch,
// and the shadcn tokens are all generated from this map.
//
// The theme-independent colors — the text ramp, hairlines, and semantic status
// colors — live in src/styles/theme.css, which aliases the matching shadcn
// tokens onto them (--foreground: var(--text), --destructive: var(--red), ...).

/** Surface ramp for one theme, ordered darkest -> lightest. */
export interface ThemePalette {
  /** Value written to <html data-theme>. Empty for the historical default. */
  slug: string
  /** App canvas.                     -> --background */
  bg: string
  /** Recessed wells (fields, gutters). No shadcn equivalent -> --bg-deep. */
  bgDeep: string
  /** Chrome rails and side panels.    -> --sidebar */
  bgPanel: string
  /** Resting card surface.            -> --card */
  bgCard: string
  /** Secondary / muted fills.         -> --secondary, --muted */
  bgCard2: string
  /** Raised + hover surfaces.         -> --popover, --accent */
  bgCardTop: string
  /** Inspector header, sidebar hover. -> --sidebar-accent */
  bgInspectorTop: string
}

export const THEMES: Record<string, ThemePalette> = {
  Midnight: {
    slug: '',
    bg: '#0a0c10', bgDeep: '#08090c', bgPanel: '#0c0e13', bgCard: '#0e1116',
    bgCard2: '#101319', bgCardTop: '#12151b', bgInspectorTop: '#151922',
  },
  Graphite: {
    slug: 'graphite',
    bg: '#17181b', bgDeep: '#101113', bgPanel: '#1c1d21', bgCard: '#202127',
    bgCard2: '#23242b', bgCardTop: '#26272e', bgInspectorTop: '#2a2b33',
  },
  'Nord Deep': {
    slug: 'nord',
    bg: '#1b2230', bgDeep: '#141a25', bgPanel: '#222b3a', bgCard: '#273244',
    bgCard2: '#2b3750', bgCardTop: '#2e3a52', bgInspectorTop: '#33405b',
  },
  Obsidian: {
    slug: 'obsidian',
    bg: '#0b0b0d', bgDeep: '#050506', bgPanel: '#101013', bgCard: '#141417',
    bgCard2: '#17171b', bgCardTop: '#1a1a1f', bgInspectorTop: '#1e1e24',
  },
  Void: {
    slug: 'void',
    bg: '#0d0a16', bgDeep: '#08060f', bgPanel: '#130f20', bgCard: '#171126',
    bgCard2: '#1b142d', bgCardTop: '#201735', bgInspectorTop: '#261c3f',
  },
  'Deep Space': {
    slug: 'space',
    bg: '#0a0e1a', bgDeep: '#060912', bgPanel: '#0e1322', bgCard: '#121829',
    bgCard2: '#151d31', bgCardTop: '#1a2238', bgInspectorTop: '#1f2844',
  },
  Abyss: {
    slug: 'abyss',
    bg: '#071414', bgDeep: '#041010', bgPanel: '#0b1c1c', bgCard: '#0f2323',
    bgCard2: '#132a2a', bgCardTop: '#173131', bgInspectorTop: '#1c3b3b',
  },
  Plum: {
    slug: 'plum',
    bg: '#140a12', bgDeep: '#0d060b', bgPanel: '#1d0f1a', bgCard: '#241320',
    bgCard2: '#2a1726', bgCardTop: '#311b2c', bgInspectorTop: '#3a2035',
  },
  // Stark neutral mono, and a green-tinted black.
  Carbon: {
    slug: 'carbon',
    bg: '#0a0a0b', bgDeep: '#050505', bgPanel: '#0f0f11', bgCard: '#141416',
    bgCard2: '#171719', bgCardTop: '#1a1a1d', bgInspectorTop: '#1f1f22',
  },
  Forest: {
    slug: 'forest',
    bg: '#080b09', bgDeep: '#040605', bgPanel: '#0c110e', bgCard: '#0f1611',
    bgCard2: '#121a14', bgCardTop: '#152018', bgInspectorTop: '#1a271d',
  },
}

export const DEFAULT_THEME = 'Carbon'

/** CSS gradient for a theme's Settings swatch — derived, never hand-written. */
export function themeSwatch(name: string): string {
  const p = THEMES[name] ?? THEMES[DEFAULT_THEME]
  return `linear-gradient(135deg, ${p.bg}, ${p.bgCardTop})`
}
