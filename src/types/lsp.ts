/** A language server running on a host, for one workspace. */
export interface LspSessionType {
  id: string;
  hostId: string;
  serverId: string;
  root: string;
}

/** One JSON-RPC message from a server, with its framing already removed. */
export interface LspMessageType {
  sessionId: string;
  message: string;
}

export interface LspClosedType {
  sessionId: string;
  error: string | null;
}
