/** Human-readable byte count. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function formatSize(bytes: number, isDir: boolean): string {
  return isDir ? '—' : formatBytes(bytes);
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 1) return '—';
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m}m ${String(Math.floor(seconds % 60)).padStart(2, '0')}s`;
  }
  const h = Math.floor(seconds / 3600);
  return `${h}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
}

export function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return '';
  const d = new Date(unixSeconds * 1000);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}
