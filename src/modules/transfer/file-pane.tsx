import { useMemo, useState, type ReactNode } from 'react';
import { ChevronUp, Monitor, Server, Trash2 } from 'lucide-react';
import { isDragFrom, readDragPayload } from '@/lib/dnd';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FilePaneController } from '@/hooks/useFileTransfer';
import type { FileEntryType } from '@/types/file';
import type { PaneTransferActionType, TransferSideType } from '@/types/transfer';
import FileTable from './file-table';
import PaneActionsMenu from './pane-actions-menu';
import PathBar from './path-bar';

interface FilePaneProps {
  title: string;
  side: TransferSideType;
  pane: FilePaneController;
  /** Set when the pane cannot browse yet (e.g. no server chosen). */
  placeholder?: string;
  /** Extra control in the header, e.g. the remote pane's server button. */
  headerAction?: ReactNode;
  /** Action offered inside the placeholder empty state. */
  placeholderAction?: ReactNode;
  action: PaneTransferActionType;
  /** Opposite pane: drags from there drop into this one. */
  acceptsFrom: TransferSideType;
  onDropInto: (entries: FileEntryType[], destDir: string) => void;
}

export default function FilePane({
  title,
  side,
  pane,
  placeholder,
  headerAction,
  placeholderAction,
  action,
  acceptsFrom,
  onDropInto,
}: FilePaneProps) {
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropActive, setDropActive] = useState(false);

  const visible = useMemo(
    () => (showHidden ? pane.entries : pane.entries.filter((e) => !e.name.startsWith('.'))),
    [pane.entries, showHidden],
  );

  const selectedEntry = pane.entries.find((e) => selected.has(e.path)) ?? null;
  const SideIcon = side === 'local' ? Monitor : Server;
  const canGoUp = !!pane.path && pane.path !== '/';

  return (
    <section
      className={cn(
        'relative flex min-w-0 flex-1 flex-col border-r border-border last:border-r-0',
        dropActive && 'bg-primary/5 outline-2 -outline-offset-2 outline-primary',
      )}
      onDragOver={(e) => {
        // Only react to drags from the other pane, and only when this pane can
        // actually receive them.
        if (placeholder || !isDragFrom(e.dataTransfer, acceptsFrom)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
      }}
      onDrop={(e) => {
        if (placeholder || !isDragFrom(e.dataTransfer, acceptsFrom)) return;
        e.preventDefault();
        setDropActive(false);
        const entries = readDragPayload(e.dataTransfer, acceptsFrom);
        // No destDir: falls back to the folder this pane currently shows.
        if (entries.length > 0) onDropInto(entries, pane.path);
      }}
    >
      <header className="flex flex-col gap-2 border-b border-border bg-sidebar px-4 py-3">
        <div className="flex items-center gap-2">
          <SideIcon className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {selected.size > 0 && (
            <>
              <Badge variant="secondary" className="tabular-nums">
                {selected.size} selected
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                title={`Delete ${selected.size} selected`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  pane.remove(pane.entries.filter((e) => selected.has(e.path)));
                  setSelected(new Set());
                }}
              >
                <Trash2 />
              </Button>
            </>
          )}
          <div className="flex-1" />
          {headerAction}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Up one level"
            disabled={!canGoUp}
            onClick={pane.up}
          >
            <ChevronUp />
          </Button>
          <PaneActionsMenu
            disabled={!!placeholder}
            showHidden={showHidden}
            hasSelection={!!selectedEntry}
            onToggleHidden={() => setShowHidden((v) => !v)}
            onRefresh={pane.refresh}
            onNewFolder={pane.newFolder}
            onRename={() => selectedEntry && pane.rename(selectedEntry)}
          />
        </div>
        {pane.path && <PathBar path={pane.path} onNavigate={pane.navigate} />}
      </header>

      <FileTable
        entries={visible}
        side={side}
        busy={pane.busy}
        error={pane.error}
        placeholder={placeholder}
        placeholderAction={placeholderAction}
        canGoUp={canGoUp}
        onGoUp={pane.up}
        selected={selected}
        onSelectedChange={setSelected}
        onOpen={pane.open}
        onRename={pane.rename}
        onDelete={pane.remove}
        action={action}
        acceptsFrom={acceptsFrom}
        onDropInto={onDropInto}
      />
    </section>
  );
}
