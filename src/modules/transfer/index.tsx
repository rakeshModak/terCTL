import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { LOCAL_MACHINE_LABEL } from '@/lib/platform';
import { hostsAtom } from '@/store/app';
import FilePane from './file-pane';
import HostPickerDialog from './host-picker-dialog';
import TransferProgressPanel from './transfer-progress-panel';

export default function TransferView() {
  const hosts = useAtomValue(hostsAtom);
  const {
    hostId,
    setHostId,
    transfers,
    cancelTransfer,
    clearFinishedTransfers,
    local,
    remote,
    upload,
    download,
  } = useFileTransfer();
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedHost = hosts.find((h) => h.id === hostId);

  const chooseServerButton = (
    <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
      <Server />
      {selectedHost ? 'Change server' : 'Choose server'}
    </Button>
  );

  return (
    <div className="bg-background flex min-w-0 flex-1 flex-col">
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
          placeholder={
            hostId
              ? undefined
              : 'Choose a server to browse its files over SFTP.'
          }
          headerAction={chooseServerButton}
          placeholderAction={chooseServerButton}
          action={{ label: 'Download', enabled: !!hostId, run: download }}
          acceptsFrom="local"
          onDropInto={(entries, destDir) => void upload(entries, destDir)}
        />
      </div>

      <TransferProgressPanel
        transfers={transfers}
        onCancel={cancelTransfer}
        onClear={clearFinishedTransfers}
      />

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
