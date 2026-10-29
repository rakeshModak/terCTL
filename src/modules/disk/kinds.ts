import {
  Boxes,
  Cpu,
  File,
  Folder,
  Home,
  ScrollText,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { DiskEntryType } from '@/types/disk';

/** What a folder holds, guessed from its name (and, for the names that mean
    different things in different places, from where it sits). The colour is
    the point: a glance tells logs from data from system files. */
export type Kind =
  'logs' | 'data' | 'system' | 'home' | 'cache' | 'apps' | 'file';

export interface KindStyle {
  label: string;
  /** A theme token, so every theme and both modes get a matching hue. */
  color: string;
  icon: LucideIcon;
}

export const KINDS: Record<Kind, KindStyle> = {
  logs: { label: 'Logs', color: 'var(--amber)', icon: ScrollText },
  data: { label: 'Data & Docker', color: 'var(--blue)', icon: Boxes },
  system: { label: 'System', color: 'var(--purple)', icon: Cpu },
  home: { label: 'Home', color: 'var(--green)', icon: Home },
  cache: { label: 'Cache & temp', color: 'var(--red)', icon: Trash2 },
  apps: { label: 'Apps & other', color: 'var(--brand)', icon: Folder },
  file: { label: 'Files', color: 'var(--foreground)', icon: File },
};

const LOGS = new Set(['log', 'logs', 'journal']);
const DATA = new Set([
  'docker',
  'containerd',
  'containers',
  'overlay2',
  'volumes',
  'image',
  'mysql',
  'postgresql',
  'mongodb',
  'redis',
  'elasticsearch',
  'data',
  'db',
  'snapd',
]);
const SYSTEM_ROOT = new Set([
  'usr',
  'boot',
  'etc',
  'bin',
  'sbin',
  'lib',
  'lib32',
  'lib64',
  'snap',
  'proc',
  'sys',
  'dev',
  'run',
  'System',
  'Library',
]);
const HOME = new Set(['home', 'root', 'Users']);
const CACHE = new Set(['cache', 'tmp', 'temp', '.cache', 'backups', 'trash']);

export function kindOf(entry: DiskEntryType, parent: string): Kind {
  if (!entry.isDir) return entry.name.endsWith('.log') ? 'logs' : 'file';
  const n = entry.name;
  if (LOGS.has(n)) return 'logs';
  if (CACHE.has(n)) return 'cache';
  if (HOME.has(n) && parent === '/') return 'home';
  // `lib` at the root is system libraries; `/var/lib` is where services keep data.
  if (n === 'lib' && parent === '/var') return 'data';
  if (SYSTEM_ROOT.has(n) && parent === '/') return 'system';
  if (DATA.has(n) || parent.startsWith('/var/lib')) return 'data';
  if (parent === '/usr' || parent.startsWith('/usr/')) return 'system';
  if (parent === '/var/log' || parent.startsWith('/var/log/')) return 'logs';
  if (parent === '/home' || parent.startsWith('/home/') || parent === '/root')
    return 'home';
  return 'apps';
}
