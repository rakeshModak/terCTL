import { useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ratePassphrase,
  type PassphraseStrength,
} from '@/modules/settings/sections/import-export/passphrase-strength';

const METER_COLORS = [
  'bg-muted',
  'bg-destructive',
  'bg-chart-4',
  'bg-chart-2',
  'bg-chart-2',
];

interface PassphraseFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  reveal: boolean;
  onToggleReveal: () => void;
  showStrength?: boolean;
  error?: string | null;
  autoFocus?: boolean;
}

export default function PassphraseField({
  label,
  value,
  onChange,
  reveal,
  onToggleReveal,
  showStrength = false,
  error,
  autoFocus,
}: PassphraseFieldProps) {
  const id = useId();
  const strength: PassphraseStrength | null = showStrength
    ? ratePassphrase(value)
    : null;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type={reveal ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete="new-password"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleReveal}
          aria-label={reveal ? 'Hide passphrase' : 'Show passphrase'}
        >
          {reveal ? <EyeOff /> : <Eye />}
        </Button>
      </div>

      {strength && value.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  step <= strength.score
                    ? METER_COLORS[strength.score]
                    : 'bg-muted',
                )}
              />
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium">
              {strength.label}
            </span>{' '}
            — {strength.hint}
          </p>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
