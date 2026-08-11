import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useAtomValue } from 'jotai';
import {
  ArrowLeftRight,
  Server,
  Settings,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatSpeed } from '@/lib/format';
import { cn } from '@/lib/utils';
import { transferSummaryAtom } from '@/store/transfer';
import ConnectedSessions from './connected-sessions';
import TerminalZoom from './terminal-zoom';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/hosts', label: 'Hosts', Icon: Server },
  { to: '/sessions', label: 'Terminal', Icon: SquareTerminal },
  { to: '/transfer', label: 'Transfer', Icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const transfer = useAtomValue(transferSummaryAtom);

  return (
    <nav className="border-border bg-sidebar flex w-15 shrink-0 flex-col items-center gap-1.5 border-r py-3">
      {NAV.map(({ to, label, Icon }) => {
        const active = pathname === to;
        const busy = to === '/transfer' && transfer.running > 0;
        return (
          <Tooltip key={to}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => navigate({ to })}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex size-10.5 items-center justify-center rounded-xl transition-colors outline-none',
                    'focus-visible:ring-ring focus-visible:ring-2',
                    active
                      ? 'bg-primary/12 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                />
              }
            >
              <span
                className={cn(
                  'absolute top-2.5 -left-2.5 h-5 w-0.75 rounded-full',
                  active ? 'bg-primary' : 'bg-transparent',
                )}
              />
              <Icon className="size-5" />
              {busy && (
                <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums">
                  {transfer.running}
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {busy
                ? `${label} — ${transfer.running} running · ${formatSpeed(transfer.bytesPerSec)}`
                : label}
            </TooltipContent>
          </Tooltip>
        );
      })}

      <ConnectedSessions />
      <TerminalZoom />
    </nav>
  );
}
