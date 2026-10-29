import { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import {
  AlertTriangle,
  ArrowUp,
  ChevronRight,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatKb } from '@/lib/format';
import { joinPath, parentPath, pathSegments } from '@/lib/path';
import { diskService } from '@/services/disk.service';
import type { DiskEntryType, DiskListingType } from '@/types/disk';
import CleanupPanel from './cleanup-panel';
import DiskList from './disk-list';
import DiskOverview from './disk-overview';
import Treemap from './treemap';

interface DiskUsageDialogProps {
  open: boolean;
  onClose: () => void;
  hostId: string;
  hostLabel: string;
}

type Layout = 'map' | 'list';

/** Remembered like the other UI preferences, so the dialog reopens in the
    view the user last picked. */
const layoutAtom = atomWithStorage<Layout>(
  'terctl-disk-layout',
  'map',
  undefined,
  {
    getOnInit: true,
  },
);

/** Folders where a cleanup is the likely next step, with the nudge to show. */
function cleanupHint(path: string): string | null {
  if (path === '/var/log' || path.startsWith('/var/log/'))
    return 'Clean old logs';
  if (path === '/var/lib/docker' || path.startsWith('/var/lib/docker/'))
    return 'Docker cleanup';
  return null;
}

export default function DiskUsageDialog({
  open,
  onClose,
  hostId,
  hostLabel,
}: DiskUsageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* The dialog itself never scrolls: its scrollbar would cut through the
          rounded corner. The body scrolls inside the padding instead. */}
      <DialogContent className="flex max-h-[min(88vh,780px)] flex-col gap-3 overflow-hidden sm:max-w-2xl">
        {open && <DiskUsageBody hostId={hostId} hostLabel={hostLabel} />}
      </DialogContent>
    </Dialog>
  );
}

