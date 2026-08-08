import { extensionOf } from '@/lib/path';
import type { FileEntryType } from '@/types/file';
import type { FileKindType } from '@/types/transfer';

const EXTENSIONS: Record<string, FileKindType> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image', ico: 'image',
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', json: 'code', rs: 'code', py: 'code',
  go: 'code', sh: 'code', yml: 'code', yaml: 'code', toml: 'code', html: 'code', css: 'code',
  zip: 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', xz: 'archive', rar: 'archive', '7z': 'archive',
  md: 'document', txt: 'document', pdf: 'document', doc: 'document', docx: 'document', log: 'document',
  mp4: 'media', mkv: 'media', mov: 'media', mp3: 'media', wav: 'media', flac: 'media',
};

/** Broad family for an entry, used to pick its row icon and tint. */
export function fileKind(entry: FileEntryType): FileKindType {
  if (entry.isDir) return 'folder';
  return EXTENSIONS[extensionOf(entry.name)] ?? 'file';
}
