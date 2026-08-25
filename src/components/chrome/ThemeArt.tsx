import { useAtomValue } from 'jotai';
import { settingsAtom } from '../../store/settings';
import { themeArt, type ArtSlot } from '../../constants/theme-art';

export function ThemeArt({
  slot,
  className,
}: {
  slot: ArtSlot;
  className?: string;
}) {
  const theme = useAtomValue(settingsAtom).theme;
  const art = themeArt(theme, slot);
  if (!art) return null;

  const { Scene, opacity } = art;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none [&>svg]:size-full ${className ?? ''}`}
      style={{ opacity }}
    >
      <Scene />
    </div>
  );
}
