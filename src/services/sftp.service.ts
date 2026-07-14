import { call } from './config/tauri-api'
import type { FileEntry } from '../models'

// Remote file operations over SFTP + the matching local-filesystem helpers
// (used by the transfer / file-browser feature).
export const sftpService = {
  // Remote (SSH host)
  home: (hostId: string) => call<string>('sftp_home', { hostId }),
  list: (hostId: string, path: string) => call<FileEntry[]>('sftp_list', { hostId, path }),
  download: (hostId: string, remotePath: string, localPath: string) =>
    call<void>('sftp_download', { hostId, remotePath, localPath }),
  upload: (hostId: string, localPath: string, remotePath: string) =>
    call<void>('sftp_upload', { hostId, localPath, remotePath }),
  mkdir: (hostId: string, path: string) => call<void>('sftp_mkdir', { hostId, path }),
  rename: (hostId: string, from: string, to: string) =>
    call<void>('sftp_rename', { hostId, from, to }),
  disconnect: (hostId: string) => call<void>('sftp_disconnect', { hostId }),

  // Local filesystem
  localHome: () => call<string>('local_home'),
  localList: (path: string) => call<FileEntry[]>('local_list', { path }),
  localMkdir: (path: string) => call<void>('local_mkdir', { path }),
  localRename: (from: string, to: string) => call<void>('local_rename', { from, to }),
}
