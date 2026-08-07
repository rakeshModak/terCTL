import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { ACCENTS, DEFAULT_ACCENT } from '../constants/accents'
import { DEFAULT_THEME, THEMES } from '../constants/themes'

export interface Settings {
  fontSize: number
  accent: string
  theme: string
  termScheme: string
}

const STORAGE_KEY = 'terctl-settings'

const DEFAULTS: Settings = {
  fontSize: 13,
  accent: DEFAULT_ACCENT,
  theme: DEFAULT_THEME,
  termScheme: 'Mono',
}

/**
 * Coerce whatever is in storage into a complete, valid Settings object.
 * Missing or legacy fields fall back to defaults so nothing ever reads as
 * undefined, and an unknown accent/theme name (e.g. one removed from the
 * config) resolves to the default rather than leaving the UI uncolored.
 */
export function normalizeSettings(raw: unknown): Settings {
  // Unwrap the old zustand-persist envelope ({ state, version }) if present.
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
  }
}

/**
 * Read the persisted settings straight from localStorage, outside of jotai.
 * Used by main.tsx to paint the saved theme before the first React render.
 */
export function readStoredSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeSettings(raw === null ? null : JSON.parse(raw))
  } catch {
    // Corrupt JSON or storage blocked — fall back rather than fail to boot.
    return DEFAULTS
  }
}

// Raw persisted value. Typed as unknown because localStorage may hold a legacy
// shape (the old zustand-persist wrapper stored the state under `.state`).
//
// getOnInit reads storage during atom initialization instead of on first
// subscribe. Without it the first render uses DEFAULTS and only then swaps to
// the saved value, which flashes the default accent on every launch.
const storedSettingsAtom = atomWithStorage<unknown>(STORAGE_KEY, DEFAULTS, undefined, {
  getOnInit: true,
})

// Public settings — always a complete, valid Settings object. Writing back
// normalizes the stored value to the clean shape.
export const settingsAtom = atom(
  (get): Settings => normalizeSettings(get(storedSettingsAtom)),
  (_get, set, next: Settings) => set(storedSettingsAtom, next),
)

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// Write-only action atoms — mirror the old store's validated setters.
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
