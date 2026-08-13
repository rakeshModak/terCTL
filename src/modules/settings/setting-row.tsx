import { Children, Fragment, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface SettingRowProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export default function SettingRow({
  title,
  description,
  action,
}: SettingRowProps) {
  return (
    <div className="flex items-center gap-4 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <div className="text-muted-foreground mt-0.5 text-xs">
            {description}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Groups rows into one card, separating each pair. */
export function SettingRowList({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <Card size="sm" className="gap-0 py-1">
      {rows.map((row, i) => (
        <Fragment key={(row as { key?: string }).key ?? i}>
          {i > 0 && <Separator className="mx-4 w-auto" />}
          {row}
        </Fragment>
      ))}
    </Card>
  );
}
