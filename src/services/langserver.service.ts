import { call } from './config/tauri-api';
import type { HostServersType } from '@/types/langserver';

export const langServerService = {
  list: (hostId: string) => call<HostServersType>('lsp_list', { hostId }),
  install: (hostId: string, serverId: string) =>
    call<string>('lsp_install', { hostId, serverId }),
  uninstall: (hostId: string, serverId: string) =>
    call<string>('lsp_uninstall', { hostId, serverId }),
  disconnect: (hostId: string) => call<void>('lsp_disconnect', { hostId }),
};
