import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { ACCENTS } from '../constants/accents'
import { THEMES } from '../constants/themes'

export interface Settings {
  fontSize: number
  accent: string
  theme: string
  termScheme: string
}

const DEFAULTS: Settings = { fontSize: 13, accent: 'Chrome', theme: 'Carbon', termScheme: 'Mono' }

// Raw persisted value. Typed as unknown because localStorage may hold a legacy
// shape (the old zustand-persist wrapper stored the state under `.state`).
const storedSettingsAtom = atomWithStorage<unknown>('terctl-settings', DEFAULTS)

// Public settings — always a complete, valid Settings object. Missing/legacy
// fields fall back to defaults so nothing ever reads as undefined; writing back
// normalizes the stored value to the clean shape.
export const settingsAtom = atom(
  (get): Settings => {
    const raw = get(storedSettingsAtom)
    // Unwrap the old zustand-persist envelope ({ state, version }) if present.
    const src =
      raw && typeof raw === 'object' && 'state' in (raw as object)
        ? (raw as { state?: unknown }).state
        : raw
    const v = (src && typeof src === 'object' ? src : {}) as Partial<Settings>
    return {
      fontSize: typeof v.fontSize === 'number' ? v.fontSize : DEFAULTS.fontSize,
      accent: typeof v.accent === 'string' ? v.accent : DEFAULTS.accent,
      theme: typeof v.theme === 'string' ? v.theme : DEFAULTS.theme,
      termScheme: typeof v.termScheme === 'string' ? v.termScheme : DEFAULTS.termScheme,
    }
  },
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
  set(settingsAtom, { ...get(settingsAtom), accent: ACCENTS[accent] ? accent : 'Chrome' })
})

export const setThemeAtom = atom(null, (get, set, theme: string) => {
  set(settingsAtom, { ...get(settingsAtom), theme: THEMES[theme] !== undefined ? theme : 'Carbon' })
})

export const setTermSchemeAtom = atom(null, (get, set, termScheme: string) => {
  set(settingsAtom, { ...get(settingsAtom), termScheme })
})
