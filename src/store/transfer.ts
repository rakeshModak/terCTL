import { atom } from 'jotai';
import { sftpService } from '@/services/sftp.service';
import type { FileEntryType } from '@/types/file';
import type { TransferItemType, TransferProgressType } from '@/types/transfer';

export interface TransferPaneStateType {
  path: string;
  entries: FileEntryType[];
  busy: boolean;
  error: string | null;
}

export const emptyPane: TransferPaneStateType = {
  path: '',
  entries: [],
  busy: false,
  error: null,
};

export const transferHostIdAtom = atom('');
export const localPaneAtom = atom<TransferPaneStateType>(emptyPane);
export const remotePaneAtom = atom<TransferPaneStateType>(emptyPane);
export const transfersAtom = atom<TransferItemType[]>([]);
export const cancelledTransferIds = new Set<string>();

export const setTransferHostAtom = atom(null, (get, set, hostId: string) => {
  const previous = get(transferHostIdAtom);
  if (previous === hostId) return;
  if (previous) void sftpService.disconnect(previous);
  set(transferHostIdAtom, hostId);
  set(remotePaneAtom, emptyPane);
});

export const enqueueTransfersAtom = atom(
  null,
  (get, set, items: TransferItemType[]) => {
    set(transfersAtom, [...get(transfersAtom), ...items]);
  },
);

export const patchTransferAtom = atom(
  null,
  (get, set, id: string, changes: Partial<TransferItemType>) => {
    set(
      transfersAtom,
      get(transfersAtom).map((t) => (t.id === id ? { ...t, ...changes } : t)),
    );
  },
);

export const applyTransferProgressAtom = atom(
  null,
  (get, set, p: TransferProgressType) => {
    set(
      transfersAtom,
      get(transfersAtom).map((t) =>
        t.id === p.id && (t.state === 'active' || t.state === 'queued')
          ? {
              ...t,
              transferred: p.transferred,
              total: p.total || t.total,
              bytesPerSec: p.bytesPerSec,
            }
          : t,
      ),
    );
  },
);

export const cancelTransferAtom = atom(null, (get, set, id: string) => {
  cancelledTransferIds.add(id);
  set(
    transfersAtom,
    get(transfersAtom).map((t): TransferItemType =>
      t.id === id ? { ...t, state: 'cancelled', bytesPerSec: 0 } : t,
    ),
  );
  void sftpService.cancelTransfer(id);
});

export const clearFinishedTransfersAtom = atom(null, (get, set) => {
  set(
    transfersAtom,
    get(transfersAtom).filter(
      (t) => t.state === 'queued' || t.state === 'active',
    ),
  );
});

export const transferSummaryAtom = atom((get) => {
  const running = get(transfersAtom).filter(
    (t) => t.state === 'queued' || t.state === 'active',
  );
  const total = running.reduce((sum, t) => sum + t.total, 0);
  const moved = running.reduce((sum, t) => sum + t.transferred, 0);
  return {
    running: running.length,
    bytesPerSec: running.reduce((sum, t) => sum + t.bytesPerSec, 0),
    percent: total > 0 ? Math.min(100, (moved / total) * 100) : 0,
  };
});
