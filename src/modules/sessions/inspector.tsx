import { Copy, FolderSymlink, Network, PanelRightClose, SquareTerminal, Unplug } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { HostType } from '@/types/host'
import type { SessionType } from '../../store/app'
import MetricsPanel from './metrics-panel'

interface InspectorProps {
  session: SessionType
  /** null for a local shell — it has no Host record behind it. */
  host: HostType | null
  onClose: () => void
  onDisconnect: () => void
  onDuplicate: () => void
  onOpenSftp: () => void
}

const STATUS_LABEL: Record<SessionType['status'], string> = {
  connected: 'CONNECTED',
  disconnected: 'DISCONNECTED',
  reconnecting: 'RECONNECTING',
}

/** label / value line in the detail grid. */
function Detail({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate', tone)}>{value}</dd>
    </>
  )
}

/**
 * Right-hand details panel for the focused session.
 *
 * Renders for local shells too, not just SSH hosts — a local session has no
 * Host record, so the host grid, metrics and remote-only actions are omitted
 * rather than the whole panel being suppressed.
 */
export default function Inspector({
  session,
  host,
  onClose,
  onDisconnect,
  onDuplicate,
  onOpenSftp,
}: InspectorProps) {
  const connected = session.status === 'connected'
  const isLocal = host === null

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3.5 overflow-y-auto border-l border-border bg-sidebar p-4">
      <Card size="sm" className="gap-3 px-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              connected ? 'bg-chart-4' : 'bg-destructive',
            )}
            style={{ boxShadow: `0 0 9px ${connected ? 'var(--green)' : 'var(--red)'}` }}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {host?.label ?? session.label}
          </span>
          <Badge
            variant="secondary"
            className={cn('shrink-0', connected ? 'text-chart-4' : 'text-destructive')}
          >
            {STATUS_LABEL[session.status]}
          </Badge>
          <Button variant="ghost" size="icon-xs" onClick={onClose} title="Collapse details">
            <PanelRightClose />
          </Button>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 font-mono text-xs">
          {host ? (
            <>
              <Detail label="host" value={host.hostname} />
              <Detail label="user" value={host.username} />
              <Detail label="port" value={String(host.port)} />
              <Detail
                label="auth"
                value={host.authKind === 'key' ? (host.keyRef ?? 'key') : 'password'}
                tone="text-chart-3"
              />
            </>
          ) : (
            <>
              <Detail label="kind" value="local shell" />
              <Detail label="host" value="this machine" />
            </>
          )}
        </dl>
      </Card>

      {/* Metrics are read over SSH, so they only exist for a real host.
          Keyed so switching host or reconnecting remounts and resets history,
          rather than resetting state from inside the polling effect. */}
      {host && (
        <MetricsPanel key={`${host.id}-${connected}`} hostId={host.id} connected={connected} />
      )}

      <div className="grid grid-cols-2 gap-2">
        {host && (
          <>
            <Button variant="outline" size="sm" onClick={onOpenSftp}>
              <FolderSymlink />
              SFTP
            </Button>
            <Button variant="outline" size="sm" disabled title="Coming soon">
              <Network />
              Forward
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          {isLocal ? <SquareTerminal /> : <Copy />}
          {isLocal ? 'New shell' : 'Duplicate'}
        </Button>
        <Button variant="destructive" size="sm" onClick={onDisconnect}>
          <Unplug />
          {isLocal ? 'Close' : 'Disconnect'}
        </Button>
      </div>
    </aside>
  )
}
