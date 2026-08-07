import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

interface SectionHeadingProps {
  children: ReactNode
  /** Optional qualifier, e.g. the name of the group being viewed. */
  detail?: string
  count?: number
  /** Pushed to the trailing edge of the row — a tally, a link, a control. */
  trailing?: ReactNode
}

/** The small uppercase label that introduces each section of the page. */
export function SectionHeading({ children, detail, count, trailing }: SectionHeadingProps) {
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
      {trailing && <div className="ml-auto text-xs text-muted-foreground">{trailing}</div>}
    </div>
  )
}
