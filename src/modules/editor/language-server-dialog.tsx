import { useCallback, useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  CircleCheck,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { langServerService } from '@/services/langserver.service';
import { confirmAtom } from '@/store/dialog';
import type { HostServersType, ServerStatusType } from '@/types/langserver';

interface LanguageServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostId: string;
  hostLabel: string;
  /** Server for the file being edited, floated to the top of the list. */
  highlightId: string | null;
  onChanged: () => void;
}

export default function LanguageServerDialog({
  open,
  onOpenChange,
  hostId,
  hostLabel,
  highlightId,
  onChanged,
}: LanguageServerDialogProps) {
  const confirm = useSetAtom(confirmAtom);
  const [data, setData] = useState<HostServersType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await langServerService.list(hostId);
      setData(next);
      setError(null);
      onChanged();
    } catch (e) {
      setError(String(e));
    }
  }, [hostId, onChanged]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    langServerService
      .list(hostId)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [open, hostId]);

  const free = data ? formatBytes(data.freeKb * 1024) : null;
  const installed = data?.servers.filter((s) => s.installed) ?? [];

  const install = async (server: ServerStatusType) => {
    const tight = data
      ? data.freeKb * 1024 < server.approxMb * 1024 * 1024
      : false;
    const ok = await confirm({
      title: `Install ${server.label}?`,
      message:
        `Runs "${server.installCommand.split('\n')[0]}" on ${hostLabel}. ` +
        `That writes roughly ${server.approxMb} MB${free ? `, and ${free} is free` : ''}. ` +
        (tight ? 'There is probably not enough room. ' : '') +
        'Editing and highlighting already work without it.',
      confirmLabel: 'Install',
      danger: tight,
    });
    if (!ok) return;

    setBusyId(server.id);
    try {
      toast.success(
        `${await langServerService.install(hostId, server.id)} installed`,
      );
      await refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const uninstall = async (server: ServerStatusType) => {
    const ok = await confirm({
      title: `Remove ${server.label}?`,
      message: `Runs "${server.uninstallCommand.split('\n')[0]}" on ${hostLabel}, deleting it from the server.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;

    setBusyId(server.id);
    try {
      toast.success(
        `${await langServerService.uninstall(hostId, server.id)} removed`,
      );
      await refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusyId(null);
    }
  };

  const uninstallAll = async () => {
    const ok = await confirm({
      title: `Remove all ${installed.length} language servers?`,
      message: `Deletes ${installed.map((s) => s.label).join(', ')} from ${hostLabel}.`,
      confirmLabel: 'Remove all',
      danger: true,
    });
    if (!ok) return;

    setBusyId('__all');
    const failed: string[] = [];
    for (const server of installed) {
      try {
        await langServerService.uninstall(hostId, server.id);
      } catch {
        failed.push(server.label);
      }
    }
    setBusyId(null);
    await refresh();

    if (failed.length) toast.error(`Could not remove ${failed.join(', ')}`);
    else toast.success('All language servers removed');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Language servers on {hostLabel}</DialogTitle>
          <DialogDescription>
            Optional. Editing, saving and highlighting all work without these —
            they are only installed when you ask, and they live on the server,
            not in TerCTL.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-destructive px-1 py-4 text-xs">{error}</p>}

        {!data && !error && (
          <div className="text-muted-foreground flex items-center gap-2 px-1 py-6 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            Checking {hostLabel}…
          </div>
        )}

        {data && (
          <div className="-mx-1 max-h-80 overflow-y-auto px-1">
            {[...data.servers]
              .sort(
                (a, b) =>
                  Number(b.id === highlightId) - Number(a.id === highlightId),
              )
              .map((server) => {
                const busy = busyId === server.id || busyId === '__all';
                return (
                  <div
                    key={server.id}
                    className={cn(
                      'border-border flex items-center gap-3 border-b py-2.5 last:border-b-0',
                      server.id === highlightId && 'text-foreground',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="truncate">{server.label}</span>
                        {server.installed && (
                          <CircleCheck className="text-primary size-3.5 shrink-0" />
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                        {server.installed
                          ? `${server.bin} · already installed`
                          : server.canInstall
                            ? `${server.bin} · ~${server.approxMb} MB`
                            : `needs ${server.missing.join(', ')}`}
                      </p>
                    </div>

                    {busy ? (
                      <Loader2 className="text-muted-foreground size-4 animate-spin" />
                    ) : server.installed ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Remove from the server"
                        className="hover:text-destructive"
                        onClick={() => void uninstall(server)}
                      >
                        <Trash2 />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!server.canInstall || busyId !== null}
                        onClick={() => void install(server)}
                      >
                        <Download />
                        Install
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <span className="text-muted-foreground text-[11px]">
            {free ? `${free} free on ${hostLabel}` : ''}
          </span>
          <div className="flex gap-2">
            {installed.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="hover:text-destructive"
                disabled={busyId !== null}
                onClick={() => void uninstallAll()}
              >
                <Trash2 />
                Remove all
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busyId !== null}
              onClick={() => void refresh()}
            >
              <RefreshCw />
              Recheck
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
