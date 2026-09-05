import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Link,
  PencilLine,
  RefreshCw,
  Scissors,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { writeClipboard } from '@/lib/clipboard';
import { fileKind } from '@/lib/file-kind';
import { joinPath, parentPath } from '@/lib/path';
import { cn } from '@/lib/utils';
import { sftpService } from '@/services/sftp.service';
import { confirmAtom, promptAtom } from '@/store/dialog';
import {
  activePathAtom,
  closeBufferAtom,
  editorHostIdAtom,
  editorRootAtom,
  fileClipboardAtom,
  openFileAtom,
} from '@/store/editor';
import type { FileEntryType } from '@/types/file';

type Listing = Map<string, FileEntryType[]>;

function RowIcon({ entry, open }: { entry: FileEntryType; open: boolean }) {
  if (entry.isDir) {
    const Icon = open ? FolderOpen : Folder;
    return <Icon className="text-primary/70 size-3.5 shrink-0" />;
  }
  const Icon = fileKind(entry) === 'code' ? FileCode : FileText;
  return <Icon className="size-3.5 shrink-0 opacity-70" />;
}

function relativeTo(root: string, path: string): string {
  const base = root.endsWith('/') ? root : `${root}/`;
  return path.startsWith(base) ? path.slice(base.length) : path;
}

