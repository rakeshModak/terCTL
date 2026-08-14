/** POSIX-style path helpers. Remote paths are always POSIX; local ones are
 *  normalised to forward slashes by the Rust side, so one set covers both. */

/** Parent directory of `p`, bottoming out at "/". */
export function parentPath(p: string): string {
  const trimmed = p.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx <= 0 ? '/' : trimmed.slice(0, idx);
}

/** Join a directory and a single segment without doubling the separator. */
export function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
}

/** Path split into breadcrumb segments, each with the path that opens it. */
export function pathSegments(p: string): { name: string; path: string }[] {
  const parts = p.split('/').filter(Boolean);
  return parts.map((name, i) => ({
    name,
    path: `/${parts.slice(0, i + 1).join('/')}`,
  }));
}

/** Lowercased extension without the dot, or '' when there isn't one. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}
