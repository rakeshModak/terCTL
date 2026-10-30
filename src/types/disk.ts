export interface DiskEntryType {
  name: string;
  sizeKb: number;
  isDir: boolean;
  /** Something inside couldn't be read, so `sizeKb` is a lower bound. */
  partial: boolean;
}

/** One level of the disk map: a folder's direct children, biggest first. */
export interface DiskListingType {
  path: string;
  totalKb: number;
  /** The filesystem `path` lives on. */
  diskUsedKb: number;
  diskTotalKb: number;
  entries: DiskEntryType[];
}

export type CleanupIdType =
  | 'journal'
  | 'rotated_logs'
  | 'package_cache'
  | 'docker_build_cache'
  | 'docker_images'
  | 'docker_containers'
  | 'docker_volumes'
  | 'pm2_logs'
  | 'truncate_logs';

export interface CleanupItemType {
  id: CleanupIdType;
  /** Best estimate of what running it frees. */
  freesKb: number;
  count: number | null;
  /** Shown to the user before anything runs. */
  command: string;
  /** `docker_volumes`: unused volumes, each opted into by name. */
  names: string[];
  /** `truncate_logs`: big live logs, each opted into by path. */
  files: { path: string; sizeKb: number }[];
}

export interface CleanupScanType {
  /** How the server grants root: as root, passwordless sudo, or not at all. */
  privilege: 'root' | 'sudo' | 'none';
  items: CleanupItemType[];
}

export interface CleanupActionType {
  id: CleanupIdType;
  names?: string[];
  paths?: string[];
}

export interface CleanupReportType {
  outcomes: { id: CleanupIdType; ok: boolean; message: string }[];
  /** Drop in `/` usage across the run, as df measured it. */
  freedKb: number;
}
