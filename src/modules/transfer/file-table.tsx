import type { ReactNode } from 'react';
import { CornerLeftUp, FolderOpen } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TerctlLoader } from '@/components/chrome/TerctlLogo';
import type { FileEntryType } from '@/types/file';
import type { PaneTransferActionType, TransferSideType } from '@/types/transfer';
import { setDragPayload } from '@/lib/dnd';
import FileRow from './file-row';

interface FileTableProps {
  entries: FileEntryType[];
  side: TransferSideType;
  busy: boolean;
  error: string | null;
  /** Shown instead of the table when the pane has nothing to browse yet. */
  placeholder?: string;
  /** Rendered under the placeholder — e.g. a "Choose server" button. */
  placeholderAction?: ReactNode;
  /** False at the filesystem root, where there is no parent to go back to. */
  canGoUp: boolean;
  onGoUp: () => void;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  onOpen: (entry: FileEntryType) => void;
  onRename: (entry: FileEntryType) => void;
  onDelete: (entries: FileEntryType[]) => void;
  action: PaneTransferActionType;
  /** Opposite pane — the origin whose drags folders here accept. */
  acceptsFrom: TransferSideType;
  onDropInto: (entries: FileEntryType[], destDir: string) => void;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-40 flex-1 items-center justify-center p-6">{children}</div>;
}

/** The `..` row: always first, so going back never requires the toolbar. */
function ParentRow({ onGoUp }: { onGoUp: () => void }) {
  return (
    <TableRow className="group/row" onDoubleClick={onGoUp}>
      <TableCell className="w-8 pr-0" />
      <TableCell className="max-w-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <CornerLeftUp className="size-3.5" />
          </span>
          <button
            type="button"
            onClick={onGoUp}
            className="font-mono font-medium hover:underline"
            title="Go to parent directory"
          >
            ..
          </button>
        </div>
      </TableCell>
      <TableCell className="hidden w-24 @md:table-cell" />
      <TableCell className="w-20" />
      <TableCell className="w-16" />
    </TableRow>
  );
}

export default function FileTable({
  entries,
  side,
  busy,
  error,
  placeholder,
  placeholderAction,
  canGoUp,
  onGoUp,
  selected,
  onSelectedChange,
  onOpen,
  onRename,
  onDelete,
  action,
  acceptsFrom,
  onDropInto,
}: FileTableProps) {
  if (busy) {
    return (
      <Centered>
        <TerctlLoader size={40} />
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <p className="max-w-xs text-center font-mono text-xs break-words text-destructive">
          {error}
        </p>
      </Centered>
    );
  }

  if (placeholder) {
    return (
      <Centered>
        <Empty className="p-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>Nothing to browse</EmptyTitle>
            <EmptyDescription>{placeholder}</EmptyDescription>
          </EmptyHeader>
          {placeholderAction && <EmptyContent>{placeholderAction}</EmptyContent>}
        </Empty>
      </Centered>
    );
  }

  // An empty directory still renders the table when it has a parent, otherwise
  // the `..` row would vanish and leave no way back out.
  if (entries.length === 0 && !canGoUp) {
    return (
      <Centered>
        <Empty className="p-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>Empty folder</EmptyTitle>
            <EmptyDescription>This directory has no files to show.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Centered>
    );
  }

  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.path));

  /** Dragging a selected row carries the whole selection; otherwise just it. */
  const startDrag = (entry: FileEntryType) => (e: React.DragEvent) => {
    const payload =
      selected.has(entry.path) && selected.size > 1
        ? entries.filter((candidate) => selected.has(candidate.path))
        : [entry];
    setDragPayload(e.dataTransfer, side, payload);
  };

  const toggle = (path: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(path);
    else next.delete(path);
    onSelectedChange(next);
  };

  return (
    <div className="@container min-h-0 flex-1 overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="w-8 pr-0">
              <Checkbox
                checked={allSelected}
                disabled={entries.length === 0}
                onCheckedChange={(value) =>
                  onSelectedChange(
                    value === true ? new Set(entries.map((e) => e.path)) : new Set(),
                  )
                }
                aria-label="Select all files"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden w-24 text-right @md:table-cell">Modified</TableHead>
            <TableHead className="w-20 text-right">Size</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {canGoUp && <ParentRow onGoUp={onGoUp} />}
          {entries.map((entry) => (
            <FileRow
              key={entry.path}
              entry={entry}
              side={side}
              selected={selected.has(entry.path)}
              onSelectedChange={(on) => toggle(entry.path, on)}
              onOpen={() => onOpen(entry)}
              onRename={() => onRename(entry)}
              onDelete={() => onDelete(selected.has(entry.path) && selected.size > 1 ? entries.filter((c) => selected.has(c.path)) : [entry])}
              action={action}
              onDragStart={startDrag(entry)}
              acceptsFrom={acceptsFrom}
              onDropInto={onDropInto}
            />
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                This folder is empty.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
