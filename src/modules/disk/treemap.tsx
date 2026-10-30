import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKb } from '@/lib/format';
import { squarify } from '@/lib/treemap';
import type { DiskEntryType } from '@/types/disk';
import { KINDS, kindOf, type Kind } from './kinds';

/** Past this many tiles the extra ones are too small to click or label, so
    they fold into a single "other" tile instead. */
const MAX_TILES = 24;

/** Anything under this share of the folder goes into "other" too. */
const MIN_SHARE = 0.008;

/** Floor on the "other" tile's share of the map. Its contents are each under
    MIN_SHARE, so at true size it can be a few px thin and unreadable; it is
    a grouping, not an item, and the caption still reports the real size.
    Kept small so it never looks bigger than the real items beside it. */
const OTHER_MIN_SHARE = 0.025;

const OTHER_ID = '\0other';

/** Tint for a tile: its kind's hue, stronger the bigger its share, so the
    heavy hitters stand out before any label is read. sqrt keeps mid-sized
    folders from collapsing into the faintest tint. Capped low enough that
    foreground text keeps its contrast on every hue. */
function tint(kind: Kind, share: number): string {
  const base = kind === 'file' ? 5 : 13;
  const range = kind === 'file' ? 5 : 19;
  const pct = Math.round(base + range * Math.sqrt(Math.min(share, 1)));
  return `color-mix(in srgb, ${KINDS[kind].color} ${pct}%, var(--card))`;
}

/** Sizes on a tile have no room for "459.6": three significant figures at
    most, which is all a glance needs. The caption keeps full precision. */
function shortSize(kb: number): string {
  const full = formatKb(kb);
  const [num, unit] = full.split(' ');
  const n = Number(num);
  if (!Number.isFinite(n) || !unit) return full;
  return `${n >= 100 ? Math.round(n) : n >= 10 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(1)} ${unit}`;
}

/**
 * Shortens a name to fit `px` of width at `fontPx`, cutting from the middle so
 * the end survives. Files in one folder often share a long prefix
 * (`datafile-1-0000001829.ndf`), and the end is the part that tells them
 * apart; a plain truncate would leave every tile reading "datafil".
 */
function fitName(name: string, px: number, fontPx: number): string {
  // ~0.56em per character for the UI font at these sizes.
  const fits = Math.floor(px / (fontPx * 0.56));
  if (name.length <= fits) return name;
  // A few letters of a name are noise ("oot" for root); leave the tile blank
  // and let the hover caption name it.
  if (fits < 4) return '';
  // Middle-cutting needs room for a recognisable start and end; below that a
  // plain end cut reads better.
  if (fits < 9) return `${name.slice(0, fits - 1)}…`;
  const tail = Math.ceil((fits - 1) * 0.65);
  const head = fits - 1 - tail;
  return `${name.slice(0, head)}…${name.slice(-tail)}`;
}

/** Last resort for slivers: `148 MB` → `148M`. */
function tinySize(short: string): string {
  return short.replace(/ ([KMGT]?)B$/, (_, u: string) => u || 'B');
}

interface TreemapProps {
  /** Folder being shown; a few names mean different things in different places. */
  path: string;
  entries: DiskEntryType[];
  onOpen: (entry: DiskEntryType) => void;
}

