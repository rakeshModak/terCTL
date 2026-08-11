import { listen } from '@tauri-apps/api/event';
import { call } from './config/tauri-api';
import type { FileEntryType } from '@/types/file';
import type {
  TransferProgressType,
  TransferResultType,
} from '@/types/transfer';

export const sftpService = {
  home: (hostId: string) => call<string>('sftp_home', { hostId }),
  list: (hostId: string, path: string) =>
    call<FileEntryType[]>('sftp_list', { hostId, path }),
  download: (
    hostId: string,
    remotePath: string,
    localPath: string,
    transferId: string,
  ) =>
    call<TransferResultType>('sftp_download', {
      hostId,
      remotePath,
      localPath,
      transferId,
    }),
  upload: (
    hostId: string,
    localPath: string,
    remotePath: string,
    transferId: string,
  ) =>
    call<TransferResultType>('sftp_upload', {
      hostId,
      localPath,
      remotePath,
      transferId,
    }),
  cancelTransfer: (transferId: string) =>
    call<void>('sftp_cancel_transfer', { transferId }),
  onTransferProgress: (handler: (progress: TransferProgressType) => void) =>
    listen<TransferProgressType>('transfer://progress', (event) =>
      handler(event.payload),
    ),
  mkdir: (hostId: string, path: string) =>
    call<void>('sftp_mkdir', { hostId, path }),
  rename: (hostId: string, from: string, to: string) =>
    call<void>('sftp_rename', { hostId, from, to }),
  remove: (hostId: string, path: string, isDir: boolean) =>
    call<void>('sftp_remove', { hostId, path, isDir }),
  disconnect: (hostId: string) => call<void>('sftp_disconnect', { hostId }),

  // Local filesystem
  localHome: () => call<string>('local_home'),
  localList: (path: string) => call<FileEntryType[]>('local_list', { path }),
  localMkdir: (path: string) => call<void>('local_mkdir', { path }),
  localRename: (from: string, to: string) =>
    call<void>('local_rename', { from, to }),
  localRemove: (path: string, isDir: boolean) =>
    call<void>('local_remove', { path, isDir }),
};