function freeName(taken: Set<string>, name: string): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 1; ; n++) {
    const candidate =
      n === 1 ? `${stem} copy${ext}` : `${stem} copy ${n}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export default function FileTree() {
  const hostId = useAtomValue(editorHostIdAtom);
  const root = useAtomValue(editorRootAtom);
  const activePath = useAtomValue(activePathAtom);
  const openFile = useSetAtom(openFileAtom);
  const closeBuffer = useSetAtom(closeBufferAtom);
  const [clipboard, setClipboard] = useAtom(fileClipboardAtom);
  const prompt = useSetAtom(promptAtom);
  const confirm = useSetAtom(confirmAtom);

  const [listings, setListings] = useState<Listing>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyPaths, setBusyPaths] = useState<Set<string>>(new Set());

  const load = useCallback(
    (path: string) => {
      if (!hostId) return;
      void sftpService
        .list(hostId, path)
        .then((entries) =>
          setListings((prev) => new Map(prev).set(path, entries)),
        )
        .catch((e) => {
          toast.error(String(e));
          setListings((prev) => new Map(prev).set(path, []));
        });
    },
    [hostId],
  );

  useEffect(() => {
    if (root) load(root);
  }, [root, load]);

  const pending = useMemo(() => {
    const wanted = [root, ...expanded].filter((p): p is string => !!p);
    return wanted.filter((p) => !listings.has(p));
  }, [root, expanded, listings]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        if (!listings.has(path)) load(path);
      }
      return next;
    });
  };

  const refresh = () => {
    if (!root) return;
    setListings(new Map());
    load(root);
    expanded.forEach(load);
  };

  const reloadDir = (dir: string) => {
    if (dir === root || expanded.has(dir)) load(dir);
  };

  const rename = async (entry: FileEntryType) => {
    if (!hostId) return;
    const next = await prompt({
      title: `Rename ${entry.name}`,
      initialValue: entry.name,
      confirmLabel: 'Rename',
    });
    if (!next || next === entry.name) return;

    const dir = parentPath(entry.path);
    try {
      await sftpService.rename(hostId, entry.path, joinPath(dir, next));
      reloadDir(dir);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const remove = async (entry: FileEntryType) => {
    if (!hostId) return;
    const ok = await confirm({
      title: `Delete ${entry.name}?`,
      message: entry.isDir
        ? 'The folder and everything inside it is removed from the server. This cannot be undone.'
        : 'The file is removed from the server. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await sftpService.remove(hostId, entry.path, entry.isDir);
      if (!entry.isDir) await closeBuffer(entry.path);
      reloadDir(parentPath(entry.path));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const paste = async (target: FileEntryType | null) => {
    if (!hostId || !clipboard) return;
    const dir = target
      ? target.isDir
        ? target.path
        : parentPath(target.path)
      : (root ?? '/');

    if (clipboard.isDir && `${dir}/`.startsWith(`${clipboard.path}/`)) {
      toast.error('A folder cannot be pasted inside itself.');
      return;
    }

    setBusyPaths((prev) => new Set(prev).add(dir));
    try {
      const existing = await sftpService.list(hostId, dir);
      const to = joinPath(
        dir,
        freeName(new Set(existing.map((e) => e.name)), clipboard.name),
      );

      if (clipboard.op === 'cut') {
        await sftpService.rename(hostId, clipboard.path, to);
        setClipboard(null);
        reloadDir(parentPath(clipboard.path));
      } else {
        await sftpService.copy(hostId, clipboard.path, to);
      }
      reloadDir(dir);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusyPaths((prev) => {
        const next = new Set(prev);
        next.delete(dir);
        return next;
      });
    }
  };

  const copyText = async (text: string, label: string) => {
    if (await writeClipboard(text)) toast.success(`${label} copied`);
  };

  if (!hostId || !root) {
    return (
      <p className="text-muted-foreground px-3 py-4 text-xs">
        Choose a server to open its files.
      </p>
    );
  }

  const menuFor = (entry: FileEntryType) => (
    <ContextMenuContent>
      <ContextMenuItem
        onClick={() =>
          setClipboard({
            path: entry.path,
            name: entry.name,
            isDir: entry.isDir,
            op: 'copy',
          })
        }
      >
        <Copy />
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() =>
          setClipboard({
            path: entry.path,
            name: entry.name,
            isDir: entry.isDir,
            op: 'cut',
          })
        }
      >
        <Scissors />
        Cut
      </ContextMenuItem>
      <ContextMenuItem disabled={!clipboard} onClick={() => void paste(entry)}>
        <ClipboardPaste />
        Paste
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={() => void rename(entry)}>
        <PencilLine />
        Rename
      </ContextMenuItem>
      <ContextMenuItem variant="destructive" onClick={() => void remove(entry)}>
        <Trash2 />
        Delete
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={() => void copyText(entry.path, 'Path')}>
        <Link />
        Copy path
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() =>
          void copyText(relativeTo(root, entry.path), 'Relative path')
        }
      >
        <Link />
        Copy relative path
      </ContextMenuItem>
    </ContextMenuContent>
  );

  const rows = (dir: string, depth: number): React.ReactNode[] => {
    const entries = listings.get(dir);
    if (!entries) return [];

    return entries.flatMap((entry) => {
      const open = expanded.has(entry.path);
      const cutAway = clipboard?.op === 'cut' && clipboard.path === entry.path;
      const row = (
        <ContextMenu key={entry.path}>
          <ContextMenuTrigger
            render={
              <button
                type="button"
                title={entry.path}
                onClick={() =>
                  entry.isDir ? toggle(entry.path) : void openFile(entry.path)
                }
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                className={cn(
                  'flex w-full items-center gap-1.5 py-1 pr-2 text-left text-xs transition-colors',
                  entry.path === activePath
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  cutAway && 'opacity-45',
                  busyPaths.has(entry.path) && 'animate-pulse',
                )}
              />
            }
          >
            {entry.isDir ? (
              open ? (
                <ChevronDown className="size-3 shrink-0" />
              ) : (
                <ChevronRight className="size-3 shrink-0" />
              )
            ) : (
              <span className="size-3 shrink-0" />
            )}
            <RowIcon entry={entry} open={open} />
            <span className="truncate">{entry.name}</span>
          </ContextMenuTrigger>
          {menuFor(entry)}
        </ContextMenu>
      );

      return open ? [row, ...rows(entry.path, depth + 1)] : [row];
    });
  };

  const busy = pending.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex h-8 shrink-0 items-center gap-1 border-b pr-1 pl-3">
        <span
          className="text-muted-foreground truncate font-mono text-[11px]"
          title={root}
        >
          {root}
        </span>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          title="Refresh"
          onClick={refresh}
          disabled={busy}
        >
          <RefreshCw className={cn(busy && 'animate-spin')} />
        </Button>
      </div>

      <ContextMenu>
        <ContextMenuTrigger
          render={<div className="min-h-0 flex-1 overflow-auto py-1" />}
        >
          {rows(root, 0)}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={!clipboard}
            onClick={() => void paste(null)}
          >
            <ClipboardPaste />
            Paste
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void copyText(root, 'Path')}>
            <Link />
            Copy path
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
