import { cn } from '@/lib/utils';

/** Marks a session on a host flagged as production. Lives in chrome — pane
 *  headers and tabs — rather than over the terminal, where it hid output. */
export function ProductionChip({ className }: { className?: string }) {
  return (
    <span
      title="Production server — risky commands ask first"
      className={cn(
        'bg-destructive/10 text-destructive inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 font-sans text-[10px] leading-4 font-medium',
        className,
      )}
    >
      <span className="bg-destructive size-1.25 rounded-full" />
      Production
    </span>
  );
}
