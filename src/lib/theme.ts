import { ACCENTS, DEFAULT_ACCENT } from '../constants/accents';
import { DEFAULT_THEME, THEMES, type ThemePalette } from '../constants/themes';
import { darkenToContrast, hexToHsl, hslToHex, readableOn } from './color';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

export interface ThemeChoice {
  accent: string;
  theme: string;
  mode: ThemeMode;
}

const DARK_INK = '#0b0d10';
const LIGHT_INK = '#ffffff';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
}

export function watchSystemMode(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(SYSTEM_DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function getSystemMode(): ResolvedMode {
  return resolveMode('system');
}

interface Surfaces {
  background: string;
  card: string;
  popover: string;
  secondary: string;
  accentSurface: string;
  sidebar: string;
  sidebarAccent: string;
  deep: string;
}

interface Ink {
  text: string;
  bright: string;
  dim: string;
  muted: string;
  faint: string;
  faintest: string;
}

interface Strokes {
  border: string;
  border2: string;
  strong: string;
}

interface Status {
  green: string;
  amber: string;
  blue: string;
  purple: string;
  purple2: string;
  red: string;
}

function darkSurfaces(p: ThemePalette): Surfaces {
  return {
    background: p.bg,
    card: p.bgCard,
    popover: p.bgCardTop,
    secondary: p.bgCard2,
    accentSurface: p.bgCardTop,
    sidebar: p.bgPanel,
    sidebarAccent: p.bgInspectorTop,
    deep: p.bgDeep,
  };
}

const DARK_INK_RAMP: Ink = {
  text: '#e8eaee',
  bright: '#cdd3dd',
  dim: '#9aa3b2',
  muted: '#7d8696',
  faint: '#5f6875',
  faintest: '#3a4150',
};

const DARK_STROKES: Strokes = {
  border: 'rgba(255, 255, 255, 0.06)',
  border2: 'rgba(255, 255, 255, 0.08)',
  strong: 'rgba(255, 255, 255, 0.12)',
};

const DARK_STATUS: Status = {
  green: '#3ddc97',
  amber: '#f5b544',
  blue: '#5b9dff',
  purple: '#8b5bff',
  purple2: '#a17fff',
  red: '#ff5f56',
};

function themeTint(p: ThemePalette): { h: number; s: number } {
  const { h, s } = hexToHsl(p.bgInspectorTop);
  return { h, s: Math.min(s * 0.55, 0.1) };
}

function lightSurfaces(p: ThemePalette): Surfaces {
  const { h, s } = themeTint(p);
  const step = (l: number) => hslToHex({ h, s, l });
  return {
    background: step(0.985),
    card: step(1),
    popover: step(1),
    secondary: step(0.955),
    accentSurface: step(0.94),
    sidebar: step(0.972),
    sidebarAccent: step(0.925),
    deep: step(0.962),
  };
}

const AA_CONTRAST = 4.5;

function lightInk(p: ThemePalette, background: string): Ink {
  const { h } = themeTint(p);
  const s = 0.08;
  const step = (l: number) => hslToHex({ h, s, l });
  return {
    text: step(0.13),
    bright: step(0.22),
    dim: step(0.36),
    muted: darkenToContrast({ h, s, l: 0.45 }, background, AA_CONTRAST),
    faint: step(0.55),
    faintest: step(0.7),
  };
}

const LIGHT_STROKES: Strokes = {
  border: 'rgba(0, 0, 0, 0.09)',
  border2: 'rgba(0, 0, 0, 0.12)',
  strong: 'rgba(0, 0, 0, 0.18)',
};

const LIGHT_STATUS: Status = {
  green: '#0f8a5f',
  amber: '#a16207',
  blue: '#2563eb',
  purple: '#7c3aed',
  purple2: '#6d28d9',
  red: '#dc2626',
};

function adaptAccent(hex: string, mode: ResolvedMode): string {
  if (mode === 'dark') return hex;
  const { h, s, l } = hexToHsl(hex);
  if (l <= 0.55) return hex;
  return hslToHex({ h, s: Math.max(s, 0.08), l: 0.45 });
}

export function themeTokens({
  accent,
  theme,
  mode,
}: {
  accent: string;
  theme: string;
  mode: ResolvedMode;
}): Record<string, string> {
  const p = THEMES[theme] ?? THEMES[DEFAULT_THEME];
  const rawAccent = ACCENTS[accent] ?? ACCENTS[DEFAULT_ACCENT];
  const dark = mode === 'dark';

  const surfaces = dark ? darkSurfaces(p) : lightSurfaces(p);
  const ink = dark ? DARK_INK_RAMP : lightInk(p, surfaces.background);
  const strokes = dark ? DARK_STROKES : LIGHT_STROKES;
  const status = dark ? DARK_STATUS : LIGHT_STATUS;

  const brand = adaptAccent(rawAccent.c, mode);
  const brand2 = adaptAccent(rawAccent.c2, mode);
  const onBrand = readableOn(brand, DARK_INK, LIGHT_INK);

  return {
    '--background': surfaces.background,
    '--card': surfaces.card,
    '--popover': surfaces.popover,
    '--secondary': surfaces.secondary,
    '--muted': surfaces.secondary,
    '--accent': surfaces.accentSurface,
    '--sidebar': surfaces.sidebar,
    '--sidebar-accent': surfaces.sidebarAccent,

    '--foreground': ink.text,
    '--card-foreground': ink.text,
    '--popover-foreground': ink.text,
    '--secondary-foreground': ink.text,
    '--accent-foreground': ink.text,
    '--muted-foreground': ink.muted,
    '--sidebar-foreground': ink.dim,
    '--sidebar-accent-foreground': ink.text,

    '--primary': brand,
    '--primary-foreground': onBrand,
    '--ring': brand,
    '--sidebar-primary': brand,
    '--sidebar-primary-foreground': onBrand,
    '--sidebar-ring': brand,

    '--border': strokes.border,
    '--sidebar-border': strokes.border,
    '--input': strokes.strong,
    '--destructive': status.red,
    '--chart-1': brand,
    '--chart-2': brand2,
    '--chart-3': status.blue,
    '--chart-4': status.green,
    '--chart-5': status.amber,
    '--brand': brand,
    '--brand-2': brand2,
    '--brand-contrast': onBrand,
    '--bg-deep': surfaces.deep,
    '--text-bright': ink.bright,
    '--text-dim': ink.dim,
    '--text-faint': ink.faint,
    '--text-faintest': ink.faintest,
    '--border-2': strokes.border2,
    '--border-strong': strokes.strong,
    '--green': status.green,
    '--amber': status.amber,
    '--blue': status.blue,
    '--purple': status.purple,
    '--purple-2': status.purple2,
    '--red': status.red,
  };
}

export function themeSwatch(theme: string, mode: ResolvedMode): string {
  const tokens = themeTokens({ accent: DEFAULT_ACCENT, theme, mode });
  return `linear-gradient(135deg, ${tokens['--background']}, ${tokens['--accent']})`;
}

export function accentSwatch(accent: string, mode: ResolvedMode): string {
  const a = ACCENTS[accent] ?? ACCENTS[DEFAULT_ACCENT];
  return `linear-gradient(135deg, ${adaptAccent(a.c, mode)}, ${adaptAccent(a.c2, mode)})`;
}

export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
): ResolvedMode {
  const mode = resolveMode(choice.mode);
  const tokens = themeTokens({
    accent: choice.accent,
    theme: choice.theme,
    mode,
  });

  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }

  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  root.dataset.theme = (THEMES[choice.theme] ?? THEMES[DEFAULT_THEME]).slug;
  root.dataset.mode = mode;

  return mode;
}
