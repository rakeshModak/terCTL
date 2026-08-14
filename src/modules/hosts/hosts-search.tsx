import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { PALETTE_HINT } from '@/lib/platform';

interface HostsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function HostsSearch({ value, onChange }: HostsSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'k')
        return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <InputGroup className="mb-5">
      <InputGroupAddon>
        <Search className="text-muted-foreground" />
      </InputGroupAddon>

      <InputGroupInput
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Search hosts by name, address or tag…"
        aria-label="Search hosts"
      />
      <InputGroupAddon align="inline-end">
        {value ? (
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
          >
            <X />
          </InputGroupButton>
        ) : (
          <kbd className="bg-muted text-muted-foreground pointer-events-none px-1.5 py-0.5 font-mono text-2xs font-medium">
            {PALETTE_HINT}
          </kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}
