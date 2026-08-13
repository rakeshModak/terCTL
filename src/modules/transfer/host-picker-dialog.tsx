import { Check, Server, ServerOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import type { HostType } from '@/types/host';

interface HostPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hosts: HostType[];
  /** Currently connected host, if any. */
  value: string;
  onSelect: (hostId: string) => void;
}

export default function HostPickerDialog({
  open,
  onOpenChange,
  hosts,
  value,
  onSelect,
}: HostPickerDialogProps) {
  const choose = (hostId: string) => {
    onSelect(hostId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle>Connect to a server</DialogTitle>
          <DialogDescription>
            Browse and transfer files over SFTP on the selected host.
          </DialogDescription>
        </DialogHeader>

        {hosts.length === 0 ? (
          <Empty className="p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerOff />
              </EmptyMedia>
              <EmptyTitle>No saved servers</EmptyTitle>
              <EmptyDescription>Add a host from the Hosts view first.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="max-h-80 overflow-x-hidden overflow-y-auto">
            {hosts.map((host) => {
              const active = host.id === value;
              return (
                <li key={host.id}>
                  <button
                    type="button"
                    onClick={() => choose(host.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                      'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                      active && 'bg-primary/10',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                        active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Server className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{host.label}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {host.username}@{host.hostname}:{host.port}
                      </span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
