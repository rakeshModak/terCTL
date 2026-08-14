import { useState } from 'react';
import { ArrowLeftToLine, ArrowRightToLine, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { isDragFrom, readDragPayload } from '@/lib/dnd';
import { formatDate, formatSize } from '@/lib/format';
import type { FileEntryType } from '@/types/file';
import type { PaneTransferActionType, TransferSideType } from '@/types/transfer';
import FileTypeIcon from './file-type-icon';

interface FileRowProps {
  entry: FileEntryType;
  side: TransferSideType;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  action: PaneTransferActionType;
  /** Entries this drag carries — the whole selection when the row is in it. */
  onDragStart: (e: React.DragEvent) => void;
  /** Side whose drags this pane accepts; folders act as drop targets. */
  acceptsFrom: TransferSideType;
  onDropInto: (entries: FileEntryType[], destDir: string) => void;
}

export default function FileRow({
  entry,
  side,
  selected,
  onSelectedChange,
  onOpen,
  onRename,
  onDelete,
  action,
  onDragStart,
  acceptsFrom,
  onDropInto,
}: FileRowProps) {
  // Upload pushes local → remote, download pulls remote → local.
  const TransferIcon = side === 'local' ? ArrowRightToLine : ArrowLeftToLine;
  const canTransfer = !entry.isDir && action.enabled;
  const [dropTarget, setDropTarget] = useState(false);

  // Only folders accept drops, and only from the opposite pane.
  const canAcceptDrop = entry.isDir;

  return (
    <TableRow
      data-state={selected ? 'selected' : undefined}
      className={cn('group/row', dropTarget && 'bg-primary/10 outline outline-primary')}
      draggable
      onDragStart={onDragStart}
      onDoubleClick={() => entry.isDir && onOpen()}
      onDragOver={(e) => {
        if (!canAcceptDrop || !isDragFrom(e.dataTransfer, acceptsFrom)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setDropTarget(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(false);
      }}
      onDrop={(e) => {
        if (!canAcceptDrop || !isDragFrom(e.dataTransfer, acceptsFrom)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(false);
        const entries = readDragPayload(e.dataTransfer, acceptsFrom);
        if (entries.length > 0) onDropInto(entries, entry.path);
      }}
    >
      <TableCell className="w-8 pr-0">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelectedChange(value === true)}
          aria-label={`Select ${entry.name}`}
        />
      </TableCell>

      <TableCell className="max-w-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileTypeIcon entry={entry} />
          {entry.isDir ? (
            <button
              type="button"
              onClick={onOpen}
              className="min-w-0 truncate text-left font-medium hover:underline"
            >
              {entry.name}
            </button>
          ) : (
            <span className="min-w-0 truncate">{entry.name}</span>
          )}
        </div>
      </TableCell>

      <TableCell className="hidden w-24 text-right text-xs whitespace-nowrap text-muted-foreground @md:table-cell">
        {formatDate(entry.modified)}
      </TableCell>

      <TableCell className="w-20 text-right text-xs whitespace-nowrap tabular-nums text-muted-foreground">
        {formatSize(entry.size, entry.isDir)}
      </TableCell>

      <TableCell className="w-16 pl-0">
        <div className="flex items-center justify-end gap-0.5">
          {canTransfer && (
            <Button
              variant="ghost"
              size="icon-xs"
              title={`${action.label} ${entry.name}`}
              className={cn(
                'opacity-0 transition-opacity',
                'group-hover/row:opacity-100 focus-visible:opacity-100',
              )}
              onClick={() => action.run([entry])}
            >
              <TransferIcon />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                />
              }
            >
              <MoreHorizontal />
              <span className="sr-only">Actions for {entry.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canTransfer && (
                <DropdownMenuItem onClick={() => action.run([entry])}>
                  <TransferIcon />
                  {action.label}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onRename}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
