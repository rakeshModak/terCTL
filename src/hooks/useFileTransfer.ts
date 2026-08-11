import { useCallback, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';
import { confirmAtom, promptAtom } from '@/store/dialog';
import {
  cancelledTransferIds,
  cancelTransferAtom,
  clearFinishedTransfersAtom,
  enqueueTransfersAtom,
  localPaneAtom,
  patchTransferAtom,
  remotePaneAtom,
  setTransferHostAtom,
  transferHostIdAtom,
  transfersAtom,
} from '@/store/transfer';
import { sftpService } from '@/services/sftp.service';
import { joinPath, parentPath } from '@/lib/path';
import type { FileEntryType } from '@/types/file';
import type {
  TransferDirectionType,
  TransferItemType,
  TransferResultType,
} from '@/types/transfer';

export function useFileTransfer() {
  const prompt = useSetAtom(promptAtom);
  const confirm = useSetAtom(confirmAtom);

  const hostId = useAtomValue(transferHostIdAtom);
  const setHostId = useSetAtom(setTransferHostAtom);
  const [local, setLocal] = useAtom(localPaneAtom);
  const [remote, setRemote] = useAtom(remotePaneAtom);
  const transfers = useAtomValue(transfersAtom);
  const enqueueTransfers = useSetAtom(enqueueTransfersAtom);
  const patchTransfer = useSetAtom(patchTransferAtom);
  const cancelTransfer = useSetAtom(cancelTransferAtom);
  const clearFinishedTransfers = useSetAtom(clearFinishedTransfersAtom);

  const fail = (title: string, detail?: unknown) =>
    toast.error(title, {
      description: detail === undefined ? undefined : String(detail),
      duration: 8000,
    });
  const info = (title: string, description?: string) =>
    toast.success(title, { description });

  const loadLocal = useCallback(
    async (path: string) => {
      setLocal((s) => ({ ...s, busy: true, error: null }));
      try {
        const entries = await sftpService.localList(path);
        setLocal({ path, entries, busy: false, error: null });
      } catch (e) {
        setLocal((s) => ({
          ...s,
          busy: false,
          error: String(e),
        }));
      }
    },
    [setLocal],
  );

  const loadRemote = useCallback(
    async (hid: string, path: string) => {
      setRemote((s) => ({
        ...s,
        busy: true,
        error: null,
      }));
      try {
        const entries = await sftpService.list(hid, path);
        setRemote({ path, entries, busy: false, error: null });
      } catch (e) {
        setRemote((s) => ({
          ...s,
          busy: false,
          error: String(e),
        }));
      }
    },
    [setRemote],
  );

  useEffect(() => {
    if (local.path) return;
    void sftpService.localHome().then(loadLocal);
  }, [local.path, loadLocal]);

  // Jump to the remote home when a server is first opened. Changing servers
  // clears the pane (see setTransferHostAtom), which is what re-arms this.
  useEffect(() => {
    if (!hostId || remote.path) return;
    setRemote((s) => ({
      ...s,
      busy: true,
      error: null,
    }));
    sftpService
      .home(hostId)
      .then((home) => loadRemote(hostId, home))
      .catch((e) =>
        setRemote((s) => ({
          ...s,
          busy: false,
          error: String(e),
        })),
      );
  }, [hostId, remote.path, loadRemote, setRemote]);

  const refreshLocal = useCallback(() => {
    void loadLocal(local.path);
  }, [loadLocal, local.path]);
  const refreshRemote = useCallback(() => {
    if (hostId) void loadRemote(hostId, remote.path);
  }, [hostId, loadRemote, remote.path]);

  function splitTransferable(entries: FileEntryType[]) {
    return {
      files: entries.filter((e) => !e.isDir),
      skipped: entries.filter((e) => e.isDir).length,
    };
  }

  const runBatch = async (
    entries: FileEntryType[],
    direction: TransferDirectionType,
    verb: string,
    destDir: string,
    transfer: (
      entry: FileEntryType,
      transferId: string,
    ) => Promise<TransferResultType>,
    reload: () => Promise<void>,
  ) => {
    const { files, skipped } = splitTransferable(entries);
    if (files.length === 0) {
      toast.warning(
        skipped > 0
          ? 'Folders can’t be transferred yet'
          : 'Nothing to transfer',
        {
          description:
            skipped > 0
              ? `Skipped ${skipped} folder${skipped === 1 ? '' : 's'}.`
              : undefined,
        },
      );
      return;
    }

    const queued: TransferItemType[] = files.map((entry) => ({
      id: crypto.randomUUID(),
      name: entry.name,
      direction,
      destDir,
      total: entry.size,
      transferred: 0,
      bytesPerSec: 0,
      state: 'queued',
    }));
    enqueueTransfers(queued);

    let done = 0;
    let cancelled = 0;
    let failed = 0;

    for (const [i, entry] of files.entries()) {
      const { id } = queued[i];
      if (cancelledTransferIds.delete(id)) {
        cancelled += 1;
        continue;
      }
      patchTransfer(id, { state: 'active' });
      try {
        const result = await transfer(entry, id);
        if (result.cancelled) {
          patchTransfer(id, { state: 'cancelled', bytesPerSec: 0 });
          cancelled += 1;
        } else {
          patchTransfer(id, {
            state: 'done',
            transferred: result.bytes,
            total: result.bytes,
            bytesPerSec: 0,
          });
          done += 1;
        }
      } catch (e) {
        patchTransfer(id, { state: 'error', error: String(e), bytesPerSec: 0 });
        failed += 1;
      } finally {
        cancelledTransferIds.delete(id);
      }
    }

    const notes = [
      skipped > 0 ? `skipped ${skipped} folder${skipped === 1 ? '' : 's'}` : '',
      cancelled > 0 ? `cancelled ${cancelled}` : '',
      failed > 0 ? `failed ${failed}` : '',
    ].filter(Boolean);
    const suffix = notes.length ? ` · ${notes.join(' · ')}` : '';

    if (failed > 0) {
      fail(
        `${verb} finished with errors`,
        `${done} of ${files.length} done${suffix} — see the transfer list for details`,
      );
    } else {
      info(
        `${verb} complete`,
        `${done} item${done === 1 ? '' : 's'} → ${destDir}${suffix}`,
      );
    }
    await reload();
  };

  const upload = async (entries: FileEntryType[], destDir = remote.path) => {
    if (!hostId) return;
    await runBatch(
      entries,
      'upload',
      'Uploaded',
      destDir,
      (entry, transferId) =>
        sftpService.upload(
          hostId,
          entry.path,
          joinPath(destDir, entry.name),
          transferId,
        ),
      () => loadRemote(hostId, remote.path),
    );
  };

  const download = async (entries: FileEntryType[], destDir = local.path) => {
    if (!hostId) return;
    await runBatch(
      entries,
      'download',
      'Downloaded',
      destDir,
      (entry, transferId) =>
        sftpService.download(
          hostId,
          entry.path,
          joinPath(destDir, entry.name),
          transferId,
        ),
      () => loadLocal(local.path),
    );
  };

  const askName = (title: string, initialValue?: string) =>
    prompt({
      title,
      initialValue,
      placeholder: initialValue ? undefined : 'Folder name',
      confirmLabel: initialValue ? 'Rename' : 'Create',
    });

  const newLocalFolder = async () => {
    const name = await askName('New folder');
    if (!name) return;
    try {
      await sftpService.localMkdir(joinPath(local.path, name));
      await loadLocal(local.path);
    } catch (e) {
      fail('Couldn’t create folder', e);
    }
  };

  const newRemoteFolder = async () => {
    if (!hostId) return;
    const name = await askName('New folder');
    if (!name) return;
    try {
      await sftpService.mkdir(hostId, joinPath(remote.path, name));
      await loadRemote(hostId, remote.path);
    } catch (e) {
      fail('Couldn’t create folder', e);
    }
  };

  const renameLocal = async (entry: FileEntryType) => {
    const name = await askName(`Rename “${entry.name}”`, entry.name);
    if (!name || name === entry.name) return;
    try {
      await sftpService.localRename(
        entry.path,
        joinPath(parentPath(entry.path), name),
      );
      await loadLocal(local.path);
    } catch (e) {
      fail('Rename failed', e);
    }
  };

  const renameRemote = async (entry: FileEntryType) => {
    if (!hostId) return;
    const name = await askName(`Rename “${entry.name}”`, entry.name);
    if (!name || name === entry.name) return;
    try {
      await sftpService.rename(
        hostId,
        entry.path,
        joinPath(parentPath(entry.path), name),
      );
      await loadRemote(hostId, remote.path);
    } catch (e) {
      fail('Rename failed', e);
    }
  };

  const removeEntries = async (
    entries: FileEntryType[],
    remove: (entry: FileEntryType) => Promise<void>,
    reload: () => Promise<void>,
  ) => {
    if (entries.length === 0) return;
    const dirs = entries.filter((e) => e.isDir).length;
    const only = entries.length === 1 ? entries[0] : null;

    const ok = await confirm({
      title: only
        ? `Delete “${only.name}”?`
        : `Delete ${entries.length} items?`,
      message: dirs
        ? 'Folders are deleted together with everything inside them. This cannot be undone.'
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    let done = 0;
    for (const entry of entries) {
      try {
        await remove(entry);
        done += 1;
      } catch (e) {
        fail(`Delete failed on ${entry.name}`, e);
        await reload();
        return;
      }
    }
    info(`Deleted ${done} item${done === 1 ? '' : 's'}`);
    await reload();
  };

  const removeLocal = (entries: FileEntryType[]) =>
    removeEntries(
      entries,
      (entry) => sftpService.localRemove(entry.path, entry.isDir),
      () => loadLocal(local.path),
    );

  const removeRemote = (entries: FileEntryType[]) =>
    removeEntries(
      entries,
      (entry) => sftpService.remove(hostId, entry.path, entry.isDir),
      () => loadRemote(hostId, remote.path),
    );

  return {
    hostId,
    setHostId,
    transfers,
    cancelTransfer,
    clearFinishedTransfers,
    local: {
      ...local,
      open: (entry: FileEntryType) => {
        void loadLocal(entry.path);
      },
      navigate: (path: string) => {
        void loadLocal(path);
      },
      up: () => {
        void loadLocal(parentPath(local.path));
      },
      refresh: refreshLocal,
      newFolder: newLocalFolder,
      rename: renameLocal,
      remove: removeLocal,
    },
    remote: {
      ...remote,
      open: (entry: FileEntryType) => {
        if (hostId) void loadRemote(hostId, entry.path);
      },
      navigate: (path: string) => {
        if (hostId) void loadRemote(hostId, path);
      },
      up: () => {
        if (hostId) void loadRemote(hostId, parentPath(remote.path));
      },
      refresh: refreshRemote,
      newFolder: newRemoteFolder,
      rename: renameRemote,
      remove: removeRemote,
    },
    upload,
    download,
  };
}

export type FileTransfer = ReturnType<typeof useFileTransfer>;
export type FilePaneController = FileTransfer['local'];
