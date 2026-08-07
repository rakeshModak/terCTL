import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

interface SectionHeadingProps {
  children: ReactNode
  /** Optional qualifier, e.g. the name of the group being viewed. */
  detail?: string
  count?: number
}

/** The small uppercase label that introduces the group and host grids. */
export function SectionHeading({ children, detail, count }: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {children}
      </h2>
      {detail && <span className="text-xs font-medium text-foreground">{detail}</span>}
      {count !== undefined && (
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      )}
    </div>
  )
}
