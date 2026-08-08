import { Children, Fragment, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface SettingRowProps {
  title: ReactNode
  description?: ReactNode
  /** The control on the trailing edge. */
  action?: ReactNode
}

/** One label/description/control line. Meant to sit inside a SettingRowList. */
export function SettingRow({ title, description, action }: SettingRowProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Groups rows into one card, separating each pair. */
export function SettingRowList({ children }: { children: ReactNode }) {
  // Children.toArray rather than children.filter: React only hands back an
  // array when there is more than one child, so a single-row list would
  // otherwise throw. It also flattens fragments and assigns stable keys.
  const rows = Children.toArray(children)
  return (
    <Card size="sm" className="gap-0 py-1">
      {rows.map((row, i) => (
        <Fragment key={(row as { key?: string }).key ?? i}>
          {i > 0 && <Separator className="mx-4 w-auto" />}
          {row}
        </Fragment>
      ))}
    </Card>
  )
}
