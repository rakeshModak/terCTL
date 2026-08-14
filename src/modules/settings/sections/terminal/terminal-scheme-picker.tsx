import { cn } from '@/lib/utils';
import { TERM_SCHEME_NAMES, termSwatch } from '@/constants/terminal-schemes';
import { useResolvedMode } from '@/hooks/useResolvedMode';

interface TerminalSchemePickerProps {
  value: string;
  onChange: (scheme: string) => void;
}

export default function TerminalSchemePicker({
  value,
  onChange,
}: TerminalSchemePickerProps) {
  const mode = useResolvedMode();
  return (
    <div className="flex flex-wrap gap-2.5">
      {TERM_SCHEME_NAMES.map((name) => {
        const swatch = termSwatch(name, mode);
        const active = name === value;
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-pressed={active}
            onClick={() => onChange(name)}
            style={{ background: swatch.bg }}
            className={cn(
              'flex h-15 w-18 flex-col items-center justify-center gap-0.5 rounded-lg border-2 transition-colors',
              active ? 'border-primary' : 'border-border hover:border-input',
            )}
          >
            <span
              className="font-mono text-base font-bold"
              style={{ color: swatch.fg }}
            >
              Aa
            </span>
            <span
              className="font-mono text-[9px] opacity-80"
              style={{ color: swatch.fg }}
            >
              {name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
