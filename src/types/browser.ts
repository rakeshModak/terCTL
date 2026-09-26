/**
 * A live SSH local port forward. Point a browser at `127.0.0.1:localPort`
 * here and the bytes come out at `remoteHost:remotePort` on the server.
 */
export interface TunnelType {
  id: string;
  hostId: string;
  remoteHost: string;
  remotePort: number;
  localPort: number;
}

/** One socket the remote reported in LISTEN state. */
export interface ListeningPortType {
  port: number;
  /** The bind address as the remote spelled it: `127.0.0.1`, `0.0.0.0`, `::`. */
  address: string;
  /** Bound only to the server's loopback — the case a forward exists to fix. */
  loopback: boolean;
  process: string | null;
  pid: number | null;
}

/** What one HTTP request through a forward came back with. */
export interface ProbeResultType {
  status: number | null;
  statusText: string | null;
  server: string | null;
  contentType: string | null;
  /** Names the response header that forbids embedding, when one does. */
  blockedBy: string | null;
  elapsedMs: number;
}

export interface TunnelClosedType {
  tunnelId: string;
  error: string | null;
}

export interface PaneRectType {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewNavigatedType {
  label: string;
  url: string;
}
