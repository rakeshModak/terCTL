import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { PALETTE_HINT } from '../../lib/platform'

interface HostsSearchProps {
  value: string
  onChange: (value: string) => void
}

export function HostsSearch({ value, onChange }: HostsSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <InputGroup className="mb-7 h-11 rounded-xl border-transparent bg-card ring-1 ring-foreground/10 dark:bg-card">
      <InputGroupAddon className="pl-3">
        <Search className="text-muted-foreground" />
      </InputGroupAddon>

      <InputGroupInput
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder="Search hosts by name, address or tag…"
        aria-label="Search hosts"
        className="h-11"
      />

      <InputGroupAddon align="inline-end" className="pr-2.5">
        <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          {PALETTE_HINT}
        </kbd>
      </InputGroupAddon>
    </InputGroup>
  )
}
