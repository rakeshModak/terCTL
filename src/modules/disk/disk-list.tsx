import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKb } from '@/lib/format';
import type { DiskEntryType } from '@/types/disk';
import { KINDS, kindOf } from './kinds';

type SortKey = 'size' | 'name';

interface DiskListProps {
  path: string;
  entries: DiskEntryType[];
  totalKb: number;
  onOpen: (entry: DiskEntryType) => void;
}

/** Every child of the folder, not just the ones big enough for the map — the
    list is where the map's "N smaller items" can actually be seen. Same
    height as the map, so switching views doesn't make the dialog jump. */
export default function DiskList({
  path,
  entries,
  totalKb,
  onOpen,
}: DiskListProps) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'size',
    desc: true,
  });

  const rows = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      sort.key === 'size'
        ? a.sizeKb - b.sizeKb || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    return sort.desc ? sorted.reverse() : sorted;
  }, [entries, sort]);

  // Size naturally reads biggest-first, names A→Z, so a fresh pick of either
  // column starts in that direction; a second click flips it.
  const pick = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, desc: !prev.desc }
        : { key, desc: key === 'size' },
    );

  return (
    <div className="border-border flex h-72 flex-col overflow-hidden rounded-xl border">
      <div className="bg-muted/35 border-border text-muted-foreground flex items-center gap-2.5 border-b px-3 py-1.5 text-[11px] font-medium">
        <SortButton
          label="Name"
          active={sort.key === 'name'}
          desc={sort.desc}
          onClick={() => pick('name')}
          className="flex-1"
        />
        <span className="w-24 shrink-0" />
        <span className="w-9 shrink-0 text-right">Share</span>
        <SortButton
          label="Size"
          active={sort.key === 'size'}
          desc={sort.desc}
          onClick={() => pick('size')}
          className="w-20 shrink-0 justify-end"
        />
        <span className="w-3.5 shrink-0" />
      </div>

      <ul className="min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto py-1">
        {rows.map((entry) => {
          const kind = kindOf(entry, path);
          const look = KINDS[kind];
          const Icon = look.icon;
          const share = totalKb ? entry.sizeKb / totalKb : 0;
          return (
            <li key={entry.name}>
              <button
                type="button"
                onClick={() => entry.isDir && onOpen(entry)}
                aria-disabled={!entry.isDir}
                className={cn(
                  'group flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors',
                  entry.isDir
                    ? 'hover:bg-accent cursor-pointer'
                    : 'cursor-default',
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: `color-mix(in srgb, ${look.color} ${kind === 'file' ? 8 : 15}%, var(--card))`,
                      color: kind === 'file' ? undefined : look.color,
                    }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 truncate font-mono">
                    {entry.name}
                  </span>
                  {entry.partial && (
                    <AlertTriangle
                      className="size-3 shrink-0 text-(--amber)"
                      aria-label="Some contents unreadable"
                    />
                  )}
                </span>
                <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(share * 100, entry.sizeKb ? 1.5 : 0)}%`,
                      background:
                        kind === 'file'
                          ? 'var(--muted-foreground)'
                          : look.color,
                    }}
                  />
                </span>
                <span className="text-muted-foreground w-9 shrink-0 text-right tabular-nums">
                  {share > 0 && share < 0.01 ? '<1' : Math.round(share * 100)}%
                </span>
                <span className="text-foreground w-20 shrink-0 text-right font-medium whitespace-nowrap tabular-nums">
                  {formatKb(entry.sizeKb)}
                </span>
                <ChevronRight
                  className={cn(
                    'text-muted-foreground/50 size-3.5 shrink-0 transition-opacity',
                    entry.isDir
                      ? 'opacity-0 group-hover:opacity-100'
                      : 'invisible',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SortButton({
  label,
  active,
  desc,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  className?: string;
}) {
  const Arrow = desc ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'hover:text-foreground flex items-center gap-1 transition-colors',
        active && 'text-foreground',
        className,
      )}
    >
      {label}
      <Arrow className={cn('size-3', !active && 'opacity-0')} />
    </button>
  );
}
