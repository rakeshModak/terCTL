import { ACCENTS, DEFAULT_ACCENT } from '../constants/accents';
import {
  DEFAULT_THEME,
  THEMES,
  type ThemePalette,
  type ThemeSurfaces,
} from '../constants/themes';
import { ensureContrast, hexToHsl, readableOn } from './color';

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


const FLOORS: Record<keyof Ink, number> = {
  text: 11,
  bright: 8.5,
  dim: 6.0,
  muted: 4.8,
  faint: 3.6,
  faintest: 2.6,
};

const DARK_INK_LIGHTNESS: Record<keyof Ink, number> = {
  text: 0.93,
  bright: 0.85,
  dim: 0.68,
  muted: 0.58,
  faint: 0.47,
  faintest: 0.39,
};

const LIGHT_INK_LIGHTNESS: Record<keyof Ink, number> = {
  text: 0.13,
  bright: 0.22,
  dim: 0.33,
  muted: 0.41,
  faint: 0.5,
  faintest: 0.59,
};

const DARK_INK_HUE = 218;
const DARK_INK_SAT = 0.11;
const LIGHT_INK_SAT = 0.12;


function inkRamp(surfaces: ThemeSurfaces, mode: ResolvedMode): Ink {
  const dark = mode === 'dark';
  const hue = dark ? DARK_INK_HUE : hexToHsl(surfaces.sidebarAccent).h;
  const s = dark ? DARK_INK_SAT : LIGHT_INK_SAT;
  const lightness = dark ? DARK_INK_LIGHTNESS : LIGHT_INK_LIGHTNESS;

  const rung = (key: keyof Ink) =>
    ensureContrast({ h: hue, s, l: lightness[key] }, surfaces.card, FLOORS[key]);

  return {
    text: rung('text'),
    bright: rung('bright'),
    dim: rung('dim'),
    muted: rung('muted'),
    faint: rung('faint'),
    faintest: rung('faintest'),
  };
}

const DARK_STROKES: Strokes = {
  border: 'rgba(255, 255, 255, 0.09)',
  border2: 'rgba(255, 255, 255, 0.13)',
  strong: 'rgba(255, 255, 255, 0.2)',
};

const LIGHT_STROKES: Strokes = {
  border: 'rgba(15, 23, 42, 0.12)',
  border2: 'rgba(15, 23, 42, 0.16)',
  strong: 'rgba(15, 23, 42, 0.26)',
};

const DARK_STATUS: Status = {
  green: '#3ddc97',
  amber: '#f5b544',
  blue: '#5b9dff',
  purple: '#8b5bff',
  purple2: '#a17fff',
  red: '#ff5f56',
};

const LIGHT_STATUS: Status = {
  green: '#0a7f57',
  amber: '#8a5a06',
  blue: '#1d5fd6',
  purple: '#6d28d9',
  purple2: '#5b21b6',
  red: '#c92a2a',
};

function surfacesFor(p: ThemePalette, mode: ResolvedMode): ThemeSurfaces {
  return mode === 'dark' ? p.dark : p.light;
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
  const a = ACCENTS[accent] ?? ACCENTS[DEFAULT_ACCENT];
  const dark = mode === 'dark';

  const surfaces = surfacesFor(p, mode);
  const ink = inkRamp(surfaces, mode);
  const strokes = dark ? DARK_STROKES : LIGHT_STROKES;
  const status = dark ? DARK_STATUS : LIGHT_STATUS;

  const { c: brand, c2: brand2 } = dark ? a.dark : a.light;
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
  const p = THEMES[theme] ?? THEMES[DEFAULT_THEME];
  const s = surfacesFor(p, mode);
  return `linear-gradient(135deg, ${s.background}, ${s.sidebarAccent})`;
}

export function accentSwatch(accent: string, mode: ResolvedMode): string {
  const a = ACCENTS[accent] ?? ACCENTS[DEFAULT_ACCENT];
  const { c, c2 } = mode === 'dark' ? a.dark : a.light;
  return `linear-gradient(135deg, ${c}, ${c2})`;
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
