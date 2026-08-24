import { useAtomValue } from 'jotai';
import { settingsAtom } from '../../store/settings';
import { themeArt, type ArtSlot } from '../../constants/theme-art';

/**
 * Mounts an illustrated theme's artwork into one surface. Renders nothing for
 * themes that carry no art, so the plain themes are untouched.
 *
 * The host element must be `relative isolate`. `isolate` matters: the layer
 * renders at -z-10 so it stays beneath the host's own in-flow children (an
 * absolutely-positioned layer otherwise paints *over* non-positioned siblings
 * like nav icons and tab pills), and the isolation keeps that -z-10 from
 * escaping past the host's background. The layer is inert, so it never
 * intercepts a click meant for the controls above it.
 */
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
