import { useSyncExternalStore } from 'react';
import { useAtomValue } from 'jotai';
import { getSystemMode, watchSystemMode, type ResolvedMode } from '@/lib/theme';
import { settingsAtom } from '@/store/settings';

export function useResolvedMode(): ResolvedMode {
  const { mode } = useAtomValue(settingsAtom);
  const systemMode = useSyncExternalStore(
    watchSystemMode,
    getSystemMode,
    () => 'dark' as const,
  );
  return mode === 'system' ? systemMode : mode;
}
