import { useCallback, useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { confirmAtom, promptAtom } from '@/store/dialog';
import { sftpService } from '@/services/sftp.service';
import { joinPath, parentPath } from '@/lib/path';
import type { FileEntryType } from '@/types/file';
import type { TransferStatusType } from '@/types/transfer';

interface PaneState {
  path: string;
  entries: FileEntryType[];
  busy: boolean;
  error: string | null;
}

const emptyPane: PaneState = { path: '', entries: [], busy: false, error: null };

export function useFileTransfer() {
  const prompt = useSetAtom(promptAtom);
  const confirm = useSetAtom(confirmAtom);

  const [hostId, setHostId] = useState('');
  const [local, setLocal] = useState<PaneState>(emptyPane);
  const [remote, setRemote] = useState<PaneState>(emptyPane);
  const [status, setStatus] = useState<TransferStatusType | null>(null);

  const fail = (message: string) => setStatus({ message, kind: 'error' });
  const info = (message: string) => setStatus({ message, kind: 'info' });

  const loadLocal = useCallback(async (path: string) => {
    setLocal((s) => ({ ...s, busy: true, error: null }));
    try {
      const entries = await sftpService.localList(path);
      setLocal({ path, entries, busy: false, error: null });
    } catch (e) {
      setLocal((s) => ({ ...s, busy: false, error: String(e) }));
    }
  }, []);

  const loadRemote = useCallback(async (hid: string, path: string) => {
    setRemote((s) => ({ ...s, busy: true, error: null }));
    try {
      const entries = await sftpService.list(hid, path);
      setRemote({ path, entries, busy: false, error: null });
    } catch (e) {
      setRemote((s) => ({ ...s, busy: false, error: String(e) }));
    }
  }, []);

  // Open the local home directory once on mount.
  useEffect(() => {
    void sftpService.localHome().then(loadLocal);
  }, [loadLocal]);

  // Tear the SFTP channel down when the host changes or the view unmounts.
  useEffect(() => {
    if (!hostId) return;
    return () => {
      void sftpService.disconnect(hostId);
    };
  }, [hostId]);

  // Jump to the remote home whenever a host is picked.
  useEffect(() => {
    if (!hostId) {
      setRemote(emptyPane);
      return;
    }
    setRemote((s) => ({ ...s, busy: true, error: null }));
    sftpService
      .home(hostId)
      .then((home) => loadRemote(hostId, home))
      .catch((e) => setRemote((s) => ({ ...s, busy: false, error: String(e) })));
  }, [hostId, loadRemote]);

  const refreshLocal = useCallback(() => {
    void loadLocal(local.path);
  }, [loadLocal, local.path]);
  const refreshRemote = useCallback(() => {
    if (hostId) void loadRemote(hostId, remote.path);
  }, [hostId, loadRemote, remote.path]);

  // --- transfers ---------------------------------------------------------

  /**
   * Directories can't go over `sftp_upload`/`sftp_download`, which take file
   * paths — so they're filtered out and reported rather than failing per item.
   */
  function splitTransferable(entries: FileEntryType[]) {
    return {
      files: entries.filter((e) => !e.isDir),
      skipped: entries.filter((e) => e.isDir).length,
    };
  }

  const runBatch = async (
    entries: FileEntryType[],
    verb: string,
    destDir: string,
    transfer: (entry: FileEntryType) => Promise<void>,
    reload: () => Promise<void>,
  ) => {
    const { files, skipped } = splitTransferable(entries);
    if (files.length === 0) {
      fail(
        skipped > 0
          ? `Folders can't be transferred yet — skipped ${skipped}.`
          : 'Nothing to transfer.',
      );
      return;
    }

    let done = 0;
    for (const entry of files) {
      info(`${verb} ${entry.name}… (${done + 1}/${files.length})`);
      try {
        await transfer(entry);
        done += 1;
      } catch (e) {
        fail(`${verb} failed on ${entry.name}: ${e}`);
        await reload();
        return;
      }
    }

    const suffix = skipped > 0 ? ` · skipped ${skipped} folder${skipped === 1 ? '' : 's'}` : '';
    info(`${verb} complete — ${done} item${done === 1 ? '' : 's'} → ${destDir}${suffix}`);
    await reload();
  };

  /** Local → remote. `destDir` defaults to the folder the remote pane shows. */
  const upload = async (entries: FileEntryType[], destDir = remote.path) => {
    if (!hostId) return;
    await runBatch(
      entries,
      'Uploaded',
      destDir,
      (entry) => sftpService.upload(hostId, entry.path, joinPath(destDir, entry.name)),
      () => loadRemote(hostId, remote.path),
    );
  };

  /** Remote → local. `destDir` defaults to the folder the local pane shows. */
  const download = async (entries: FileEntryType[], destDir = local.path) => {
    if (!hostId) return;
    await runBatch(
      entries,
      'Downloaded',
      destDir,
      (entry) => sftpService.download(hostId, entry.path, joinPath(destDir, entry.name)),
      () => loadLocal(local.path),
    );
  };

  // --- mutations ---------------------------------------------------------

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
      fail(`Couldn't create folder: ${e}`);
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
      fail(`Couldn't create folder: ${e}`);
    }
  };

  const renameLocal = async (entry: FileEntryType) => {
    const name = await askName(`Rename “${entry.name}”`, entry.name);
    if (!name || name === entry.name) return;
    try {
      await sftpService.localRename(entry.path, joinPath(parentPath(entry.path), name));
      await loadLocal(local.path);
    } catch (e) {
      fail(`Rename failed: ${e}`);
    }
  };

  const renameRemote = async (entry: FileEntryType) => {
    if (!hostId) return;
    const name = await askName(`Rename “${entry.name}”`, entry.name);
    if (!name || name === entry.name) return;
    try {
      await sftpService.rename(hostId, entry.path, joinPath(parentPath(entry.path), name));
      await loadRemote(hostId, remote.path);
    } catch (e) {
      fail(`Rename failed: ${e}`);
    }
  };

  /**
   * Delete a batch after one confirmation. Directories are removed
   * recursively by the backend, so the prompt says so explicitly.
   */
  const removeEntries = async (
    entries: FileEntryType[],
    remove: (entry: FileEntryType) => Promise<void>,
    reload: () => Promise<void>,
  ) => {
    if (entries.length === 0) return;
    const dirs = entries.filter((e) => e.isDir).length;
    const only = entries.length === 1 ? entries[0] : null;

    const ok = await confirm({
      title: only ? `Delete “${only.name}”?` : `Delete ${entries.length} items?`,
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
        fail(`Delete failed on ${entry.name}: ${e}`);
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
    status,
    dismissStatus: () => setStatus(null),
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
