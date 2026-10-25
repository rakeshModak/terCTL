/** Where a browser pane is pointed, expressed in the *server's* terms. */
export interface Address {
  /** What the server dials. Loopback unless the user aimed somewhere else. */
  host: string;
  port: number;
  /** Always begins with `/`. */
  path: string;
}

const isValidPort = (port: number) =>
  Number.isInteger(port) && port >= 1 && port <= 65535;

/** `127.0.0.1:3000/api` — how an address reads in the bar and the pane title. */
export function formatAddress(address: Address): string {
  return `${address.host}:${address.port}${address.path}`;
}

/**
 * Read what someone typed into the address bar, in any of the shapes they
 * reasonably might: `3000`, `/health`, `127.0.0.1:3000/api`,
 * `http://localhost:8080`, `[::1]:9000`.
 *
 * The host is whatever the *server* will connect to, not this machine — so a
 * private hostname here reaches boxes only the server can see, the same way
 * `ssh -L` does. Returns null when there is nothing to forward to.
 */
export function parseAddress(input: string, current: Address): Address | null {
  const trimmed = input.trim().replace(/^[a-z][\w+.-]*:\/\//i, '');
  if (!trimmed) return null;

  // Path only: same service, different page.
  if (trimmed.startsWith('/')) return { ...current, path: trimmed };

  // A bare number is a port — the quickest way to hop to another service.
  if (/^\d+$/.test(trimmed)) {
    const port = Number(trimmed);
    return isValidPort(port) ? { host: current.host, port, path: '/' } : null;
  }

  const slash = trimmed.indexOf('/');
  const authority = slash === -1 ? trimmed : trimmed.slice(0, slash);
  const path = slash === -1 ? '/' : trimmed.slice(slash);

  // Splitting from the right keeps `[::1]:9000` in one piece.
  const colon = authority.lastIndexOf(':');
  if (colon === -1) return null; // a host with no port names no service
  const host = authority.slice(0, colon).replace(/^\[|\]$/g, '');
  const port = Number(authority.slice(colon + 1));
  if (!host || !isValidPort(port)) return null;
  return { host, port, path };
}
