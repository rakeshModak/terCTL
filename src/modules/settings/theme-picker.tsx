import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEMES } from '../../constants/themes';
import { themeSwatch, type ResolvedMode } from '../../lib/theme';

interface ThemePickerProps {
  value: string;
  onChange: (theme: string) => void;
  mode: ResolvedMode;
}

export default function ThemePicker({
  value,
  onChange,
  mode,
}: ThemePickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.keys(THEMES).map((name) => {
        const active = name === value;
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
              className="block h-16 w-full"
              style={{ background: themeSwatch(name, mode) }}
            />
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
