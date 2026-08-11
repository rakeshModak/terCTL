import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBytes, formatEta, formatSpeed } from '@/lib/format';
import type { TransferItemType } from '@/types/transfer';

interface TransferProgressPanelProps {
  transfers: TransferItemType[];
  onCancel: (id: string) => void;
  onClear: () => void;
}

const isRunning = (t: TransferItemType) =>
  t.state === 'queued' || t.state === 'active';

const BAR_TONE: Record<TransferItemType['state'], string> = {
  queued: 'bg-muted-foreground/40',
  active: 'bg-primary',
  done: 'bg-chart-4',
  cancelled: 'bg-muted-foreground/50',
  error: 'bg-destructive',
};

function StateIcon({ state }: { state: TransferItemType['state'] }) {
  if (state === 'done')
    return <CircleCheck className="text-chart-4 size-3.5 shrink-0" />;
  if (state === 'error')
    return <CircleAlert className="text-destructive size-3.5 shrink-0" />;
  if (state === 'cancelled')
    return <CircleSlash className="text-muted-foreground size-3.5 shrink-0" />;
  return null;
}

function TransferRow({
  transfer,
  onCancel,
}: {
  transfer: TransferItemType;
  onCancel: (id: string) => void;
}) {
  const { total, transferred, state } = transfer;
  const done = state === 'done';
  const known = total > 0;
  const pct = done ? 100 : known ? Math.min(100, (transferred / total) * 100) : 0;
  const remaining = known && transfer.bytesPerSec > 0
    ? (total - transferred) / transfer.bytesPerSec
    : null;

  const detail =
    state === 'error'
      ? (transfer.error ?? 'Transfer failed')
      : state === 'cancelled'
        ? `Cancelled at ${formatBytes(transferred)}`
        : state === 'queued'
          ? 'Waiting…'
          : [
              known
                ? `${formatBytes(transferred)} / ${formatBytes(total)}`
                : formatBytes(transferred),
              !done && formatSpeed(transfer.bytesPerSec),
              !done && remaining !== null && `${formatEta(remaining)} left`,
            ]
              .filter(Boolean)
              .join(' · ');

  const DirectionIcon = transfer.direction === 'upload' ? ArrowUp : ArrowDown;

  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <DirectionIcon className="text-muted-foreground size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">{transfer.name}</span>
          <StateIcon state={state} />
          <div className="flex-1" />
          <span
            className={cn(
              'shrink-0 text-[11px] tabular-nums',
              state === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
            title={state === 'error' ? transfer.error : transfer.destDir}
          >
            {known && !done && state === 'active' ? `${Math.round(pct)}%` : ''}
          </span>
        </div>
        <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full',
              BAR_TONE[state],
              state === 'active' && known && 'transition-[width] duration-200',
              state === 'active' && !known && 'w-1/3 animate-pulse',
            )}
            style={known || done ? { width: `${pct}%` } : undefined}
          />
        </div>
        <p
          className={cn(
            'mt-1 truncate text-[11px] tabular-nums',
            state === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {detail}
        </p>
      </div>
      {isRunning(transfer) && (
        <Button
          variant="ghost"
          size="icon-xs"
          title="Cancel transfer"
          onClick={() => onCancel(transfer.id)}
        >
          <X />
        </Button>
      )}
    </li>
  );
}

export default function TransferProgressPanel({
  transfers,
  onCancel,
  onClear,
}: TransferProgressPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (transfers.length === 0) return null;

  const running = transfers.filter(isRunning);
  const finished = transfers.length - running.length;
  const speed = running.reduce((sum, t) => sum + t.bytesPerSec, 0);

  const summary = running.length
    ? `Transferring ${finished + 1} of ${transfers.length} · ${formatSpeed(speed)}`
    : `${transfers.length} transfer${transfers.length === 1 ? '' : 's'} finished`;

  return (
    <section className="border-border bg-sidebar flex max-h-64 shrink-0 flex-col border-t">
      <header className="flex shrink-0 items-center gap-2 px-4 py-2">
        <h2 className="text-xs font-semibold">Transfers</h2>
        <span className="text-muted-foreground truncate text-[11px] tabular-nums">
          {summary}
        </span>
        <div className="flex-1" />
        {finished > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear finished
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          title={collapsed ? 'Show transfers' : 'Hide transfers'}
          onClick={() => setCollapsed((v) => !v)}
        >
          <ChevronDown
            className={cn('transition-transform', collapsed && 'rotate-180')}
          />
        </Button>
      </header>
      {!collapsed && (
        <ul className="divide-border min-h-0 divide-y overflow-y-auto">
          {transfers.map((t) => (
            <TransferRow key={t.id} transfer={t} onCancel={onCancel} />
          ))}
        </ul>
      )}
    </section>
  );
}
