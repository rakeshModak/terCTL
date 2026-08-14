import type { FileEntryType } from '@/types/file';

export type TransferSideType = 'local' | 'remote';
export type TransferDirectionType = 'upload' | 'download';
export type TransferStateType =
  | 'queued'
  | 'active'
  | 'done'
  | 'cancelled'
  | 'error';

export interface TransferItemType {
  id: string;
  name: string;
  direction: TransferDirectionType;
  destDir: string;
  total: number;
  transferred: number;
  bytesPerSec: number;
  state: TransferStateType;
  error?: string;
}

export interface TransferProgressType {
  id: string;
  transferred: number;
  total: number;
  bytesPerSec: number;
}

export interface TransferResultType {
  bytes: number;
  cancelled: boolean;
}

export type FileKindType =
  | 'folder'
  | 'image'
  | 'code'
  | 'archive'
  | 'document'
  | 'media'
  | 'file';

export interface PaneTransferActionType {
  label: string;
  enabled: boolean;
  run: (entries: FileEntryType[], destDir?: string) => void;
}
