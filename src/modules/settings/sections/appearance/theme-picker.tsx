import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEMES } from '@/constants/themes';
import { themeArtScene } from '@/constants/theme-art';
import { themeSwatch, themeTokens, type ResolvedMode } from '@/lib/theme';

interface ThemePickerProps {
  value: string;
  onChange: (theme: string) => void;
  /** The live accent, so a preview shows the artwork the user would get. */
  accent: string;
  mode: ResolvedMode;
}

/**
 * The tokens the scenes paint in. A preview has to override these locally:
 * the artwork reads CSS custom properties, which otherwise resolve to whatever
 * theme is currently applied — so every card would show its scene in the
 * active theme's colours instead of its own.
 */
const ART_TOKENS = [
  '--brand',
  '--brand-2',
  '--background',
  '--sidebar',
  '--text-bright',
  '--text-faintest',
] as const;

function artStyle(theme: string, accent: string, mode: ResolvedMode) {
  const tokens = themeTokens({ accent, theme, mode });
  const style: Record<string, string> = {};
  for (const token of ART_TOKENS) style[token] = tokens[token];
  return style as CSSProperties;
}

export default function ThemePicker({
  value,
  onChange,
  accent,
  mode,
}: ThemePickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.keys(THEMES).map((name) => {
        const active = name === value;
        const Scene = themeArtScene(name, 'workspace');
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            aria-pressed={active}
            className={cn(
              'bg-card w-36 overflow-hidden rounded-xl border-2 text-left transition-colors',
              active ? 'border-primary' : 'border-border hover:border-input',
            )}
          >
            <span
              className="relative block h-16 w-full overflow-hidden"
              style={{
                background: themeSwatch(name, mode),
                ...(Scene ? artStyle(name, accent, mode) : {}),
              }}
            >
              {/* An illustrated theme needs no badge or heading to mark it —
                  its own scene in the swatch says it plainly. */}
              {Scene && (
                <span className="absolute inset-0 opacity-90 [&>svg]:size-full">
                  <Scene />
                </span>
              )}
            </span>
            <span className="flex items-center gap-2 px-3 py-2">
              <span
                className={cn(
                  'text-xs font-semibold',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {name}
              </span>
              {active && <Check className="text-primary ml-auto size-3.5" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
