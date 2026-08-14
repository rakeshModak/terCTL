import { atom } from 'jotai';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error';

export const updateStatusAtom = atom<UpdateStatus>('idle');
export const availableUpdateAtom = atom<Update | null>(null);
export const updateProgressAtom = atom(0); // 0..100
export const updateErrorAtom = atom<string | null>(null);
// Set when the user hits "Later" — hides the banner until the next check/restart.
export const updateDismissedAtom = atom(false);

// Check GitHub for a newer signed release. Silent: only surfaces the banner when
// one is found. Used both on startup and by the Settings button.
export const checkForUpdateAtom = atom(null, async (_get, set) => {
  set(updateStatusAtom, 'checking');
  set(updateErrorAtom, null);
  try {
    const update = await check();
    if (update) {
      set(availableUpdateAtom, update);
      set(updateDismissedAtom, false);
      set(updateStatusAtom, 'available');
    } else {
      set(availableUpdateAtom, null);
      set(updateStatusAtom, 'uptodate');
    }
  } catch (e) {
    set(updateErrorAtom, String(e));
    set(updateStatusAtom, 'error');
  }
});

// Download + install the pending update, then relaunch onto the new version.
export const installUpdateAtom = atom(null, async (get, set) => {
  const update = get(availableUpdateAtom);
  if (!update) return;
  set(updateStatusAtom, 'downloading');
  set(updateProgressAtom, 0);
  try {
    let total = 0;
    let received = 0;
    await update.downloadAndInstall((e) => {
      switch (e.event) {
        case 'Started':
          total = e.data.contentLength ?? 0;
          break;
        case 'Progress':
          received += e.data.chunkLength;
          if (total > 0)
            set(
              updateProgressAtom,
              Math.min(100, Math.round((received / total) * 100)),
            );
          break;
        case 'Finished':
          set(updateProgressAtom, 100);
          break;
      }
    });
    await relaunch();
  } catch (e) {
    set(updateErrorAtom, String(e));
    set(updateStatusAtom, 'error');
  }
});
