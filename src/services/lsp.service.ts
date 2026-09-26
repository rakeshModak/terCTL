import { listen } from '@tauri-apps/api/event';
import { call } from './config/tauri-api';
import type {
  LspClosedType,
  LspMessageType,
  LspSessionType,
} from '@/types/lsp';

// Driving a language server on the remote host. Messages cross this boundary
// as bare JSON-RPC; the Rust side owns the Content-Length framing.
export const lspService = {
  start: (hostId: string, serverId: string, root: string) =>
    call<LspSessionType>('lsp_start', { hostId, serverId, root }),
  send: (sessionId: string, message: string) =>
    call<void>('lsp_send', { sessionId, message }),
  stop: (sessionId: string) => call<void>('lsp_stop', { sessionId }),
  /** Stops every server on a host, and the connection carrying them. */
  stopHost: (hostId: string) => call<void>('lsp_stop_host', { hostId }),
  onMessage: (handler: (message: LspMessageType) => void) =>
    listen<LspMessageType>('lsp://message', (event) => handler(event.payload)),
  onClosed: (handler: (closed: LspClosedType) => void) =>
    listen<LspClosedType>('lsp://closed', (event) => handler(event.payload)),
};
