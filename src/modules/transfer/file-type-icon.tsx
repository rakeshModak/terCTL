import { Archive, FileCode, FileText, Film, Folder, ImageIcon, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fileKind } from '@/lib/file-kind';
import type { FileEntryType } from '@/types/file';
import type { FileKindType } from '@/types/transfer';

/**
 * Icon + tint per file family. Colors come from the chart tokens — chart-1 and
 * chart-2 are derived from the accent, so the palette shifts with it rather
 * than being a fixed rainbow.
 */
const KIND_STYLE: Record<FileKindType, { className: string; Icon: typeof Folder }> = {
  folder: { className: 'bg-primary/15 text-primary', Icon: Folder },
  image: { className: 'bg-chart-2/15 text-chart-2', Icon: ImageIcon },
  code: { className: 'bg-chart-3/15 text-chart-3', Icon: FileCode },
  archive: { className: 'bg-chart-5/15 text-chart-5', Icon: Archive },
  document: { className: 'bg-chart-4/15 text-chart-4', Icon: FileText },
  media: { className: 'bg-chart-1/15 text-chart-1', Icon: Film },
  file: { className: 'bg-muted text-muted-foreground', Icon: FileText },
};

export default function FileTypeIcon({ entry }: { entry: FileEntryType }) {
  const { className, Icon } = KIND_STYLE[fileKind(entry)];
  return (
    <span
      className={cn('relative flex size-7 shrink-0 items-center justify-center rounded-md', className)}
    >
      <Icon className="size-3.5" />
      {entry.isLink && (
        <Link2 className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-card p-px text-muted-foreground" />
      )}
    </span>
  );
}
