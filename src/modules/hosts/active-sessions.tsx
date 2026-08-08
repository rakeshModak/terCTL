import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { LOCAL_MACHINE_LABEL } from '../../lib/platform'
import type { Host } from '../../models'
import type { Session } from '../../store/app'

interface ActiveSessionsProps {
  sessions: Session[]
  hostsById: Map<string, Host>
  onOpen: (sessionId: string) => void
}

const DOT: Record<Session['status'], string> = {
  connected: 'bg-primary',
  reconnecting: 'bg-chart-5',
  disconnected: 'bg-muted-foreground/40',
}

const STATUS_LABEL: Record<Session['status'], string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
}

export function ActiveSessions({ sessions, hostsById, onOpen }: ActiveSessionsProps) {
  return (
    <Card size="sm" className="gap-0 py-0">
      <ul className="divide-y divide-border">
        {sessions.map((session) => {
          const host = hostsById.get(session.hostId)
          const address = host ? `${host.hostname}:${host.port}` : LOCAL_MACHINE_LABEL

          return (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onOpen(session.id)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', DOT[session.status])}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{session.label}</span>
                <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
                  {address}
                </span>
                <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                  {STATUS_LABEL[session.status]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
