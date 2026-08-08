import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatusOverlayProps {
  children: ReactNode
  /** Tints the card border for the connection-failure case. */
  variant?: 'default' | 'destructive'
}

/**
 * Full-bleed cover over the terminal area, used for connecting, reconnecting
 * and connection-failure states. Opaque so terminals underneath never bleed
 * through mid-transition.
 */
export default function StatusOverlay({ children, variant = 'default' }: StatusOverlayProps) {
  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center bg-background">
      <Card
        className={cn(
          'max-w-105 animate-[rise_0.25s_ease_both] items-center gap-3 px-10 py-8 text-center',
          variant === 'destructive' && 'ring-destructive/35',
        )}
      >
        {children}
      </Card>
    </div>
  )
}
