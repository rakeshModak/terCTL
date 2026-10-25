import { useState } from 'react';
import {
  Check,
  Copy,
  CopyPlus,
  FolderSymlink,
  Network,
  PanelRightClose,
  SquareTerminal,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { writeClipboard } from '@/lib/clipboard';
import type { HostType } from '@/types/host';
import type { SessionType } from '../../store/app';
import MetricsPanel from './metrics-panel';

interface InspectorProps {
  session: SessionType;
  /** null for a local shell — it has no Host record behind it. */
  host: HostType | null;
  onClose: () => void;
  onDisconnect: () => void;
  onDuplicate: () => void;
  onOpenSftp: () => void;
  /** Opens the port picker. Absent for a local shell, which forwards nothing. */
  onForwardPort?: () => void;
}

const STATUS_LABEL: Record<SessionType['status'], string> = {
  connected: 'CONNECTED',
  connecting: 'CONNECTING',
  disconnected: 'DISCONNECTED',
  reconnecting: 'RECONNECTING',
};

/** How long the tick stays up after a successful copy. */
const COPIED_MS = 1200;

/** label / value line in the detail grid. `copyable` adds a clipboard button. */
function Detail({
  label,
  value,
  tone,
  copyable,
}: {
  label: string;
  value: string;
  tone?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!copyable) {
    return (
      <>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className={cn('truncate', tone)}>{value}</dd>
      </>
    );
  }

  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('flex min-w-0 items-center gap-1', tone)}>
        <span className="truncate">{value}</span>
        <button
          type="button"
          title={copied ? 'Copied' : `Copy ${label}`}
          aria-label={`Copy ${label}`}
          onClick={() => {
            void writeClipboard(value).then((ok) => {
              if (!ok) return;
              setCopied(true);
              setTimeout(() => setCopied(false), COPIED_MS);
            });
          }}
          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-colors"
        >
          {copied ? (
            <Check className="text-chart-4 size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
      </dd>
    </>
  );
}


export default function Inspector({
  session,
  host,
  onClose,
  onDisconnect,
  onDuplicate,
  onOpenSftp,
  onForwardPort,
}: InspectorProps) {
  const connected = session.status === 'connected';
  const isLocal = host === null;

  return (
    <aside className="border-border bg-sidebar flex w-64 shrink-0 flex-col gap-2.5 overflow-y-auto border-l p-3">
      <Card size="sm" className="shrink-0 gap-2 px-3 py-3">
        <div className="flex items-center gap-2.5">
          {/* The dot carries the status on its own; a spelled-out badge beside
              it cost the host label most of its width for no extra meaning. */}
          <span
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              connected ? 'bg-chart-4' : 'bg-destructive',
            )}
            style={{
              boxShadow: `0 0 9px ${connected ? 'var(--green)' : 'var(--red)'}`,
            }}
            title={STATUS_LABEL[session.status]}
          />
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold"
            title={host?.label ?? session.label}
          >
            {host?.label ?? session.label}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            title="Collapse details"
          >
            <PanelRightClose />
          </Button>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-2xs">
          {host ? (
            <>
              <Detail label="host" value={host.hostname} copyable />
              <Detail label="user" value={host.username} />
              <Detail label="port" value={String(host.port)} />
              <Detail
                label="auth"
                value={
                  host.authKind === 'key' ? (host.keyRef ?? 'key') : 'password'
                }
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

      {host && (
        <MetricsPanel
          key={`${host.id}-${connected}`}
          hostId={host.id}
          connected={connected}
        />
      )}

      <div className="grid shrink-0 grid-cols-2 gap-2">
        {host && (
          <>
            <Button variant="outline" size="sm" onClick={onOpenSftp}>
              <FolderSymlink />
              SFTP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onForwardPort}
              disabled={!onForwardPort || !connected}
              title="Open one of this host's ports in a browser pane"
            >
              <Network />
              Forward
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          {isLocal ? <SquareTerminal /> : <CopyPlus />}
          {isLocal ? 'New shell' : 'Duplicate'}
        </Button>
        <Button variant="destructive" size="sm" onClick={onDisconnect}>
          <Unplug />
          {isLocal ? 'Close' : 'Disconnect'}
        </Button>
      </div>
    </aside>
  );
}
