import { listen } from '@tauri-apps/api/event';
import { call } from './config/tauri-api';
import type {
  ListeningPortType,
  PaneRectType,
  ProbeResultType,
  TunnelClosedType,
  TunnelType,
  ViewNavigatedType,
} from '@/types/browser';

// SSH local port forwarding, and the probe the in-app browser rides on.
export const browserService = {
  /** `remoteHost` defaults to the server's own loopback. */
  openTunnel: (hostId: string, remotePort: number, remoteHost?: string) =>
    call<TunnelType>('tunnel_open', {
      hostId,
      remotePort,
      remoteHost: remoteHost ?? null,
    }),
  closeTunnel: (tunnelId: string) => call<void>('tunnel_close', { tunnelId }),
  listTunnels: () => call<TunnelType[]>('tunnel_list'),
  /** Drops the host's forwarding connection, and every forward riding on it. */
  disconnect: (hostId: string) => call<void>('tunnel_disconnect', { hostId }),
  listeningPorts: (hostId: string) =>
    call<ListeningPortType[]>('tunnel_listening_ports', { hostId }),
  probe: (tunnelId: string, path: string) =>
    call<ProbeResultType>('tunnel_probe', { tunnelId, path }),
  onTunnelClosed: (handler: (closed: TunnelClosedType) => void) =>
    listen<TunnelClosedType>('tunnel://closed', (event) =>
      handler(event.payload),
    ),

  // The page itself lives in a child webview rather than a frame, so it is
  // driven by command instead of by markup. `label` is the pane's session id.
  view: {
    open: (label: string, url: string, rect: PaneRectType) =>
      call<void>('browser_view_open', { label, url, rect }),
    setRect: (label: string, rect: PaneRectType) =>
      call<void>('browser_view_set_rect', { label, rect }),
    show: (label: string, rect: PaneRectType) =>
      call<void>('browser_view_show', { label, rect }),
    hide: (label: string) => call<void>('browser_view_hide', { label }),
    close: (label: string) => call<void>('browser_view_close', { label }),
    navigate: (label: string, url: string) =>
      call<void>('browser_view_navigate', { label, url }),
    reload: (label: string) => call<void>('browser_view_reload', { label }),
    back: (label: string) => call<void>('browser_view_back', { label }),
    forward: (label: string) => call<void>('browser_view_forward', { label }),
    onNavigated: (handler: (nav: ViewNavigatedType) => void) =>
      listen<ViewNavigatedType>('browser://navigated', (event) =>
        handler(event.payload),
      ),
    /** The pane tried to leave the forwarded service; open it properly instead. */
    onExternal: (handler: (nav: ViewNavigatedType) => void) =>
      listen<ViewNavigatedType>('browser://external', (event) =>
        handler(event.payload),
      ),
  },
};
