import { useNavigate } from '@tanstack/react-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  activeSessionIdAtom,
  sessionsAtom,
  setActiveSessionAtom,
  type SessionType,
} from '../../store/app';

const STATUS: Record<SessionType['status'], { tone: string; label: string }> = {
  connected: { tone: 'bg-chart-4', label: 'Connected' },
  disconnected: { tone: 'bg-destructive', label: 'Disconnected' },
  reconnecting: { tone: 'bg-chart-5', label: 'Reconnecting…' },
};

const initial = (label: string) =>
  (/[a-z0-9]/i.exec(label)?.[0] ?? '?').toUpperCase();

function ConnectedSessions() {
  const sessions = useAtomValue(sessionsAtom);
  const activeId = useAtomValue(activeSessionIdAtom);
  const setActiveSession = useSetAtom(setActiveSessionAtom);
  const navigate = useNavigate();

  if (sessions.length === 0) return null;

  const focus = (id: string) => {
    setActiveSession(id);
    navigate({ to: '/sessions' });
  };

  return (
    <>
      <Separator className="my-1.5 w-7" />
      <ul className="flex min-h-0 scrollbar-none flex-col items-center gap-2 overflow-y-auto [&::-webkit-scrollbar]:hidden">
        {sessions.map(({ id, label, status }) => {
          const active = id === activeId;
          return (
            <li key={id}>
              <Tooltip>
                <TooltipTrigger
                  render={<button type="button" onClick={() => focus(id)} />}
                  className="focus-visible:ring-ring relative flex rounded-full outline-none focus-visible:ring-2"
                >
                  <span
                    className={cn(
                      'absolute top-1.5 -left-2.5 h-5 w-0.75 rounded-full',
                      active ? 'bg-primary' : 'bg-transparent',
                    )}
                  />
                  <Avatar className="after:hidden">
                    <AvatarFallback
                      className={cn(
                        'font-medium',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {initial(label)}
                    </AvatarFallback>
                    <AvatarBadge className={STATUS[status].tone} />
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {label} — {STATUS[status].label}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default ConnectedSessions;
