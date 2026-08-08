import type { FileEntryType } from '@/types/file';

/** Which half of the transfer view a pane represents. */
export type TransferSideType = 'local' | 'remote';

/** Transient feedback line shown in the transfer header. */
export interface TransferStatusType {
  message: string;
  kind: 'info' | 'error';
}

/** Broad file family, used to colour the row icon. */
export type FileKindType =
  | 'folder'
  | 'image'
  | 'code'
  | 'archive'
  | 'document'
  | 'media'
  | 'file';

/** The cross-pane action a row offers (upload from local, download from remote). */
export interface PaneTransferActionType {
  label: string;
  enabled: boolean;
  /** `destDir` defaults to the opposite pane's current folder. */
  run: (entries: FileEntryType[], destDir?: string) => void;
}
