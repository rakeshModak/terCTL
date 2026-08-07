import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { ACCENTS, DEFAULT_ACCENT } from '../constants/accents'
import { DEFAULT_THEME, THEMES } from '../constants/themes'
import { THEME_MODES, type ThemeMode } from '../lib/theme'

export interface Settings {
  fontSize: number
  accent: string
  theme: string
  termScheme: string
  mode: ThemeMode
}

const STORAGE_KEY = 'terctl-settings'

const DEFAULTS: Settings = {
  fontSize: 13,
  accent: DEFAULT_ACCENT,
  theme: DEFAULT_THEME,
  termScheme: 'Mono',
  mode: 'dark',
}

const isThemeMode = (v: unknown): v is ThemeMode =>
  typeof v === 'string' && (THEME_MODES as string[]).includes(v)


export function normalizeSettings(raw: unknown): Settings {
  const src =
    raw && typeof raw === 'object' && 'state' in (raw as object)
      ? (raw as { state?: unknown }).state
      : raw
  const v = (src && typeof src === 'object' ? src : {}) as Partial<Settings>
  return {
    fontSize: typeof v.fontSize === 'number' ? v.fontSize : DEFAULTS.fontSize,
    accent: typeof v.accent === 'string' && ACCENTS[v.accent] ? v.accent : DEFAULTS.accent,
    theme: typeof v.theme === 'string' && THEMES[v.theme] ? v.theme : DEFAULTS.theme,
    termScheme: typeof v.termScheme === 'string' ? v.termScheme : DEFAULTS.termScheme,
    mode: isThemeMode(v.mode) ? v.mode : DEFAULTS.mode,
  }
}

export function readStoredSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeSettings(raw === null ? null : JSON.parse(raw))
  } catch {
    return DEFAULTS
  }
}

const storedSettingsAtom = atomWithStorage<unknown>(STORAGE_KEY, DEFAULTS, undefined, {
  getOnInit: true,
})

export const settingsAtom = atom(
  (get): Settings => normalizeSettings(get(storedSettingsAtom)),
  (_get, set, next: Settings) => set(storedSettingsAtom, next),
)

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export const setFontSizeAtom = atom(null, (get, set, n: number) => {
  set(settingsAtom, { ...get(settingsAtom), fontSize: clamp(n, 9, 24) })
})

export const bumpFontSizeAtom = atom(null, (get, set, delta: number) => {
  const s = get(settingsAtom)
  set(settingsAtom, { ...s, fontSize: clamp(s.fontSize + delta, 9, 24) })
})

export const setAccentAtom = atom(null, (get, set, accent: string) => {
  set(settingsAtom, { ...get(settingsAtom), accent: ACCENTS[accent] ? accent : DEFAULT_ACCENT })
})

export const setThemeAtom = atom(null, (get, set, theme: string) => {
  set(settingsAtom, { ...get(settingsAtom), theme: THEMES[theme] ? theme : DEFAULT_THEME })
})

export const setTermSchemeAtom = atom(null, (get, set, termScheme: string) => {
  set(settingsAtom, { ...get(settingsAtom), termScheme })
})

export const setModeAtom = atom(null, (get, set, mode: ThemeMode) => {
  set(settingsAtom, { ...get(settingsAtom), mode: isThemeMode(mode) ? mode : DEFAULTS.mode })
})
