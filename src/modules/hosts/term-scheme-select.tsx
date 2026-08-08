import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TERM_SWATCH } from '../../constants/terminal-schemes';

interface TermSchemeSelectProps {
  /** null = inherit the global terminal scheme. */
  value: string | null;
  onChange: (value: string | null) => void;
}

/** Sentinel for "inherit": Base UI treats null as "nothing selected". */
const INHERIT = '__inherit__';

function Swatch({ scheme }: { scheme: string | null }) {
  const sw = scheme ? TERM_SWATCH[scheme] : undefined;
  if (!sw) {
    return (
      <span className="bg-muted ring-border size-4 shrink-0 rounded-sm ring-1" />
    );
  }
  return (
    <span
      className="ring-border flex h-4 w-5.5 shrink-0 items-center justify-center rounded-sm font-mono text-[9px] ring-1"
      style={{ background: sw.bg, color: sw.fg }}
    >
      Aa
    </span>
  );
}

/** Per-host terminal color scheme, with a live text-on-background swatch. */
export default function TermSchemeSelect({
  value,
  onChange,
}: TermSchemeSelectProps) {
  const options = [
    { value: INHERIT, label: 'Use global default' },
    ...Object.keys(TERM_SWATCH).map((name) => ({ value: name, label: name })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="host-term-scheme">Terminal color (this host)</Label>
      <Select
        items={options}
        value={value ?? INHERIT}
        onValueChange={(next: string | null) =>
          onChange(!next || next === INHERIT ? null : next)
        }
      >
        {/* h-9 to match Input; same modifier chain so it beats the h-8 default. */}
        <SelectTrigger
          id="host-term-scheme"
          className="w-full data-[size=default]:h-9"
        >
          <SelectValue>
            {(selected: string) => (
              <>
                <Swatch scheme={selected === INHERIT ? null : selected} />
                {selected === INHERIT ? 'Use global default' : selected}
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <Swatch scheme={option.value === INHERIT ? null : option.value} />
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
