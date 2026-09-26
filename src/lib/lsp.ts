import {
  LSPClient,
  languageServerSupport,
  type Transport,
} from '@codemirror/lsp-client';
import type { Extension } from '@codemirror/state';
import { debugLog } from '@/lib/debugLog';
import { lspService } from '@/services/lsp.service';

/**
 * Connecting the editor to a language server running on the remote host.
 *
 * One server is shared by every file in a workspace — that is what the servers
 * themselves expect — so clients are cached per host, server and root. The
 * paths and URIs here are the *server's*: it runs on the remote, so
 * `file:///var/www/app.py` means that machine's filesystem, not this one's.
 */

/**
 * Which installed server handles which language.
 *
 * Keys are the ids from @/lib/language; values are the ids in the Rust
 * catalogue. A language that is missing here simply gets no server, which is
 * the state every language was in before this existed.
 */
const SERVER_FOR_LANGUAGE: Record<string, string> = {
  python: 'python',
  go: 'go',
  rust: 'rust',
  c: 'clangd',
  cpp: 'clangd',
  // The catalogue calls the shell server 'bash', after its binary.
  shell: 'bash',
  yaml: 'yaml',
};

export function serverForLanguage(language: string): string | null {
  return SERVER_FOR_LANGUAGE[language] ?? null;
}

/** A remote path as the server will understand it. */
export function fileUri(path: string): string {
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
}

type Handler = (message: string) => void;

/**
 * Every server's traffic arrives on one event, so messages are routed to the
 * right client by session id rather than opening a listener per server.
 */
const inboxes = new Map<string, Set<Handler>>();
let routing: Promise<() => void> | null = null;

function startRouting() {
  routing ??= lspService.onMessage(({ sessionId, message }) => {
    const inbox = inboxes.get(sessionId);
    if (!inbox) return;
    for (const handler of inbox) handler(message);
  });
}

const clients = new Map<string, Promise<LSPClient>>();
const sessionKeys = new Map<string, string>();

/** A server that died takes its client with it, so the next file retries. */
let watchingClosures: Promise<() => void> | null = null;
function watchClosures() {
  watchingClosures ??= lspService.onClosed(({ sessionId, error }) => {
    if (error) debugLog(`language server stopped: ${error}`);
    inboxes.delete(sessionId);
    const key = sessionKeys.get(sessionId);
    if (key) {
      clients.delete(key);
      sessionKeys.delete(sessionId);
    }
  });
}

async function clientFor(
  hostId: string,
  serverId: string,
  root: string,
): Promise<LSPClient> {
  const key = `${hostId}|${serverId}|${root}`;
  const existing = clients.get(key);
  if (existing) return existing;

  const starting = (async () => {
    const session = await lspService.start(hostId, serverId, root);
    startRouting();
    watchClosures();

    const inbox = new Set<Handler>();
    inboxes.set(session.id, inbox);
    sessionKeys.set(session.id, key);

    const transport: Transport = {
      send: (message) => {
        void lspService
          .send(session.id, message)
          .catch((e) => debugLog(`could not reach the language server: ${e}`));
      },
      subscribe: (handler) => inbox.add(handler),
      unsubscribe: (handler) => inbox.delete(handler),
    };

    const client = new LSPClient({ rootUri: fileUri(root) });
    client.connect(transport);
    return client;
  })();

  clients.set(key, starting);
  // A server that failed to start should not be cached as broken forever.
  starting.catch(() => clients.delete(key));
  return starting;
}

/**
 * The editor extension that wires one file to its language server, or null
 * when the language has no server configured.
 *
 * Callers must treat a rejection as "no language server" and carry on — a
 * missing binary on the remote is an ordinary state, not a failure worth
 * interrupting editing for.
 */
export async function languageServerFor(
  hostId: string,
  root: string,
  language: string,
  path: string,
): Promise<Extension | null> {
  const serverId = serverForLanguage(language);
  if (!serverId) return null;
  const client = await clientFor(hostId, serverId, root);
  return languageServerSupport(client, fileUri(path), language);
}

/** Forget every server on a host — used when the editor changes workspace. */
export function releaseLanguageServers(hostId: string) {
  for (const key of [...clients.keys()]) {
    if (key.startsWith(`${hostId}|`)) clients.delete(key);
  }
  void lspService
    .stopHost(hostId)
    .catch((e) => debugLog(`could not stop language servers: ${e}`));
}