export default function Treemap({ path, entries, onOpen }: TreemapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Shown in the caption under the map. A native `title` tooltip was tried
  // first, but the webview draws it at the window's corner, not the cursor.
  const [hovered, setHovered] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { shown, other } = useMemo(() => {
    const total = entries.reduce((a, e) => a + e.sizeKb, 0);
    const shown: DiskEntryType[] = [];
    const other = { count: 0, sizeKb: 0 };
    for (const e of entries) {
      if (e.sizeKb <= 0) continue;
      if (shown.length < MAX_TILES && e.sizeKb >= total * MIN_SHARE) {
        shown.push(e);
      } else {
        other.count += 1;
        other.sizeKb += e.sizeKb;
      }
    }
    return { shown, other };
  }, [entries]);

  const tiles = useMemo(() => {
    const items = shown.map((e) => ({ id: e.name, value: e.sizeKb }));
    if (other.sizeKb > 0) {
      const shownKb = shown.reduce((a, e) => a + e.sizeKb, 0);
      // Solve for the value that makes it OTHER_MIN_SHARE of the new total.
      const floor = (shownKb * OTHER_MIN_SHARE) / (1 - OTHER_MIN_SHARE);
      items.push({ id: OTHER_ID, value: Math.max(other.sizeKb, floor) });
    }
    return squarify(items, size.w, size.h);
  }, [shown, other, size]);

  const byName = useMemo(() => new Map(shown.map((e) => [e.name, e])), [shown]);
  const kinds = useMemo(
    () => new Map(shown.map((e) => [e.name, kindOf(e, path)])),
    [shown, path],
  );
  const total = shown.reduce((a, e) => a + e.sizeKb, 0) + other.sizeKb;
  const pctOf = (kb: number) =>
    total ? Math.max(Math.round((kb / total) * 100), kb ? 1 : 0) : 0;

  const otherLabel = `${other.count} smaller item${other.count === 1 ? '' : 's'}`;
  const hoveredEntry = hovered ? byName.get(hovered) : undefined;
  const caption =
    hovered === OTHER_ID
      ? `${otherLabel} · ${formatKb(other.sizeKb)} · ${pctOf(other.sizeKb)}%`
      : hoveredEntry
        ? `${hoveredEntry.name}${hoveredEntry.isDir ? '/' : ''} · ${formatKb(
            hoveredEntry.sizeKb,
          )} · ${pctOf(hoveredEntry.sizeKb)}%${
            hoveredEntry.partial ? ' · some contents unreadable' : ''
          }${hoveredEntry.isDir ? ' · click to open' : ''}`
        : null;

  // Legend lists only the kinds actually on screen, biggest first.
  const legend = useMemo(() => {
    const sums = new Map<Kind, number>();
    for (const e of shown) {
      const k = kinds.get(e.name)!;
      sums.set(k, (sums.get(k) ?? 0) + e.sizeKb);
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [shown, kinds]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={boxRef}
        className="relative h-64 w-full"
        onMouseLeave={() => setHovered(null)}
      >
        {tiles.map((t) => {
          // A 3px gutter on every side, taken out of the tile rather than
          // added between tiles, so the layout's maths stays exact.
          const w = Math.max(t.w - 6, 0);
          const h = Math.max(t.h - 6, 0);
          const style = { left: t.x + 3, top: t.y + 3, width: w, height: h };
          const dimmed = hovered !== null && hovered !== t.id;
          const lit = hovered === t.id;

          if (t.id === OTHER_ID) {
            // A small leftover group is just texture; a big one (a folder of
            // many similar files, where everything past the first tiles
            // lands here) is the main story and gets a headline like a tile.
            const big =
              other.sizeKb / (total || 1) >= 0.2 && w >= 120 && h >= 70;
            const label = w >= 90 && h >= 40;
            const bigFont = Math.round(
              Math.min(28, Math.max(14, Math.sqrt(w * h) / 9)),
            );
            return (
              <div
                key={t.id}
                onMouseEnter={() => setHovered(OTHER_ID)}
                style={{
                  ...style,
                  // Scattered dots: "lots of little things".
                  backgroundImage:
                    'radial-gradient(color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 1.2px)',
                  backgroundSize: '8px 8px',
                  backgroundColor: big
                    ? 'color-mix(in srgb, var(--foreground) 4%, var(--card))'
                    : undefined,
                }}
                className={cn(
                  'text-muted-foreground border-border absolute flex flex-col overflow-hidden rounded-xl border border-dashed p-2.5 text-[11px] transition-[opacity,box-shadow] duration-200',
                  big ? 'justify-between' : 'justify-end',
                  dimmed && 'opacity-45',
                  lit && 'shadow-md',
                )}
              >
                {big ? (
                  <>
                    <span className="bg-card/80 text-foreground self-start rounded px-1 text-xs font-medium">
                      {otherLabel}
                    </span>
                    <span className="bg-card/80 flex items-end gap-2 self-start rounded px-1">
                      <span
                        className="font-heading text-foreground leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums"
                        style={{ fontSize: bigFont }}
                      >
                        {shortSize(other.sizeKb)}
                      </span>
                      <span className="text-[11px] tabular-nums">
                        {pctOf(other.sizeKb)}%
                      </span>
                    </span>
                  </>
                ) : (
                  label && (
                    <span className="bg-card/80 self-start truncate rounded px-1">
                      +{other.count} more
                    </span>
                  )
                )}
              </div>
            );
          }

          const entry = byName.get(t.id)!;
          const kind = kinds.get(entry.name)!;
          const look = KINDS[kind];
          const Icon = look.icon;
          const share = total ? entry.sizeKb / total : 0;
          // Narrow tiles (a sliver beside a big folder) drop the icon and
          // tighten up, so the name and size still fit side by side.
          const narrow = w < 90;
          const pad = narrow ? 16 : 20;
          // Scales with the tile so the biggest folder's number is read
          // first, but never wider than the tile: a digit is about 0.6em, and
          // the % beside it needs its own room when shown. When even the
          // short form won't fit at 11px, the unit shrinks to a letter.
          const showPct = w >= 120 && h >= 70;
          const room = w - pad - (showPct ? 36 : 0);
          const full = shortSize(entry.sizeKb);
          const sizeText =
            room / (full.length * 0.6) >= 11 ? full : tinySize(full);
          const sizeFont = Math.round(
            Math.min(
              28,
              Math.max(12, Math.sqrt(w * h) / 9),
              room / (sizeText.length * 0.6),
            ),
          );
          const showName = w >= 30 && h >= 26;
          const showSize = sizeFont >= 10 && h >= 26 + sizeFont;

          return (
            <button
              key={t.id}
              type="button"
              aria-label={`${entry.name}, ${formatKb(entry.sizeKb)}`}
              // aria-disabled rather than disabled: a disabled button gets no
              // mouse events, so hovering a file would leave the caption blank.
              aria-disabled={!entry.isDir}
              onMouseEnter={() => setHovered(entry.name)}
              onFocus={() => setHovered(entry.name)}
              onClick={() => entry.isDir && onOpen(entry)}
              style={{ ...style, background: tint(kind, share) }}
              className={cn(
                'text-foreground absolute flex flex-col justify-between overflow-hidden rounded-xl text-left outline-none',
                narrow ? 'p-2' : 'p-2.5',
                'transition-[opacity,transform,box-shadow] duration-200 ease-out',
                'focus-visible:ring-ring focus-visible:ring-2',
                entry.isDir ? 'cursor-pointer' : 'cursor-default',
                dimmed && 'opacity-45',
                lit && '-translate-y-0.5 shadow-md',
              )}
            >
              {showName ? (
                <div
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 font-medium',
                    narrow ? 'text-[11px]' : 'text-xs',
                  )}
                >
                  {!narrow && (
                    <Icon
                      className="size-3.5 shrink-0"
                      style={{
                        color: kind === 'file' ? undefined : look.color,
                      }}
                    />
                  )}
                  <span className="min-w-0 whitespace-nowrap">
                    {fitName(
                      entry.name,
                      w - pad - (narrow ? 0 : 20),
                      narrow ? 11 : 12,
                    )}
                  </span>
                  {entry.partial && (
                    <AlertTriangle className="size-3 shrink-0 text-(--amber)" />
                  )}
                </div>
              ) : (
                <span />
              )}
              {showSize && (
                <div className="flex items-end justify-between gap-2">
                  <span
                    className="font-heading leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums"
                    style={{ fontSize: sizeFont }}
                  >
                    {sizeText}
                  </span>
                  {showPct && (
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                      {pctOf(entry.sizeKb)}%
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-muted-foreground min-w-0 truncate text-xs tabular-nums">
          {caption ?? 'Hover a block for details.'}
        </p>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map((k) => (
            <li
              key={k}
              className="text-muted-foreground flex items-center gap-1.5 text-[11px]"
            >
              <span
                className="size-2 rounded-full"
                style={{
                  background: KINDS[k].color,
                  opacity: k === 'file' ? 0.35 : 0.85,
                }}
              />
              {KINDS[k].label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
