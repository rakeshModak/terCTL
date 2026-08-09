import type { ITheme } from '@xterm/xterm';
import {
  ensureContrast,
  hexToHsl,
  hslToHex,
  luminance,
  mixHue,
} from '../lib/color';
import type { ResolvedMode } from '../lib/theme';


const ANSI_HUES = {
  red: 2,
  green: 138,
  yellow: 45,
  blue: 224,
  magenta: 300,
  cyan: 186,
} as const;

type AnsiName = keyof typeof ANSI_HUES;


const HUE_PULL = 0.16;

const NORMAL = { s: 0.6, l: 0.6 };
const BRIGHT = { s: 0.68, l: 0.73 };
const LIGHT_NORMAL = { s: 0.7, l: 0.4 };
const LIGHT_BRIGHT = { s: 0.88, l: 0.3 };

const LIGHT_BG_LUMINANCE = 0.35;

const MIN_CONTRAST = 4.5;


const LIGHT_BRIGHT_MIN_CONTRAST = 7;

interface SchemeSpec {
  bg: string;
  fg: string;
  cursor: string;
  selection: string;
}


const TINT_REFERENCE_SATURATION = 0.35;

function ansiRamp(spec: SchemeSpec): Record<string, string> {
  const fgHsl = hexToHsl(spec.fg);
  const bgHsl = hexToHsl(spec.bg);
  const onLight = luminance(spec.bg) > LIGHT_BG_LUMINANCE;
  const pull = HUE_PULL * Math.min(fgHsl.s / TINT_REFERENCE_SATURATION, 1);

  const build = (
    name: AnsiName,
    tone: { s: number; l: number },
    floor: number,
  ) => {
    const h = mixHue(ANSI_HUES[name], fgHsl.h, pull);
    return ensureContrast({ h, s: tone.s, l: tone.l }, spec.bg, floor);
  };

  const ramp: Record<string, string> = {};
  for (const name of Object.keys(ANSI_HUES) as AnsiName[]) {
    ramp[name] = build(name, onLight ? LIGHT_NORMAL : NORMAL, MIN_CONTRAST);
    // "brightRed", "brightGreen", ...
    ramp[`bright${name[0].toUpperCase()}${name.slice(1)}`] = build(
      name,
      onLight ? LIGHT_BRIGHT : BRIGHT,
      onLight ? LIGHT_BRIGHT_MIN_CONTRAST : MIN_CONTRAST,
    );
  }

  if (onLight) {
    ramp.black = hslToHex({
      h: bgHsl.h,
      s: Math.min(bgHsl.s, 0.2),
      l: Math.max(fgHsl.l - 0.08, 0.08),
    });
    ramp.brightBlack = ensureContrast(
      { h: bgHsl.h, s: Math.min(bgHsl.s, 0.16), l: 0.62 },
      spec.bg,
      3, // dimmed-on-purpose text: a lower floor than the meaningful colors
    );
    ramp.white = hslToHex({ h: bgHsl.h, s: Math.min(bgHsl.s, 0.14), l: 0.8 });
    ramp.brightWhite = hslToHex({
      h: bgHsl.h,
      s: Math.min(bgHsl.s, 0.1),
      l: 0.92,
    });
    return ramp;
  }

  ramp.black = hslToHex({
    h: bgHsl.h,
    s: Math.min(bgHsl.s, 0.2),
    l: Math.min(bgHsl.l + 0.1, 0.3),
  });
  ramp.brightBlack = ensureContrast(
    { h: bgHsl.h, s: Math.min(bgHsl.s, 0.16), l: 0.42 },
    spec.bg,
    3,
  );
  ramp.white = spec.fg;
  ramp.brightWhite = hslToHex({
    ...fgHsl,
    l: Math.min(fgHsl.l + 0.16, 0.96),
  });

  return ramp;
}

function spec(
  bg: string,
  fg: string,
  cursor: string,
  selection: string,
): SchemeSpec {
  return { bg, fg, cursor, selection };
}

function scheme(s: SchemeSpec): ITheme {
  return {
    background: s.bg,
    foreground: s.fg,
    cursor: s.cursor,
    cursorAccent: s.bg,
    selectionBackground: s.selection,
    ...ansiRamp(s),
  };
}


const SCHEME_SPECS: Record<string, Record<ResolvedMode, SchemeSpec>> = {
  TerCTL: {
    dark: spec('#0a0c10', '#cdd2da', '#8b95a6', '#242a34'),
    light: spec('#f6f8fa', '#2b323d', '#5a6478', '#d5dce7'),
  },
  Snow: {
    dark: spec('#0a0c10', '#dfe2e6', '#c7ccd2', '#242a34'),
    light: spec('#ffffff', '#23272d', '#4d535b', '#dadee4'),
  },
  Matrix: {
    dark: spec('#070b08', '#6bb894', '#5aa886', '#132a20'),
    light: spec('#f2f8f4', '#14512f', '#1c7a49', '#cbe8da'),
  },
  Amber: {
    dark: spec('#0d0a05', '#cba066', '#c79a5c', '#33290f'),
    light: spec('#fcf8ef', '#57400f', '#8a6413', '#f0e1bd'),
  },
  Ice: {
    dark: spec('#08111a', '#a6c2d8', '#6a95c0', '#122842'),
    light: spec('#f2f7fc', '#1d3a5c', '#2e6cb0', '#cfe0f2'),
  },
  Neon: {
    dark: spec('#0a0810', '#5fadbd', '#4fa2b5', '#0f2630'),
    light: spec('#f2f9fb', '#114a58', '#12768c', '#c9e7ef'),
  },
  Grape: {
    dark: spec('#0f0a16', '#b6a2d2', '#9580c0', '#241833'),
    light: spec('#f8f5fc', '#3b2a58', '#6a4aa6', '#e1d7f1'),
  },
  Rose: {
    dark: spec('#140a10', '#d3a6b4', '#c1737f', '#33161f'),
    light: spec('#fdf5f8', '#5a2432', '#a44055', '#f3d8e0'),
  },
  Mono: {
    dark: spec('#0d0d0d', '#a8a8a8', '#c4c4c4', '#262626'),
    light: spec('#fafafa', '#333333', '#5a5a5a', '#dcdcdc'),
  },
};

export const TERM_SCHEME_NAMES = Object.keys(SCHEME_SPECS);

export function hasTermScheme(name: string | null | undefined): boolean {
  return !!name && name in SCHEME_SPECS;
}

export const DEFAULT_TERM_SCHEME = 'TerCTL';


const themeCache = new Map<string, ITheme>();

export function termTheme(name: string, mode: ResolvedMode): ITheme {
  const key = `${name}:${mode}`;
  const cached = themeCache.get(key);
  if (cached) return cached;

  const specs = SCHEME_SPECS[name] ?? SCHEME_SPECS[DEFAULT_TERM_SCHEME];
  const built = scheme(specs[mode]);
  themeCache.set(key, built);
  return built;
}

/** Background/foreground pair for the Settings previews. */
export function termSwatch(
  name: string,
  mode: ResolvedMode,
): { bg: string; fg: string } {
  const specs = SCHEME_SPECS[name] ?? SCHEME_SPECS[DEFAULT_TERM_SCHEME];
  const { bg, fg } = specs[mode];
  return { bg, fg };
}

export const terminalFontFamily =
  '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
