import { useState, type FormEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { CircleAlert, Globe, Lock, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hostsAtom, openForwardedPortAtom } from '@/store/app';
import {
  closePortPickerAtom,
  portPickerHostIdAtom,
  portScanAtom,
  scanPortsAtom,
} from '@/store/browser';
import type { ListeningPortType } from '@/types/browser';

/**
 * Pick a remote port to open in a browser pane.
 *
 * The list is the point: a port bound to the server's loopback is invisible
 * from here, so knowing what is up there — and what process owns it — is what
 * a `curl` over an SSH shell was being used to find out.
 */
export default function PortPicker() {
  const hostId = useAtomValue(portPickerHostIdAtom);
  const hosts = useAtomValue(hostsAtom);
  const scanFor = useAtomValue(portScanAtom);
  const rescan = useSetAtom(scanPortsAtom);
  const close = useSetAtom(closePortPickerAtom);
  const openPort = useSetAtom(openForwardedPortAtom);
  const [manual, setManual] = useState('');

  const host = hosts.find((h) => h.id === hostId) ?? null;
  const scan = scanFor(hostId);

  const open = (port: number) => {
    close();
    setManual('');
    if (hostId) void openPort(hostId, port);
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    const port = Number(manual.trim());
    if (Number.isInteger(port) && port >= 1 && port <= 65535) open(port);
  };

  return (
    <Dialog
      open={hostId !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Open a port from {host?.label ?? 'this host'}
          </DialogTitle>
          <DialogDescription>
            The port is forwarded over this SSH connection and opened beside
            your shell. Nothing is exposed beyond this machine.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Listening on {host?.hostname ?? 'the server'}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              title="Scan again"
              disabled={scan.loading || !hostId}
              onClick={() => hostId && void rescan(hostId)}
            >
              <RotateCw className={cn(scan.loading && 'animate-spin')} />
            </Button>
          </div>

          <div className="border-border max-h-64 overflow-y-auto rounded-lg border">
            {scan.ports.length > 0 ? (
              scan.ports.map((port) => (
                <PortRow
                  key={port.port}
                  port={port}
                  sshPort={host?.port}
                  onOpen={() => open(port.port)}
                />
              ))
            ) : (
              <p className="text-muted-foreground p-4 text-center text-xs">
                {scan.loading
                  ? 'Scanning…'
                  : 'No listening TCP ports reported. Enter one below.'}
              </p>
            )}
          </div>

          {scan.error && (
            <p className="text-destructive text-2xs flex items-start gap-1.5 font-mono leading-relaxed">
              <CircleAlert className="mt-px size-3 shrink-0" />
              <span className="min-w-0 wrap-break-word">{scan.error}</span>
            </p>
          )}

          <form onSubmit={submitManual} className="flex items-center gap-2">
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric"
              placeholder="or type a port, e.g. 3000"
              className="font-mono text-xs"
              aria-label="Port to open"
            />
            <Button type="submit" size="sm" disabled={!manual.trim()}>
              Open
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PortRow({
  port,
  sshPort,
  onOpen,
}: {
  port: ListeningPortType;
  sshPort: number | undefined;
  onOpen: () => void;
}) {
  // The port carrying this very session is never what someone means to browse.
  const isSsh = port.port === sshPort;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'border-border flex w-full items-center gap-2.5 border-b px-3 py-2 text-left transition-colors last:border-b-0',
        'hover:bg-accent focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset',
      )}
    >
      <span className="text-foreground w-14 shrink-0 font-mono text-xs tabular-nums">
        :{port.port}
      </span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
        {port.process ?? '—'}
        {port.pid !== null && (
          <span className="text-(--text-faintest)"> #{port.pid}</span>
        )}
      </span>
      {isSsh && (
        <Badge variant="ghost" className="text-2xs shrink-0">
          this session
        </Badge>
      )}
      <Badge
        variant={port.loopback ? 'secondary' : 'outline'}
        className="text-2xs shrink-0 gap-1 font-mono"
        title={
          port.loopback
            ? `Bound to ${port.address} on the server — unreachable from here without this forward`
            : `Bound to ${port.address} on the server`
        }
      >
        {port.loopback ? (
          <Lock className="size-2.5" />
        ) : (
          <Globe className="size-2.5" />
        )}
        {port.address}
      </Badge>
    </button>
  );
}
