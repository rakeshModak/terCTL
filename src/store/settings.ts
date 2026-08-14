import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { ACCENTS, DEFAULT_ACCENT } from '../constants/accents';
import { DEFAULT_THEME, THEMES } from '../constants/themes';
import { THEME_MODES, type ThemeMode } from '../lib/theme';

export interface Settings {
  fontSize: number;
  /** Rows of terminal history retained above the viewport. */
  scrollback: number;
  accent: string;
  theme: string;
  termScheme: string;
  mode: ThemeMode;
}

const STORAGE_KEY = 'terctl-settings';

const DEFAULTS: Settings = {
  fontSize: 13,
  // xterm's own default is 1000 rows, which drops history within a single
  // build log. 10k matches what GNOME Terminal ships and costs roughly 10 MB
  // per pane at worst — see SCROLLBACK_OPTIONS for the trade-off at the top end.
  scrollback: 10_000,
  accent: DEFAULT_ACCENT,
  theme: DEFAULT_THEME,
  termScheme: 'Mono',
  mode: 'dark',
};

const isThemeMode = (v: unknown): v is ThemeMode =>
  typeof v === 'string' && (THEME_MODES as string[]).includes(v);

export function normalizeSettings(raw: unknown): Settings {
  const src =
    raw && typeof raw === 'object' && 'state' in (raw as object)
      ? (raw as { state?: unknown }).state
      : raw;
  const v = (src && typeof src === 'object' ? src : {}) as Partial<Settings>;
  return {
    fontSize: typeof v.fontSize === 'number' ? v.fontSize : DEFAULTS.fontSize,
    scrollback:
      typeof v.scrollback === 'number' && v.scrollback > 0
        ? v.scrollback
        : DEFAULTS.scrollback,
    accent:
      typeof v.accent === 'string' && ACCENTS[v.accent]
        ? v.accent
        : DEFAULTS.accent,
    theme:
      typeof v.theme === 'string' && THEMES[v.theme] ? v.theme : DEFAULTS.theme,
    termScheme:
      typeof v.termScheme === 'string' ? v.termScheme : DEFAULTS.termScheme,
    mode: isThemeMode(v.mode) ? v.mode : DEFAULTS.mode,
  };
}

export function readStoredSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeSettings(raw === null ? null : JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

const storedSettingsAtom = atomWithStorage<unknown>(
  STORAGE_KEY,
  DEFAULTS,
  undefined,
  {
    getOnInit: true,
  },
);

export const settingsAtom = atom(
  (get): Settings => normalizeSettings(get(storedSettingsAtom)),
  (_get, set, next: Settings) => set(storedSettingsAtom, next),
);

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export const FONT_SIZE_MIN = 9;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = DEFAULTS.fontSize;

export const setFontSizeAtom = atom(null, (get, set, n: number) => {
  set(settingsAtom, {
    ...get(settingsAtom),
    fontSize: clamp(n, FONT_SIZE_MIN, FONT_SIZE_MAX),
  });
});

export const bumpFontSizeAtom = atom(null, (get, set, delta: number) => {
  const s = get(settingsAtom);
  set(settingsAtom, {
    ...s,
    fontSize: clamp(s.fontSize + delta, FONT_SIZE_MIN, FONT_SIZE_MAX),
  });
});

export const resetFontSizeAtom = atom(null, (get, set) => {
  set(settingsAtom, { ...get(settingsAtom), fontSize: FONT_SIZE_DEFAULT });
});

export const SCROLLBACK_OPTIONS = [1_000, 10_000, 50_000, 100_000] as const;

export const setScrollbackAtom = atom(null, (get, set, rows: number) => {
  set(settingsAtom, {
    ...get(settingsAtom),
    scrollback: clamp(Math.round(rows), 500, 500_000),
  });
});

export const setAccentAtom = atom(null, (get, set, accent: string) => {
  set(settingsAtom, {
    ...get(settingsAtom),
    accent: ACCENTS[accent] ? accent : DEFAULT_ACCENT,
  });
});

export const setThemeAtom = atom(null, (get, set, theme: string) => {
  set(settingsAtom, {
    ...get(settingsAtom),
    theme: THEMES[theme] ? theme : DEFAULT_THEME,
  });
});

export const setTermSchemeAtom = atom(null, (get, set, termScheme: string) => {
  set(settingsAtom, { ...get(settingsAtom), termScheme });
});

export const setModeAtom = atom(null, (get, set, mode: ThemeMode) => {
  set(settingsAtom, {
    ...get(settingsAtom),
    mode: isThemeMode(mode) ? mode : DEFAULTS.mode,
  });
});
