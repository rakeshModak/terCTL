import type { ReactNode } from 'react';
import { formatKb } from '@/lib/format';

/** Same thresholds the metrics panel's meters switch colour at. */
function usageColor(pct: number): string {
  if (pct < 60) return 'var(--brand)';
  if (pct < 85) return 'var(--amber)';
  return 'var(--red)';
}

interface DiskOverviewProps {
  usedKb: number;
  totalKb: number;
  /** Cleanup preview: the part of "used" the current selection would free,
      drawn as a lighter tail on the meter. */
  freeingKb?: number;
  action?: ReactNode;
}

/** The headline card at the top of the dialog: how full the disk is, and in
    cleanup, how full it would be afterwards. */
export default function DiskOverview({
  usedKb,
  totalKb,
  freeingKb = 0,
  action,
}: DiskOverviewProps) {
  const pct = totalKb ? (usedKb / totalKb) * 100 : 0;
  const freeing = Math.min(freeingKb, usedKb);
  const afterPct = totalKb ? ((usedKb - freeing) / totalKb) * 100 : 0;
  const previewing = freeing > 0;
  const color = usageColor(previewing ? afterPct : pct);

  return (
    <div className="bg-muted/35 border-border flex items-center gap-4 rounded-xl border px-4 py-2.5">
      {/* The label sits on the number's baseline rather than under it, so
          the card stays one line tall. */}
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span className="font-heading text-2xl leading-none font-semibold tabular-nums">
          {Math.round(previewing ? afterPct : pct)}%
        </span>
        <span className="text-muted-foreground text-[11px]">
          {previewing ? 'after' : 'used'}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="bg-foreground/10 relative h-2 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          {/* What stays used, then what the cleanup would free: the tail is
              the same colour at low strength, so the eye reads it as "this
              part goes away" without needing a legend. */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: color,
              opacity: 0.28,
            }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.min(previewing ? afterPct : pct, 100)}%`,
              background: color,
            }}
          />
        </div>
        <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 text-xs tabular-nums">
          {previewing ? (
            <>
              <span>
                <span className="text-foreground font-medium">
                  {Math.round(pct)}% → {Math.round(afterPct)}%
                </span>
              </span>
              <span>frees about {formatKb(freeing)}</span>
            </>
          ) : (
            <>
              <span>
                <span className="text-foreground font-medium">
                  {formatKb(usedKb)}
                </span>{' '}
                used
              </span>
              <span>{formatKb(Math.max(totalKb - usedKb, 0))} free</span>
              <span>{formatKb(totalKb)} total</span>
            </>
          )}
        </div>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
