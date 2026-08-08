import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  ArrowLeftRight,
  KeyRound,
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
import { cn } from '@/lib/utils';
import ConnectedSessions from './connected-sessions';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/hosts', label: 'Hosts', Icon: Server },
  { to: '/sessions', label: 'Terminal', Icon: SquareTerminal },
  { to: '/transfer', label: 'Transfer', Icon: ArrowLeftRight },
  { to: '/keys', label: 'Keys', Icon: KeyRound },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  return (
    <nav className="border-border bg-sidebar flex w-15 shrink-0 flex-col items-center gap-1.5 border-r py-3">
      {NAV.map(({ to, label, Icon }) => {
        const active = pathname === to;
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
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}

      <ConnectedSessions />
    </nav>
  );
}
