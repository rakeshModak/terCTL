import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { CircleAlert, CircleCheck, Server, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { LOCAL_MACHINE_LABEL } from '@/lib/platform';
import { hostsAtom } from '@/store/app';
import FilePane from './file-pane';
import HostPickerDialog from './host-picker-dialog';

export default function TransferView() {
  const hosts = useAtomValue(hostsAtom);
  const { hostId, setHostId, status, dismissStatus, local, remote, upload, download } =
    useFileTransfer();
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedHost = hosts.find((h) => h.id === hostId);
  const isError = status?.kind === 'error';

  const chooseServerButton = (
    <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
      <Server />
      {selectedHost ? 'Change server' : 'Choose server'}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <h1 className="font-heading text-lg font-bold tracking-tight">Transfer</h1>
        <div className="flex-1" />
        {status && (
          <Alert
            variant={isError ? 'destructive' : 'default'}
            className="w-auto max-w-md items-center py-1.5"
          >
            {isError ? <CircleAlert /> : <CircleCheck />}
            <AlertDescription className="truncate">{status.message}</AlertDescription>
            <Button variant="ghost" size="icon-xs" onClick={dismissStatus} title="Dismiss">
              <X />
            </Button>
          </Alert>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <FilePane
          title={LOCAL_MACHINE_LABEL}
          side="local"
          pane={local}
          action={{ label: 'Upload', enabled: !!hostId, run: upload }}
          acceptsFrom="remote"
          onDropInto={(entries, destDir) => void download(entries, destDir)}
        />
        <FilePane
          title={selectedHost?.label ?? 'Remote'}
          side="remote"
          pane={remote}
          placeholder={hostId ? undefined : 'Choose a server to browse its files over SFTP.'}
          headerAction={chooseServerButton}
          placeholderAction={chooseServerButton}
          action={{ label: 'Download', enabled: !!hostId, run: download }}
          acceptsFrom="local"
          onDropInto={(entries, destDir) => void upload(entries, destDir)}
        />
      </div>

      <HostPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        hosts={hosts}
        value={hostId}
        onSelect={setHostId}
      />
    </div>
  );
}
