import { call } from './config/tauri-api';
import type {
  CleanupActionType,
  CleanupReportType,
  CleanupScanType,
  DiskListingType,
} from '@/types/disk';

export const diskService = {
  /** Sizes of `path`'s direct children on the host. Walks that subtree, so it
      can take a while on a big folder. */
  list: (hostId: string, path: string) =>
    call<DiskListingType>('disk_usage', { hostId, path }),
  /** Measures what each known cleanup would free. Deletes nothing. */
  scanCleanup: (hostId: string) =>
    call<CleanupScanType>('disk_cleanup_scan', { hostId }),
  runCleanup: (hostId: string, actions: CleanupActionType[]) =>
    call<CleanupReportType>('disk_cleanup_run', { hostId, actions }),
};
