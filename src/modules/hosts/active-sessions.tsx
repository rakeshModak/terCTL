import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { LOCAL_MACHINE_LABEL } from '../../lib/platform';
import type { HostType } from '@/types/host';
import type { SessionType } from '../../store/app';

interface ActiveSessionsProps {
  sessions: SessionType[];
  hostsById: Map<string, HostType>;
  onOpen: (sessionId: string) => void;
}

const DOT: Record<SessionType['status'], string> = {
  connected: 'bg-primary',
  reconnecting: 'bg-chart-5',
  disconnected: 'bg-muted-foreground/40',
};

const STATUS_LABEL: Record<SessionType['status'], string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
};

export default function ActiveSessions({
  sessions,
  hostsById,
  onOpen,
}: ActiveSessionsProps) {
  return (
    <Card size="sm" className="gap-0 py-0">
      <ul className="divide-border divide-y">
        {sessions.map((session) => {
          const host = hostsById.get(session.hostId);
          const address = host
            ? `${host.hostname}:${host.port}`
            : LOCAL_MACHINE_LABEL;

          return (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onOpen(session.id)}
                className="hover:bg-accent/50 focus-visible:bg-accent/50 flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    DOT[session.status],
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {session.label}
                </span>
                <span className="text-muted-foreground hidden shrink-0 font-mono text-xs sm:inline">
                  {address}
                </span>
                <span className="text-muted-foreground w-28 shrink-0 text-right text-xs">
                  {STATUS_LABEL[session.status]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