function DiskUsageBody({
  hostId,
  hostLabel,
}: {
  hostId: string;
  hostLabel: string;
}) {
  const [path, setPath] = useState('/');
  const [view, setView] = useState<'map' | 'cleanup'>('map');
  const [stored, setLayout] = useAtom(layoutAtom);
  // Anything unexpected in storage falls back to the map.
  const layout: Layout = stored === 'list' ? 'list' : 'map';
  // Keyed by path, so going back up is instant and a slow answer for a folder
  // the user has already left lands in the cache instead of on screen.
  const [listings, setListings] = useState<Record<string, DiskListingType>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inflight = useRef(new Set<string>());

  const listing = listings[path];
  const error = errors[path];

  useEffect(() => {
    if (listing || error || inflight.current.has(path)) return;
    inflight.current.add(path);
    // State is only set from the settled promise, never synchronously here.
    diskService
      .list(hostId, path)
      .then((l) => setListings((prev) => ({ ...prev, [path]: l })))
      .catch((e) => setErrors((prev) => ({ ...prev, [path]: String(e) })))
      .finally(() => inflight.current.delete(path));
  }, [hostId, path, listing, error]);

  const rescan = () => {
    if (inflight.current.has(path)) return;
    setListings(({ [path]: _, ...rest }) => rest);
    setErrors(({ [path]: _, ...rest }) => rest);
  };

  // After a cleanup every cached size is stale, not just the current folder's.
  const forgetAll = () => {
    setListings({});
    setErrors({});
  };

  const open = (entry: DiskEntryType) => {
    if (entry.isDir) setPath(joinPath(path, entry.name));
  };

  // The usage bar outlives a folder change: keep showing the last known
  // numbers while the next level loads rather than flashing to empty.
  const disk = listing ?? Object.values(listings).at(-1);

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 pr-8">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
          {view === 'map' ? (
            <HardDrive className="size-5" />
          ) : (
            <Sparkles className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <DialogTitle className="[overflow-wrap:anywhere]">
            {view === 'map' ? 'Disk usage' : 'Clean up'}
            <span className="text-muted-foreground font-normal">
              {' '}
              · {hostLabel}
            </span>
          </DialogTitle>
          <DialogDescription className="mt-0.5">
            {view === 'map'
              ? 'Bigger block, more space. Click a folder to look inside.'
              : 'Pick what to remove. You’ll see the exact commands first.'}
          </DialogDescription>
        </div>
      </DialogHeader>

      {view === 'map' && disk && disk.diskTotalKb > 0 && (
        <DiskOverview
          usedKb={disk.diskUsedKb}
          totalKb={disk.diskTotalKb}
          action={
            <Button size="sm" onClick={() => setView('cleanup')}>
              <Sparkles />
              Clean up
            </Button>
          }
        />
      )}

      {view === 'cleanup' && (
        <CleanupPanel
          hostId={hostId}
          hostLabel={hostLabel}
          disk={
            disk && disk.diskTotalKb > 0
              ? { usedKb: disk.diskUsedKb, totalKb: disk.diskTotalKb }
              : null
          }
          onBack={() => setView('map')}
          onCleaned={forgetAll}
        />
      )}

      {view === 'map' && (
        <div className="-mr-3 flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-3 overflow-y-auto pr-3">
          <div className="bg-muted/35 flex items-center gap-1.5 rounded-lg px-1.5 py-1">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={path === '/'}
              onClick={() => setPath(parentPath(path))}
            >
              <ArrowUp />
              <span className="sr-only">Up one folder</span>
            </Button>
            <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 font-mono text-xs">
              <Crumb
                label="/"
                current={path === '/'}
                onClick={() => setPath('/')}
              />
              {pathSegments(path).map((seg, i, all) => (
                <span
                  key={seg.path}
                  className="flex min-w-0 items-center gap-0.5"
                >
                  <ChevronRight className="text-muted-foreground/60 size-3 shrink-0" />
                  <Crumb
                    label={seg.name}
                    current={i === all.length - 1}
                    onClick={() => setPath(seg.path)}
                  />
                </span>
              ))}
            </nav>
            {listing && (
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatKb(listing.totalKb)}
              </span>
            )}
            <LayoutToggle value={layout} onChange={setLayout} />
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!listing && !error}
              onClick={rescan}
            >
              <RefreshCw />
              <span className="sr-only">Rescan this folder</span>
            </Button>
          </div>

          {path.startsWith('/var/lib/docker/overlay2') ? (
            <Hint
              tone="warn"
              text="Docker manages this folder. Deleting files here breaks containers — use Docker cleanup instead."
              action="Docker cleanup"
              onAction={() => setView('cleanup')}
            />
          ) : (
            cleanupHint(path) && (
              <Hint
                text="There may be space to win back here."
                action={cleanupHint(path)!}
                onAction={() => setView('cleanup')}
              />
            )
          )}

          {error ? (
            <div className="text-destructive flex h-72 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
              <AlertTriangle className="size-5" />
              <span className="[overflow-wrap:anywhere]">{error}</span>
            </div>
          ) : !listing ? (
            <div className="text-muted-foreground flex h-72 flex-col items-center justify-center gap-2 text-sm">
              <Loader2 className="size-5 animate-spin" />
              <span className="[overflow-wrap:anywhere]">Scanning {path}…</span>
              <span className="text-xs">Big folders can take a while.</span>
            </div>
          ) : listing.entries.every((e) => e.sizeKb <= 0) ? (
            <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
              Nothing here takes up space.
            </div>
          ) : layout === 'list' ? (
            <DiskList
              path={path}
              entries={listing.entries}
              totalKb={listing.totalKb}
              onOpen={open}
            />
          ) : (
            <Treemap path={path} entries={listing.entries} onOpen={open} />
          )}

          {listing?.entries.some((e) => e.partial) && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3 shrink-0 text-(--amber)" />
              Some folders couldn’t be fully read, so their sizes are at least
              what’s shown.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Hint({
  text,
  action,
  onAction,
  tone,
}: {
  text: string;
  action: string;
  onAction: () => void;
  tone?: 'warn';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
        tone === 'warn'
          ? 'border-destructive/40 bg-destructive/8 text-destructive border'
          : 'bg-muted/50 text-muted-foreground',
      )}
    >
      {tone === 'warn' ? (
        <AlertTriangle className="size-3.5 shrink-0" />
      ) : (
        <Sparkles className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1">{text}</span>
      <Button variant="outline" size="xs" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

function Crumb({
  label,
  current,
  onClick,
}: {
  label: string;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={current}
      className={cn(
        'max-w-48 truncate rounded px-1 py-0.5',
        current
          ? 'text-foreground font-semibold'
          : 'text-primary hover:bg-accent',
      )}
    >
      {label}
    </button>
  );
}

function LayoutToggle({
  value,
  onChange,
}: {
  value: Layout;
  onChange: (layout: Layout) => void;
}) {
  const options = [
    { id: 'map' as const, label: 'Map', Icon: LayoutGrid },
    { id: 'list' as const, label: 'List', Icon: List },
  ];
  return (
    <div
      role="group"
      aria-label="View as"
      className="bg-background/70 border-border flex shrink-0 items-center rounded-md border p-0.5"
    >
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors',
            value === id
              ? 'bg-primary/12 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-3" />
          {label}
        </button>
      ))}
    </div>
  );
}
