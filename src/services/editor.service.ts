import { call } from './config/tauri-api';
import type { EolType, FileStatType, OpenedFileType } from '@/types/editor';

export const editorService = {
  read: (hostId: string, path: string) =>
    call<OpenedFileType>('editor_read_file', { hostId, path }),

  write: (
    hostId: string,
    path: string,
    content: string,
    eol: EolType,
    bom: boolean,
    expected: FileStatType | null,
  ) =>
    call<FileStatType>('editor_write_file', {
      hostId,
      path,
      content,
      eol,
      bom,
      expected,
    }),
};
