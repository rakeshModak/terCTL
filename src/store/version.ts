import { atom } from 'jotai';
import { getVersion } from '@tauri-apps/api/app';

// The app's real version, read from Tauri (tauri.conf.json → baked in at build).
// Loaded once at startup so the UI never shows a hardcoded version.
export const appVersionAtom = atom('');

export const loadAppVersionAtom = atom(null, async (_get, set) => {
  try {
    set(appVersionAtom, await getVersion());
  } catch {
    /* not running inside Tauri (e.g. plain web dev) */
  }
});
