export type EolType = 'lf' | 'crlf';

export interface FileStatType {
  mtime: number;
  size: number;
}

export interface OpenedFileType {
  path: string;
  content: string;
  eol: EolType;
  bom: boolean;
  stat: FileStatType;
}

export interface BufferType extends OpenedFileType {
  name: string;
  draft: string;
  saving: boolean;
}

export interface FileClipboardType {
  path: string;
  name: string;
  isDir: boolean;
  op: 'copy' | 'cut';
}
