import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FontSizeStepperProps {
  value: number
  onBump: (delta: number) => void
}

export function FontSizeStepper({ value, onBump }: FontSizeStepperProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onBump(-1)}
        aria-label="Decrease font size"
      >
        <Minus />
      </Button>
      <span className="min-w-10 text-center font-mono text-xs tabular-nums">{value}px</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onBump(1)}
        aria-label="Increase font size"
      >
        <Plus />
      </Button>
    </div>
  )
}
