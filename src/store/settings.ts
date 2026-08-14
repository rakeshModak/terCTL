import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { ACCENTS, DEFAULT_ACCENT } from '../constants/accents';
import { DEFAULT_THEME, THEMES } from '../constants/themes';
import { THEME_MODES, type ThemeMode } from '../lib/theme';
import { IS_LINUX } from '../lib/platform';

export interface Settings {
  fontSize: number;
  scrollback: number;
  accent: string;
  theme: string;
  termScheme: string;
  mode: ThemeMode;
  systemTitleBar: boolean;
}

const STORAGE_KEY = 'terctl-settings';

const DEFAULTS: Settings = {
  fontSize: 13,
  scrollback: 10_000,
  accent: DEFAULT_ACCENT,
  theme: DEFAULT_THEME,
  termScheme: 'Mono',
  mode: 'dark',
  systemTitleBar: false,
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
    systemTitleBar:
      typeof v.systemTitleBar === 'boolean'
        ? v.systemTitleBar
        : DEFAULTS.systemTitleBar,
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

/**
 * Linux only. macOS needs `titleBarStyle: "Overlay"` for its traffic lights,
 * and Windows is left exactly as it ships. This is really "any Linux" rather
 * than Ubuntu specifically — the webview user agent cannot name the desktop.
 */
export const CAN_CHOOSE_TITLE_BAR = IS_LINUX;

export const setSystemTitleBarAtom = atom(null, (get, set, on: boolean) => {
  set(settingsAtom, { ...get(settingsAtom), systemTitleBar: on });
});
