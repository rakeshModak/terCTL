import { cn } from '@/lib/utils'
import { ACCENTS } from '../../constants/accents'
import { accentSwatch, type ResolvedMode } from '../../lib/theme'

interface AccentPickerProps {
  value: string
  onChange: (accent: string) => void
  mode: ResolvedMode
}

export function AccentPicker({ value, onChange, mode }: AccentPickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {Object.keys(ACCENTS).map((name) => {
        const active = name === value
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={active}
            onClick={() => onChange(name)}
            style={{ background: accentSwatch(name, mode) }}
            className={cn(
              'size-8 rounded-lg ring-offset-2 ring-offset-background transition-shadow',
              active ? 'ring-2 ring-foreground' : 'ring-1 ring-border hover:ring-input',
            )}
          />
        )
      })}
    </div>
  )
}
